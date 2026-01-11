---
title: "Kubernetes DNS: Why FQDNs Matter"
date: 2026-01-11
lastmod: 2026-01-11
description: "Deep dive into Kubernetes DNS resolution, CoreDNS lookup behavior, and why using FQDNs with trailing dots significantly improves performance"
summary: "Learn how Kubernetes DNS resolution works, the critical difference between short names and FQDNs, and why trailing dots reduce DNS queries from 4 to 1"
tags: ["kubernetes", "dns", "coredns", "networking", "performance"]
---

## TL;DR

In Kubernetes, the `ndots:5` setting causes DNS queries for names with fewer than 5 dots to iterate through all search domains. This means using service name like `api` triggers 4 DNS queries instead of 1. Using a trailing dot FQDN `api.app.svc.cluster.local.` forces absolute resolution, reducing DNS load by 75%.

---

## How Kubernetes DNS Works

### DNS Configuration in Pods

Every pod gets a `/etc/resolv.conf` file with CoreDNS settings:

```bash
kubectl exec <pod-name> -- cat /etc/resolv.conf
```

<pre><code><span style="color:#94e2d5">nameserver</span> 192.168.194.138
<span style="color:#94e2d5">search</span> default.svc.cluster.local svc.cluster.local cluster.local
<span style="color:#94e2d5">options</span> ndots:5
</code></pre>

Three critical components:
- **nameserver** — CoreDNS service IP
- **search** — DNS search domains appended to incomplete hostnames
- **ndots:5** — Names with fewer than 5 dots are treated as relative

---

## Understanding ndots: The Key to DNS Performance

The `ndots:5` setting determines how the resolver treats domain names:

**How it works:**
1. Resolver counts the dots in the hostname
2. If dots **< 5** → treat as **relative name** → try appending each search domain
3. If dots **≥ 5** → treat as **absolute name** → query directly
4. If trailing dot (`.`) present → **always absolute** → query directly

**Why `api.app.svc.cluster.local` (4 dots) is problematic:**
- 4 dots < 5 (ndots threshold)
- Resolver treats it as relative
- Appends search domains: `api.app.svc.cluster.local.default.svc.cluster.local`, then `api.app.svc.cluster.local.svc.cluster.local`, etc.
- Finally tries absolute: `api.app.svc.cluster.local`
- **Result: 4 queries instead of 1**

**Solution:** Add trailing dot → `api.app.svc.cluster.local.`
- Trailing dot signals "this is absolute"
- Resolver skips search domain iteration
- **Result: 1 query**

---

## Performance Impact

| Query Type | Example | DNS Queries |
|------------|---------|-------------|
| Short name | `api` | 1-4 |
| FQDN no dot | `api.app.svc.cluster.local` | 4 |
| **FQDN with dot** | `api.app.svc.cluster.local.` | **1** |

For a service handling 1000 requests/second:
- **Without trailing dot**: 4000 DNS queries/sec
- **With trailing dot**: 1000 DNS queries/sec

**75% reduction in DNS load**, resulting in lower latency, reduced CoreDNS CPU/memory, and better cluster performance.

---

## CoreDNS Architecture: A Centralized Bottleneck

CoreDNS runs as a **Deployment**, not a DaemonSet.

```bash
kubectl get deployment coredns -n kube-system
```

<pre><code><span style="color:#94e2d5">NAME</span>      <span style="color:#94e2d5">READY</span>   <span style="color:#94e2d5">UP-TO-DATE</span>   <span style="color:#94e2d5">AVAILABLE</span>
<span style="color:#f9e2af">coredns</span>   2/2     2            2
</code></pre>

Typical default: **2 replicas** for the entire cluster.

**Consequences:**

**Cross-node network traffic** — Most pods query CoreDNS pods on different nodes, consuming inter-node bandwidth

---

## Suggestions

1. **Always use trailing dots** — `api.app.svc.cluster.local.` for 1 query
2. **Deploy NodeLocal DNSCache** — Eliminate cross-node DNS traffic
3. **Scale CoreDNS appropriately** — More replicas for larger clusters
4. **Consider lowering ndots** — Set to 2-3 for internal-only services

---

## References

- [Kubernetes DNS Specification](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [NodeLocal DNSCache](https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/)
- [ndots and DNS Resolution](https://pracucci.com/kubernetes-dns-resolution-ndots-options-and-why-it-may-affect-application-performances.html)
