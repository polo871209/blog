---
title: "Istio Ambient Mesh Networking: A Deep Dive"
date: 2026-04-21
lastmod: 2026-04-21
summary: "Ambient mode removes sidecars and uses a node-level proxy (ztunnel) plus optional waypoints. This post explains how traffic is captured, encrypted with HBONE, and routed through the mesh, with hands-on verification on a real node"
tags: ["istio", "kubernetes", "service-mesh", "networking"]
aliases: ["/posts/istio_ambient_networking/"]
draft: true
---

## TL;DR

Istio ambient mode replaces per-pod sidecars with two components: a **ztunnel** node proxy that handles L4 mTLS/encryption, and optional **waypoint proxies** that handle L7 policy. Traffic between pods is transparently captured inside each pod's network namespace, wrapped in an encrypted **HBONE** tunnel (HTTP/2 + CONNECT + mTLS over port 15008), and decrypted in the destination pod's namespace. No sidecar, no app changes.

---

## Two-Layer Architecture

Ambient splits the mesh into two layers so each pod only pays for what it uses:

- **Secure L4 overlay** — mTLS, identity, L4 auth policy, telemetry. Always on. Handled by `ztunnel` (one DaemonSet per node).
- **L7 processing** — HTTP routing, retries, L7 authz, traffic shifting. Opt-in per service. Handled by `waypoint` proxies (regular Envoy deployments).

---

## The Three Workload Categories

A pod in an ambient cluster sits in one of three states:

| State                  | How                                                | What you get                           |
| ---------------------- | -------------------------------------------------- | -------------------------------------- |
| **Out of mesh**        | No labels                                          | Plain Kubernetes networking            |
| **In mesh (L4)**       | `istio.io/dataplane-mode=ambient` on namespace/pod | mTLS, L4 policy, telemetry via ztunnel |
| **In mesh + waypoint** | Above + `istio.io/use-waypoint=<name>`             | Everything above + L7 features         |

Traffic path differs per state. Let's walk through each.

---

## Component Overview

{{< mermaid >}}
graph TB
subgraph Node["Kubernetes Node"]
CNI["istio-cni<br/>node agent<br/>(privileged)"]
ZT["ztunnel<br/>node proxy<br/>(one per node)"]
subgraph Pod1["App Pod A (ambient)"]
App1["app container"]
NS1["netns:<br/>iptables redirect<br/>+ ztunnel listeners<br/>15001/15006/15008"]
end
subgraph Pod2["App Pod B (ambient)"]
App2["app container"]
NS2["netns:<br/>iptables redirect<br/>+ ztunnel listeners"]
end
end
WP["Waypoint Proxy<br/>(optional Envoy deployment)"]

    CNI -->|1. write iptables<br/>2. pass netns fd| ZT
    ZT -.->|creates listeners<br/>inside pod netns| NS1
    ZT -.->|creates listeners<br/>inside pod netns| NS2
    App1 <-->|captured traffic| ZT
    App2 <-->|captured traffic| ZT
    ZT <-->|HBONE to L7| WP

{{< /mermaid >}}

Key components:

- **`istio-cni`** — privileged DaemonSet. Watches pod lifecycle, writes iptables rules into pod netns, notifies ztunnel.
- **`ztunnel`** — per-node Rust proxy. Handles L4 capture, mTLS, HBONE. One process, many per-pod listener sets.
- **`waypoint`** — optional per-service Envoy. Runs as regular Kubernetes Deployment, exposed via Gateway API.
- **`istiod`** — control plane. Distributes config, certs, workload info.

---

## How Traffic Is Captured: In-Pod Redirection

Before any traffic flows, ambient must intercept it. This is a three-step handshake between `istio-cni` and `ztunnel`:

{{< mermaid >}}
sequenceDiagram
participant K as Kubelet
participant C as istio-cni
participant Z as ztunnel
participant P as Pod netns

    K->>C: Pod created (ambient label)
    C->>P: 1. Enter pod netns, write iptables rules
    Note over P: Redirect TCP to<br/>15001/15006/15008
    C->>Z: 2. Notify via UDS<br/>(pass netns fd)
    Z->>P: 3. Create listeners inside pod netns
    Note over Z,P: ztunnel process<br/>binds sockets in pod netns<br/>via fd passing

{{< /mermaid >}}

### Why split into three steps?

This design is deliberate — it enforces **privilege separation**:

- **istio-cni** holds `CAP_NET_ADMIN` (needed for iptables) but never touches traffic
- **ztunnel** handles traffic but cannot modify redirect rules
- If ztunnel is compromised, attacker cannot bypass capture

The `/var/run/ztunnel/ztunnel.sock` Unix domain socket is the only channel between them. The istio-cni agent passes the **pod's netns file descriptor** over this socket. Ztunnel then binds listeners _inside_ the pod's namespace without ever needing namespace-enumeration privileges itself.

### What is a netns file descriptor?

In Linux, every network namespace is represented as a file at `/proc/<pid>/ns/net`. Opening that file gives you a **file descriptor (fd)** — a small integer the kernel uses as a handle to the namespace. Whoever holds that fd can "enter" the namespace using `setns(fd, CLONE_NEWNET)` and any subsequent socket operation (like `bind()`) applies inside it.

```
/proc/10532/ns/net  →  open()  →  fd=7  →  setns(7)  →  now in pod's netns
```

Two important properties of fds:

- **Passable over Unix domain sockets** — the `SCM_RIGHTS` control message lets one process hand an open fd to another process. The receiver gets a _new_ fd number pointing to the _same_ kernel object. Works across processes that share nothing else.
- **Persist independently of the source** — once ztunnel has the fd, the namespace stays alive even if the path `/proc/<pid>/ns/net` disappears, as long as someone holds the reference.

### Why pass the fd instead of the path?

A naive design would have ztunnel open `/proc/<pid>/ns/net` itself. But that requires:

- Knowing the pod sandbox PID (needs CRI access or `/proc` scanning)
- `CAP_SYS_PTRACE` or equivalent to read another process's `/proc` entries
- Race conditions — pod can die between lookup and open

Fd-passing sidesteps all of this:

{{< mermaid >}}
sequenceDiagram
participant C as istio-cni<br/>(privileged)
participant K as Kernel
participant Z as ztunnel<br/>(lower privilege)

    C->>K: open("/proc/10532/ns/net")
    K-->>C: fd=7 (pod netns handle)
    C->>Z: sendmsg(UDS, SCM_RIGHTS, fd=7)
    Note over K: Kernel duplicates fd<br/>into ztunnel's fd table
    K-->>Z: fd=73 (same netns, new number)
    Z->>K: setns(73, CLONE_NEWNET)
    Note over Z: ztunnel now runs<br/>in pod netns
    Z->>K: socket() + bind(:15001)
    Note over Z: listener exists<br/>inside pod netns<br/>owned by ztunnel process

{{< /mermaid >}}

Ztunnel only needs `CAP_NET_BIND_SERVICE` (for the socket) — not `CAP_SYS_ADMIN` or `CAP_SYS_PTRACE`. The privileged istio-cni did the heavy lifting once, then handed over a capability-like token (the fd) scoped to exactly one thing: that pod's network namespace.

### One process, many namespaces

This is why on your node you see a single `ztunnel` process (PID 19286 in the earlier verification) but listeners appearing inside many different pod netns. The process itself lives in the ztunnel pod's netns, but it holds open fds to every ambient pod's netns on the node. For each pod, it:

1. Temporarily switches to the pod's netns via `setns()`
2. Creates the 15001/15006/15008/15053 listeners
3. Switches back

The sockets stay bound in the pod's netns (tied to the netns, not the process location). When you run `ss -tlnp` inside the pod netns, you see them owned by the ztunnel process because the fd table belongs to that process — even though the socket lives in a different namespace.

### The well-known ports

Each ambient pod ends up with these listeners (owned by the host ztunnel process, but bound inside the pod's netns):

| Port    | Purpose                   |
| ------- | ------------------------- |
| `15001` | Outbound TCP capture      |
| `15006` | Inbound plaintext capture |
| `15008` | Inbound HBONE (mTLS)      |
| `15053` | DNS proxy                 |

---

## HBONE: The Secure Tunnel Protocol

**HBONE** = **H**TTP-**B**ased **O**verlay **N**etwork **E**nvironment. It's Istio's way of tunneling arbitrary TCP between proxies over a single encrypted connection.

HBONE combines three open standards:

- **HTTP/2** — multiplexes many streams over one connection
- **HTTP CONNECT** — tunnels arbitrary TCP inside HTTP
- **mTLS** — encrypts and mutually authenticates the connection

### Packet structure

{{< mermaid >}}
graph LR
subgraph Outer["Outer TCP packet on port 15008"]
TCP["TCP"]
TLS["mTLS<br/>(encrypts everything below)"]
H2["HTTP/2 frame"]
CONNECT["CONNECT pod-ip:port"]
Inner["Original TCP payload<br/>(app request unchanged)"]
end
{{< /mermaid >}}

Think of HBONE as a "VPN tunnel, but per-connection, per-identity". Each unique **(source identity, destination identity)** pair gets its own tunnel. Streams for the same pair multiplex over that one tunnel.

### Why HBONE instead of plain mTLS?

Plain mTLS sits over raw TCP — you can only tunnel one connection per TLS session. HBONE's HTTP/2 layer lets you:

- Multiplex thousands of TCP streams over one TLS connection (huge perf win)
- Carry metadata (original destination, headers) without modifying the app payload
- Support future protocols (UDP-over-HTTP is being standardized as connect-udp)

### Identity model

Every ambient workload gets a **SPIFFE identity** tied to its Kubernetes ServiceAccount, e.g. `spiffe://cluster.local/ns/default/sa/payments`. The ztunnel:

1. Fetches x509 certs from istiod CA for every identity on its node
2. Uses the **workload's** identity for the HBONE mTLS handshake (not ztunnel's own identity)
3. Rotates certs before expiry
4. Rejects requests for identities not on its node — one compromised node can't impersonate the whole mesh

---

## Data Plane Path: L4 Only (No Waypoint)

Simplest case: two ambient pods, no L7 features needed.

{{< mermaid >}}
sequenceDiagram
participant A as App Pod A<br/>(node 1)
participant ZA as ztunnel on node 1<br/>(in Pod A's netns)
participant ZB as ztunnel on node 2<br/>(in Pod B's netns)
participant B as App Pod B<br/>(node 2)

    A->>ZA: TCP connect to B (captured on :15001)
    ZA->>ZA: Fetch cert for Pod A identity
    ZA->>ZB: HBONE CONNECT over mTLS<br/>(to port 15008)
    Note over ZA,ZB: Encrypted tunnel<br/>SPIFFE ID A -> SPIFFE ID B
    ZB->>ZB: Verify L4 AuthorizationPolicy
    ZB->>B: Forward plaintext TCP to app port
    B->>ZB: Response
    ZB->>ZA: Response over HBONE
    ZA->>A: Response plaintext

{{< /mermaid >}}

Key points:

- Capture happens **inside each pod's netns** — not on host, not in a central proxy pod
- HBONE tunnel is **pod-to-pod logically**, even though ztunnel drives it
- L4 `AuthorizationPolicy` enforced by **destination** ztunnel
- Same path for same-node traffic — ztunnel always mediates so policies apply uniformly

### What about non-ambient destinations?

Ztunnel detects destination capability from istiod config:

- Destination **in ambient mesh** → HBONE upgrade
- Destination **has sidecar** → HBONE upgrade (sidecar understands HBONE since 1.22)
- Destination **out of mesh** → plain TCP, no encryption (you lose mTLS)

---

## Adding Waypoints: The L7 Path

L4 is enough for mTLS + basic policy. For L7 features (HTTP routing, retries, L7 authz, header-based canary), you deploy a **waypoint proxy** per service or namespace.

Waypoints are regular Envoy deployments. Enable with:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: my-waypoint
spec:
  gatewayClassName: istio-waypoint
  listeners:
    - name: mesh
      port: 15008
      protocol: HBONE
```

Then label the service or namespace:

```bash
kubectl label service payments istio.io/use-waypoint=my-waypoint
```

### Traffic path with waypoint

{{< mermaid >}}
sequenceDiagram
participant A as App Pod A
participant ZA as ztunnel (Pod A netns)
participant W as Waypoint<br/>(Envoy)
participant ZB as ztunnel (Pod B netns)
participant B as App Pod B

    A->>ZA: TCP to service "payments"
    ZA->>W: HBONE tunnel #1<br/>(to waypoint, port 15008)
    Note over W: L7 processing:<br/>routing, retries,<br/>AuthorizationPolicy,<br/>Telemetry
    W->>ZB: HBONE tunnel #2<br/>(to selected pod)
    ZB->>B: Plaintext to app

{{< /mermaid>}}

Now there are **two HBONE tunnels**: source → waypoint, waypoint → destination. The waypoint:

- Receives **only** HBONE traffic (port 15008)
- Applies Gateway API `HTTPRoute` rules
- Enforces L7 `AuthorizationPolicy`, `RequestAuthentication`, `WasmPlugin`, `Telemetry`
- Forwards via another HBONE tunnel to destination pod

### Service vs Pod routing

- Request to a **Service** → waypoint applies routing + L7 load balancing across endpoints
- Request to a **Pod IP directly** → waypoint applies policy, forwards to that pod

Example `HTTPRoute` sending all `echo` traffic to `echo-v1`:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: echo
spec:
  parentRefs:
    - group: ""
      kind: Service
      name: echo
  rules:
    - backendRefs:
        - name: echo-v1
          port: 80
```

---

## Hands-On: Verifying Ambient on a Node

Enough theory. Here's how to verify this on a real GKE node. I'll walk through what I saw on one of my nodes.

### 1. Cluster-level

```bash
kubectl get pods -n istio-system -l app=ztunnel -o wide
kubectl get pods -n istio-system -l k8s-app=istio-cni-node -o wide
kubectl get ns -L istio.io/dataplane-mode
```

Expect ztunnel + istio-cni running on every node, target namespaces labeled `ambient`.

### 2. On the node — find ztunnel

```bash
sudo pgrep -a ztunnel
```

<pre><code><span style="color:#fab387">19286</span> /usr/local/bin/ztunnel proxy ztunnel
</code></pre>

Check socket:

```bash
ls -la /var/run/ztunnel/ztunnel.sock
```

<pre><code>srwxr-xr-x 1 root root 0 Apr 21 02:09 /var/run/ztunnel/ztunnel.sock
</code></pre>

### 3. Inside ztunnel's own netns

```bash
sudo nsenter -t 19286 -n ss -tlnp
```

<pre><code>LISTEN 0 1024 127.0.0.1:<span style="color:#fab387">15000</span>   users:(("ztunnel",pid=19286))   # admin
LISTEN 0 1024         *:<span style="color:#fab387">15020</span>   users:(("ztunnel",pid=19286))   # metrics
LISTEN 0 1024         *:<span style="color:#fab387">15021</span>   users:(("ztunnel",pid=19286))   # healthz
LISTEN 0 128          *:<span style="color:#fab387">15008</span>   users:(("ztunnel",pid=19286))   # HBONE mTLS inbound
</code></pre>

Note: **15001 and 15006 are missing here**. That's correct — those listeners live inside each app pod's netns.

### 4. Inside an ambient pod's netns

Find the pod sandbox PID:

```bash
POD_ID=$(sudo crictl pods --name <pod-name> -q)
APP_PID=$(sudo crictl inspectp -o go-template --template='{{.info.pid}}' $POD_ID)
echo $APP_PID
```

Check listeners:

```bash
sudo nsenter -t $APP_PID -n ss -tlnp
```

<pre><code>LISTEN 0 128  127.0.0.1:<span style="color:#fab387">15053</span>  users:(("ztunnel",pid=19286,fd=73))  # DNS proxy
LISTEN 0 128          *:<span style="color:#fab387">15008</span>  users:(("ztunnel",pid=19286,fd=75))  # HBONE
LISTEN 0 128          *:<span style="color:#fab387">15001</span>  users:(("ztunnel",pid=19286,fd=77))  # outbound
LISTEN 0 128          *:<span style="color:#fab387">15006</span>  users:(("ztunnel",pid=19286,fd=76))  # inbound plaintext
LISTEN 0 511          *:<span style="color:#a6e3a1">8080</span>                                        # your app
</code></pre>

This is the **proof** that fd-passing works. The process is `pid=19286` — same ztunnel running in its own pod. But the sockets are bound inside **this app pod's netns**. One process, many netns, listeners isolated per pod.

### 5. iptables redirect inside pod netns

```bash
sudo nsenter -t $APP_PID -n iptables-save | grep -iE 'istio'
```

You'll see `ISTIO_PRERT`, `ISTIO_OUTPUT` chains redirecting TCP to `15001`/`15006`/`15008`.

### 6. Control-plane view

```bash
istioctl ztunnel-config workload --node <node-name>
```

Lists every workload this node's ztunnel knows about.

---

## Key Takeaways

- Ambient splits the mesh into a **mandatory L4 overlay** (ztunnel) and **optional L7 layer** (waypoints)
- Traffic is captured **inside each pod's netns** via iptables rules written by `istio-cni`, with listeners injected by ztunnel via fd-passing over a Unix domain socket
- **HBONE** = HTTP/2 + CONNECT + mTLS on port 15008 — one encrypted tunnel per source-destination identity pair, multiplexing many app streams
- Ztunnel authenticates to istiod with its own identity but requests **workload certificates** for each pod on its node — a compromised node cannot impersonate the whole mesh
- Waypoints are regular Envoy deployments exposed via Gateway API, receiving only HBONE traffic

The architecture is cleaner than sidecars because privilege, data path, and control path are all separated. `istio-cni` has the kernel capabilities, ztunnel has the traffic, istiod has the config — and none of them can do each other's job.

---

## References

- Istio Authors. (n.d.). _[Ambient data plane](https://istio.io/latest/docs/ambient/architecture/data-plane/)_ [Documentation].
- Istio Authors. (n.d.). _[HBONE protocol](https://istio.io/latest/docs/ambient/architecture/hbone/)_ [Documentation].
- Istio Authors. (n.d.). _[Ztunnel traffic redirection](https://istio.io/latest/docs/ambient/architecture/traffic-redirection/)_ [Documentation].
- Istio Authors. (n.d.). _[Ztunnel architecture](https://github.com/istio/ztunnel/blob/master/ARCHITECTURE.md)_ [Documentation]. GitHub.
- Istio Authors. (n.d.). _[Ambient mode overview](https://istio.io/latest/docs/ambient/overview/)_ [Documentation].
- SPIFFE Project. (n.d.). _[SPIFFE specification](https://github.com/spiffe/spiffe/blob/main/standards/SPIFFE.md)_ [Specification]. GitHub.
- Mozilla. (n.d.). _[HTTP CONNECT method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/CONNECT)_ [Documentation]. MDN Web Docs.
