---
title: "Smart Canary Deployments"
date: 2025-08-31
lastmod: 2025-09-15
description: "Build intelligent progressive delivery pipelines using Argo Rollouts with Prometheus metrics analysis and automatic rollback capabilities for zero-downtime Kubernetes deployments"
summary: "Automated progressive delivery with Argo Rollouts, Prometheus metrics, and istio for safe production deployments"
tags: ["kubernetes", "deployment", "observability", "cicd"]
ShowToc: true
TocOpen: true
---

## TL;DR

Canary deployments? Yeah, I'd never build that myself. It's either already set up somewhere and you don't have visibility into it, or nobody bothers with it. So I thought, why not start from scratch and see what's involved? Turns out it's actually pretty straightforward with argo-rollouts.

But not just simple rollouts — we're gonna make it smart. When it sees errors in the metrics, it automatically aborts the deployment and stops traffic to the failing version.

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

<pre><code class="language-bash">$ <span style="color: #cba6f7;">kubectl-argo-rollouts</span> get rollout rpc-server
NAME                                    KIND        STATUS     AGE  INFO
<span style="color: #f38ba8;">⟳ rpc-server</span>                            Rollout     <span style="color: #a6e3a1;">✔ Healthy</span>  16s
└──# revision:1
   └──<span style="color: #f38ba8;">⧉ rpc-server-5ff779f75f</span>           ReplicaSet  <span style="color: #a6e3a1;">✔ Healthy</span>  16s  stable
      ├──□ rpc-server-5ff779f75f-fbmj8  Pod         <span style="color: #a6e3a1;">✔ Running</span>  16s  ready:1/1
      ├──□ rpc-server-5ff779f75f-qn27n  Pod         <span style="color: #a6e3a1;">✔ Running</span>  16s  ready:1/1
      └──□ rpc-server-5ff779f75f-vslc6  Pod         <span style="color: #a6e3a1;">✔ Running</span>  16s  ready:1/1
</code></pre>

---

Now let's deploy a new version of the deployment, and you'll see revision 2 like this:

<pre><code class="language-bash">$ <span style="color: #cba6f7;">kubectl-argo-rollouts</span> get rollout rpc-server
NAME                                    KIND        STATUS     AGE  INFO
<span style="color: #f38ba8;">⟳ rpc-server</span>                            Rollout     <span style="color: #fab387;">॥ Paused</span>   23h
├──# revision:2
│  └──<span style="color: #f38ba8;">⧉ rpc-server-b9d7c8675</span>            ReplicaSet  <span style="color: #a6e3a1;">✔ Healthy</span>  23h  canary
│     └──□ rpc-server-b9d7c8675-6lpxh   Pod         <span style="color: #a6e3a1;">✔ Running</span>  23h  ready:1/1,restarts:1
└──# revision:1
   └──<span style="color: #f38ba8;">⧉ rpc-server-5ff779f75f</span>           ReplicaSet  <span style="color: #a6e3a1;">✔ Healthy</span>  23h  stable
      ├──□ rpc-server-5ff779f75f-fbmj8  Pod         <span style="color: #a6e3a1;">✔ Running</span>  23h  ready:1/1,restarts:1
      ├──□ rpc-server-5ff779f75f-qn27n  Pod         <span style="color: #a6e3a1;">✔ Running</span>  23h  ready:1/1,restarts:2
      └──□ rpc-server-5ff779f75f-vslc6  Pod         <span style="color: #a6e3a1;">✔ Running</span>  23h  ready:1/1,restarts:1
</code></pre>

---

Let's say you've checked the canary status — now we can move to the next step of promoting the deployment:

<pre><code class="language-bash">$ <span style="color: #cba6f7;">kubectl-argo-rollouts</span> promote rpc-server

<span style="color: #585b70;"># After about 1 minute of waiting, you'll see the second version rolled out completely</span>
$ <span style="color: #cba6f7;">kubectl-argo-rollouts</span> get rollout rpc-server
NAME                                   KIND         STATUS        AGE    INFO
<span style="color: #f38ba8;">⟳ rpc-server</span>                           Rollout      <span style="color: #a6e3a1;">✔ Healthy</span>     23h
├──# revision:2
│  └──<span style="color: #f38ba8;">⧉ rpc-server-b9d7c8675</span>           ReplicaSet   <span style="color: #a6e3a1;">✔ Healthy</span>     23h    stable
│     ├──□ rpc-server-b9d7c8675-ftm8w  Pod          <span style="color: #a6e3a1;">✔ Running</span>     2m2s   ready:1/1
│     ├──□ rpc-server-b9d7c8675-4cvbz  Pod          <span style="color: #a6e3a1;">✔ Running</span>     100s   ready:1/1
│     └──□ rpc-server-b9d7c8675-dg4z9  Pod          <span style="color: #a6e3a1;">✔ Running</span>     69s    ready:1/1
└──# revision:1
   └──<span style="color: #f38ba8;">⧉ rpc-server-5ff779f75f</span>          ReplicaSet   <span style="color: #585b70;">• ScaledDown</span>  23h
</code></pre>

**What happens during rollout:**

{{< mermaid >}}
graph TD
A[100% Stable, 0% Canary] --> B[setWeight<br/>80% Stable, 20% Canary]
B --> C[Pause<br/>Manual promotion required]
C --> D[setWeight<br/>50% Stable, 50% Canary]
D --> E[Wait 30 seconds]
E --> F[setWeight 100<br/>0% Stable, 100% Canary]
F --> G[Rollout Complete<br/>Canary becomes new Stable]
{{< /mermaid >}}

### The Problem with Basic Rollouts

Notice something important here — **we're only using replica counts for traffic splitting**, not actual request percentages. When we set `setWeight: 20`, we're telling Argo Rollouts to spin up pods that represent 20% of the total replica count.

**But here's the catch:** This doesn't guarantee that exactly 20% of your traffic hits the canary pods. Load balancing, connection pooling, and client behavior can all skew the actual traffic distribution.

For true traffic-based canary deployments, we need a **service mesh** to control the actual request routing, not just pod counts _(there are other ways, of course)_.

## Istio

There are many ways to implement traffic routing with rollouts — I just love Istio. With the combination of `VirtualService` and `DestinationRule`, we can control actual request traffic percentages, not just pod counts.

**Istio's service mesh intercepts all traffic** and routes it according to our weight specifications. When Argo Rollouts updates these weights during a canary deployment, Istio ensures the exact traffic distribution we want.

```yaml
# mesh.yaml
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: rpc-server
spec:
  hosts:
    - rpc-server
  http:
    - name: primary
      route:
        - destination:
            host: rpc-server
            subset: stable
          weight: 100
        - destination:
            host: rpc-server
            subset: canary
          weight: 0
---
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: rpc-server
spec:
  host: rpc-server.arch.svc.cluster.local
  subsets:
    - name: canary
      labels:
        app.kubernetes.io/name: rpc-server
    - name: stable
      labels:
        app.kubernetes.io/name: rpc-server
```

Now add the traffic routing policy to your rollout:

```yaml
spec:
  replicas: 3
  strategy:
    canary:
      trafficRouting:
        istio:
          virtualService:
            name: rpc-server
            routes:
              - primary
          destinationRule:
            name: rpc-server
            canarySubsetName: canary
            stableSubsetName: stable
```

**Bonus:** Istio gives you observability into this traffic split through metrics and distributed tracing, so you can see exactly how your canary is performing under real load.

## Analysis

This is where it gets smart. Instead of manually checking metrics and deciding whether to promote or rollback, we let **Prometheus metrics decide automatically**.

The `ClusterAnalysisTemplate` defines what "success" looks like, and Argo Rollouts will continuously monitor these metrics during the canary phase.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ClusterAnalysisTemplate
metadata:
  name: success-rate
spec:
  args:
    - name: service_name
    - name: prometheus_address
      value: http://prometheus-server.observability.svc.cluster.local
    - name: success_rate_threshold
      value: "0.95"
  metrics:
    - name: success-rate
      interval: 5m
      successCondition: result[0] >= {{args.success_rate_threshold}}
      failureLimit: 3
      provider:
        prometheus:
          address: "{{args.prometheus_address}}"
          query: |
            sum(irate(istio_requests_total{reporter="destination",destination_service_name="{{args.service_name}}",response_code!~"5.*"}[5m])) / 
            sum(irate(istio_requests_total{reporter="destination",destination_service_name="{{args.service_name}}"}[5m]))
```

Now integrate this analysis template into your rollout strategy:

```yaml
spec:
  strategy:
    canary:
      abortScaleDownDelaySeconds: 600 # Scale down failed canary after 10 minutes
      analysis:
        templates:
          - templateName: success-rate
            clusterScope: true
        startingStep: 2 # Begin analysis after first pause
        args:
          - name: service_name
            value: rpc-server
      trafficRouting:
        istio:
          virtualService:
            name: rpc-server
            routes:
              - primary
          destinationRule:
            name: rpc-server
            canarySubsetName: canary
            stableSubsetName: stable
      steps:
        - setWeight: 20
        - pause: {}
        - setWeight: 50
        - pause: { duration: 30s }
        - setWeight: 100
```

**What this does:**

- **Success rate monitoring** — Queries Istio metrics to calculate the percentage of successful requests (non-5xx responses)
- **Automatic abort on failure** — If success rate drops below 95% for 3 consecutive checks, rollout automatically aborts and stops traffic to canary
- **Continuous analysis** — Runs every 5 minutes during the canary phase, ensuring real-time monitoring
- **Smart traffic control** — Prevents bad deployments from receiving production traffic

Here's what the rollout status looks like with analysis running and failed:

<pre><code class="language-bash">$ <span style="color: #cba6f7;">kubectl-argo-rollouts</span> get rollout rpc-server
NAME                                   KIND         STATUS        AGE    INFO
<span style="color: #f38ba8;">⟳ rpc-server</span>                           Rollout      <span style="color: #fab387;">॥ Paused</span>      4d18h
└──# revision:2
   ├──<span style="color: #f38ba8;">⧉ rpc-server-b9d7c8675</span>           ReplicaSet   <span style="color: #a6e3a1;">✔ Healthy</span>     4d18h  stable
   │  ├──□ rpc-server-b9d7c8675-ftm8w  Pod          <span style="color: #a6e3a1;">✔ Running</span>     3d18h  ready:1/1
   │  ├──□ rpc-server-b9d7c8675-4cvbz  Pod          <span style="color: #a6e3a1;">✔ Running</span>     3d18h  ready:1/1
   │  └──□ rpc-server-b9d7c8675-dg4z9  Pod          <span style="color: #a6e3a1;">✔ Running</span>     3d18h  ready:1/1
   ├──<span style="color: #f9e2af;">α</span> rpc-server-b9d7c8675-2         AnalysisRun  <span style="color: #f38ba8;">⚠ Error</span>       3d18h  <span style="color: #f38ba8;">⚠ 5</span>
   └──<span style="color: #f9e2af;">α</span> rpc-server-b9d7c8675-2.1       AnalysisRun  <span style="color: #a6e3a1;">✔ Successful</span>  3d18h  <span style="color: #a6e3a1;">✔ 1</span>
</code></pre>

Notice the `AnalysisRun` entries showing the automated analysis results — one failed with errors, one succeeded. This is your canary deployment making intelligent decisions based on real metrics, automatically aborting when things go wrong and keeping traffic on the stable version.

In this case I identified and resolved the underlying issue, then continued with the rollout promotion.

---

## Wrapping Up

That's it! You've built a smart canary deployment system that:

- **Uses Istio for precise traffic control** — Real percentage-based routing, not just pod counts
- **Monitors real metrics with Prometheus** — Success rates, error rates, whatever matters to your app
- **Automatically prevents bad deployments** — Stops traffic to failing versions without manual intervention
- **Integrates seamlessly** — Works with your existing Kubernetes setup

The beauty of this approach is that it **removes the guesswork**. Instead of manually deciding whether a canary is "good enough," you define what success looks like upfront and let the system automatically abort failed deployments while keeping traffic on the stable version.

Just data-driven, automated progressive delivery with intelligent failure handling.

---

## 📚 References

- [Official Argo Rollouts documentation](https://argoproj.github.io/argo-rollouts/)
- [Argo Rollouts with Istio tutorial](https://www.youtube.com/watch?v=tnB0TwEqNFA&t=958s)

---

{{< alert "no" >}}
**🇲🇾 Happy Merdeka Day!** Malaysia celebrates 68 years of independence today!
{{< /alert >}}
