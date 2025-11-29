---
title: "eBPF & Cilium"
date: 2025-11-29
lastmod: 2025-11-29
description: "Technical notes on eBPF and Cilium concepts for cloud-native networking and observability"
tags: ["ebpf", "cilium", "networking", "kubernetes", "observability"]
---

## What is eBPF

`eBPF` (extended Berkeley Packet Filter) is a technology that allows running sandboxed programs in the Linux kernel without changing kernel source code or loading kernel modules.

### How eBPF Works

**Kernel Extension Mechanism**
- User space programs write eBPF bytecode
- Kernel verifier ensures safety (no crashes, no infinite loops, bounded memory access)
- JIT compiler converts bytecode to native machine code
- Programs attach to kernel hooks (network events, syscalls, tracepoints)
- Programs execute in response to events

**Safety Guarantees**
- Programs must terminate (no loops without bounds)
- Cannot crash the kernel
- Cannot access arbitrary memory
- Limited stack size (512 bytes)
- Verifier rejects unsafe programs before loading

### eBPF Program Types

Different hook points for different use cases:

- `XDP` (eXpress Data Path) — Earliest point in network stack, at driver level
- `TC` (Traffic Control) — After XDP, before kernel network stack processing
- `Socket filters` — Per-socket packet filtering
- `kprobes/uprobes` — Dynamic tracing of kernel/user functions
- `Tracepoints` — Static kernel instrumentation points
- `Cgroup hooks` — Attach to control groups for container-level policies

### eBPF Maps

Shared data structures between kernel space and user space:

- **Purpose** — Store state, share data between programs, communicate with user space
- **Types** — Hash tables, arrays, LRU caches, ring buffers, stack traces
- **Access** — Both eBPF programs and user space applications can read/write
- **Use cases** — Connection tracking, metrics aggregation, configuration storage

---

## What is Cilium

`Cilium` is a cloud-native networking, observability, and security platform built on eBPF. It replaces traditional networking components with eBPF-based implementations for better performance and flexibility.

### Core Concepts

**eBPF-based Networking**
- Networking logic runs in kernel via eBPF programs
- Bypasses traditional `iptables` chains (which can have thousands of rules)
- Direct packet manipulation at kernel level
- Lower latency, higher throughput than user-space proxies

**Identity-based Security**
- Each workload gets a cryptographic identity based on labels
- Policies reference identities, not IP addresses
- Identity travels with packets (in packet headers or maps)
- Works across network boundaries without NAT translation

**Components**
- `Cilium Agent` — Per-node daemon that compiles and loads eBPF programs
- `Cilium Operator` — Cluster-wide operations (IPAM, garbage collection)
- `Hubble` — Observability layer that leverages eBPF visibility
- `Envoy` — Optional L7 proxy for application-layer policies

---

## How Cilium Uses eBPF

### Packet Flow

**Ingress Path**
1. Packet arrives at network interface
2. `XDP` program processes at driver level (optional, for performance)
3. `TC` eBPF program intercepts at ingress
4. Program looks up endpoint identity in eBPF maps
5. Policy enforcement happens in kernel
6. Packet forwarded to correct destination or dropped

**Egress Path**
1. Application sends packet
2. eBPF program attached to socket or TC egress
3. Identity added to packet metadata
4. Connection tracking updated in eBPF maps
5. NAT/load balancing applied if needed
6. Packet exits interface

### Network Policy Enforcement

**Traditional vs Cilium**
- Traditional: `iptables` chains grow linearly with rules (O(n) lookup)
- Cilium: eBPF maps provide constant-time lookup (O(1))

**How it Works**
- Policies compiled into eBPF bytecode
- Identity-based matching in eBPF maps
- L3/L4 rules enforced in kernel
- L7 rules optionally redirected to Envoy proxy

**Policy Levels**
- `L3` — IP/CIDR-based filtering
- `L4` — Protocol and port matching
- `L7` — HTTP methods, paths, headers, gRPC methods, DNS names

---

## kube-proxy Replacement

### Traditional kube-proxy

**How it Works**
- Watches Kubernetes Service objects
- Programs `iptables` or `IPVS` rules for load balancing
- Packets traverse long chains of rules
- User space daemon updates kernel rules

**Limitations**
- `iptables` performance degrades with many Services
- Rule updates require full chain rewrites
- No direct server return (DSR) support
- Extra network hops

### Cilium's eBPF Approach

**Direct Implementation**
- eBPF programs implement Service load balancing directly
- Service backends stored in eBPF maps
- Connection tracking in kernel space
- Socket-level load balancing before packets enter network stack

**Advantages**
- Constant-time Service lookup regardless of cluster size
- Incremental updates to eBPF maps
- Support for DSR (client sees real server IP in responses)
- Lower latency, no extra hops

---

## Data Plane Modes

### Tunneling (Overlay)

**How it Works**
- Encapsulates pod traffic in VXLAN or Geneve headers
- Carries pod identity in tunnel metadata
- Works across any network topology

**When to Use**
- Underlying network doesn't support pod CIDR routing
- Need network isolation from infrastructure
- Cloud environments without route propagation

### Native Routing (Underlay)

**How it Works**
- Pod IPs routed directly without encapsulation
- Relies on infrastructure routing (BGP, cloud routes)
- eBPF programs forward based on routing table

**When to Use**
- Network supports pod CIDR routing
- Lower overhead desired (no encapsulation)
- Cloud provider integrations (AWS ENI, Azure IPAM)

### DSR (Direct Server Return)

**Concept**
- Load balancer forwards request to backend
- Backend responds directly to client (bypasses load balancer)
- Asymmetric routing path

**Benefits**
- Reduces load balancer bottleneck
- Better for large response payloads
- Lower latency for response path

---

## Hubble Observability

### What Hubble Provides

**Network Flow Visibility**
- Every packet visible via eBPF hooks
- Flow logs without packet capture overhead
- Identity information embedded in flows
- L7 protocol parsing (HTTP, gRPC, Kafka, DNS)

**How it Works**
- eBPF programs emit events to perf ring buffers
- Hubble relay aggregates events cluster-wide
- Data includes: source/dest identity, verdict, L7 metadata
- No sidecar needed, kernel-level visibility

**Use Cases**
- Debugging connectivity issues (who talks to whom)
- Security monitoring (policy violations, dropped packets)
- Performance analysis (latency, retransmits)
- Compliance (audit logs of all communications)

---

## XDP (eXpress Data Path)

### What XDP Does

`XDP` is the earliest hook point in the Linux networking stack, running eBPF programs at the network driver level before kernel allocates socket buffers.

**Packet Verdicts**
- `XDP_DROP` — Drop packet immediately (DDoS protection)
- `XDP_PASS` — Continue to kernel network stack
- `XDP_TX` — Bounce packet back out same interface
- `XDP_REDIRECT` — Send to different interface or CPU

**Performance**
- Processes packets before expensive operations (skb allocation)
- Can achieve millions of packets per second
- Used for load balancing, DDoS mitigation, packet filtering

**Cilium XDP Use**
- Accelerated Service load balancing
- Early packet filtering
- Optimal performance for high-throughput workloads

---

## Service Mesh Capabilities

### Traditional Service Mesh

**Sidecar Pattern**
- Proxy container per pod (Envoy, Linkerd)
- All traffic redirected through proxy
- L7 processing in user space
- Resource overhead per pod

### Cilium Service Mesh

**eBPF-accelerated**
- L3/L4 handled entirely in kernel via eBPF
- L7 processing uses shared Envoy instances (optional)
- Socket-level redirection without iptables
- Lower resource footprint

**Features**
- Transparent mTLS encryption
- L7 traffic management (retries, timeouts, circuit breaking)
- Distributed tracing integration
- Golden metrics without application changes

---

## Key Advantages of eBPF Networking

**Performance**
- Kernel-level processing eliminates context switches
- Constant-time lookups vs linear iptables chains
- Direct packet manipulation without copying

**Visibility**
- Every packet inspectable at kernel level
- No blind spots (sidecar can't see kernel networking)
- Low overhead observability

**Flexibility**
- Logic updated by loading new eBPF programs
- No kernel recompilation or reboots
- Programmable data plane

**Security**
- Kernel verifier ensures safety
- Kernel-enforced policies harder to bypass than user space
- Identity-based security model

---

## References

- [eBPF Official Documentation](https://ebpf.io/)
- [Cilium Documentation](https://docs.cilium.io/)
- [eBPF and Cilium Architecture](https://medium.com/@addeybob/now-lets-talk-about-cilium-and-how-it-leverages-ebpf-e36bfd98ff53)
- [Kernel eBPF Documentation](https://www.kernel.org/doc/html/latest/bpf/)
