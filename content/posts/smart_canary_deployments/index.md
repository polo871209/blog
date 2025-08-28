---
draft: true
title: "Smart Canary Deployments"
date: 2025-08-24
lastmod: 2025-08-24
description: "Build intelligent progressive delivery pipelines using Argo Rollouts with Prometheus metrics analysis and automatic rollback capabilities for zero-downtime Kubernetes deployments"
summary: "Automated progressive delivery with Argo Rollouts, Prometheus metrics, and istio for safe production deployments"
tags:
  [
    "argo-rollouts",
    "prometheus",
    "canary",
    "kubernetes",
    "devops",
    "progressive-delivery",
  ]
ShowToc: true
TocOpen: true
---

## TL;DR

Canary deployments? Yeah, I'd never build that myself. It's either already set up somewhere and you don't have visibility into it, or nobody bothers with it. So I thought, why not start from scratch and see what's involved? Turns out it's actually pretty straightforward with argo-rollouts.

But not just simple rollouts — we're gonna make it smart. When it sees errors in the metrics, it automatically rolls back.

---

## Start Easy

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: rpc-server
spec:
  replicas: 3 # Hardcoded for example — you shouldn't do this in production
  strategy:
    canary:
      steps:
        - setWeight: 20
        - pause: {}
        - setWeight: 50
        - pause: { duration: 30s }
        - setWeight: 100
  # Selector for deployments
  selector:
    matchLabels:
      app.kubernetes.io/name: rpc-server
  workloadRef:
    apiVersion: apps/v1
    kind: Deployment
    name: rpc-server
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rpc-server
spec:
  # Let Argo Rollout handle this
  replicas: 0
  revisionHistoryLimit: 0
  selector:
    matchLabels:
      app.kubernetes.io/name: rpc-server
  template:
    metadata:
      labels:
        app.kubernetes.io/name: rpc-server
    spec:
      containers:
        - name: rpc-server
          image: rpc-server
```

Well, that's it! Simple rollouts done! _Of course, you'll need argo-rollouts installed._

> **Note:** You can find the complete version in [arch-manifest](https://github.com/polo871209/arch-manifest/tree/main/base/app/rpc-server)

---

Let's start by deploying the first version and checking the rollout status:

```bash
kubectl-argo-rollouts get rollout rpc-server
NAME                                    KIND        STATUS     AGE  INFO
⟳ rpc-server                            Rollout     ✔ Healthy  16s
└──# revision:1
   └──⧉ rpc-server-5ff779f75f           ReplicaSet  ✔ Healthy  16s  stable
      ├──□ rpc-server-5ff779f75f-fbmj8  Pod         ✔ Running  16s  ready:1/1
      ├──□ rpc-server-5ff779f75f-qn27n  Pod         ✔ Running  16s  ready:1/1
      └──□ rpc-server-5ff779f75f-vslc6  Pod         ✔ Running  16s  ready:1/1
```

---

Now let's deploy a new version of the deployment, and you'll see revision 2 like this:

```bash
kubectl-argo-rollouts get rollout rpc-server
NAME                                    KIND        STATUS     AGE  INFO
⟳ rpc-server                            Rollout     ॥ Paused   23h
├──# revision:2
│  └──⧉ rpc-server-b9d7c8675            ReplicaSet  ✔ Healthy  23h  canary
│     └──□ rpc-server-b9d7c8675-6lpxh   Pod         ✔ Running  23h  ready:1/1,restarts:1
└──# revision:1
   └──⧉ rpc-server-5ff779f75f           ReplicaSet  ✔ Healthy  23h  stable
      ├──□ rpc-server-5ff779f75f-fbmj8  Pod         ✔ Running  23h  ready:1/1,restarts:1
      ├──□ rpc-server-5ff779f75f-qn27n  Pod         ✔ Running  23h  ready:1/1,restarts:2
      └──□ rpc-server-5ff779f75f-vslc6  Pod         ✔ Running  23h  ready:1/1,restarts:1
```

---

Let's say you've checked the canary status — now we can move to the next step of promoting the deployment:

```bash
kubectl-argo-rollouts promote rpc-server

# After about 1 minute of waiting, you'll see the second version rolled out completely
kubectl-argo-rollouts get rollout rpc-server
NAME                                   KIND         STATUS        AGE    INFO
⟳ rpc-server                           Rollout      ✔ Healthy     23h
├──# revision:2
│  └──⧉ rpc-server-b9d7c8675           ReplicaSet   ✔ Healthy     23h    stable
│     ├──□ rpc-server-b9d7c8675-ftm8w  Pod          ✔ Running     2m2s   ready:1/1
│     ├──□ rpc-server-b9d7c8675-4cvbz  Pod          ✔ Running     100s   ready:1/1
│     └──□ rpc-server-b9d7c8675-dg4z9  Pod          ✔ Running     69s    ready:1/1
└──# revision:1
   └──⧉ rpc-server-5ff779f75f          ReplicaSet   • ScaledDown  23h
```

### The Problem with Basic Rollouts

Notice something important here — **we're only using replica counts for traffic splitting**, not actual request percentages. When we set `setWeight: 20`, we're telling Argo Rollouts to spin up pods that represent 20% of the total replica count.

**But here's the catch:** This doesn't guarantee that exactly 20% of your traffic hits the canary pods. Load balancing, connection pooling, and client behavior can all skew the actual traffic distribution.

For true traffic-based canary deployments, we need a **service mesh** to control the actual request routing, not just pod counts _(there are other ways, of course)_.

Next up: Adding Istio to get precise traffic control and the metrics we need for smart rollbacks.
