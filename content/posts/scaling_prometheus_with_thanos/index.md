---
title: "Scaling Prometheus with Thanos"
date: 2025-10-02
lastmod: 2025-10-02
description: "Scale Prometheus beyond single-server limits using Thanos sidecar architecture for long-term storage, global querying, and high availability across multiple clusters"
summary: "Deploy Thanos sidecar with Prometheus for unlimited metric retention, multi-cluster querying, and object storage integration"
tags: ["observability", "prometheus", "kubernetes", "monitoring"]
---

## TL;DR

Prometheus works great until it doesn't. Single server, limited retention, no multi-cluster view — you hit the wall fast at scale.

Thanos fixes this by turning Prometheus into a distributed system. Upload metrics to object storage for unlimited retention, query across all clusters from a single interface, and scale horizontally without the usual Prometheus constraints.

---

## The Scaling Problem

Prometheus wasn't built for scale. It's a **single-server system** with local storage, which means:

- **Retention limits** — Your disk fills up, you lose historical data
- **No global view** — Each Prometheus instance is isolated, no cross-cluster queries
- **Sharding creates query fragmentation** — Split your targets across instances, now you query each shard separately
- **Resource constraints** — Memory and disk become bottlenecks as your infrastructure grows

You could increase disk size, reduce retention, or manually shard. But that's treating symptoms, not solving the problem.

**Thanos solves this architecturally** by decoupling storage from query, enabling horizontal scaling and unlimited retention through object storage.

---

## Prometheus Sharding

When a single Prometheus instance can't handle the scrape load, you split targets across multiple instances. The naive approach is manual partitioning:

```yaml
# instance A
scrape_configs:
  - job_name: services-group-a
    static_configs:
      - targets: ["serviceA:8080", "serviceB:8080"]
---
# instance B
scrape_configs:
  - job_name: services-group-b
    static_configs:
      - targets: ["serviceC:8080", "serviceD:8080"]
```

**Problems with manual sharding:**

- **Manual target assignment** — You explicitly decide which services each instance scrapes
- **Query complexity** — Need to query multiple Prometheus instances and merge results yourself

### Hashmod

Prometheus supports automatic sharding using the `hashmod` relabeling action. It hashes target addresses and routes them to specific shards based on modulo arithmetic:

```yaml
# Shard 0 of 2
scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__address__]
        modulus: 2
        target_label: __tmp_hash
        action: hashmod
      - source_labels: [__tmp_hash]
        regex: "0"
        action: keep
---
# Shard 1 of 2
scrape_configs:
  - job_name: kubernetes-pods
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__address__]
        modulus: 2
        target_label: __tmp_hash
        action: hashmod
      - source_labels: [__tmp_hash]
        regex: "1"
        action: keep
```

**Notice `kubernetes_sd_configs`** — Service discovery automatically finds all pods, no manual target configuration needed. New pods appear automatically, removed pods disappear.

**How hashmod sharding works:**

1. **Hash the target address** — Converts `__address__` into a numeric hash
2. **Apply modulus** — `hash % 2` produces `0` or `1` for 2 shards
3. **Filter by shard** — Each instance keeps only targets matching its shard number

**This gives you:**

- **Automatic distribution** — Targets balanced across shards without manual assignment
- **Consistent hashing** — Same target always routes to same shard
- **Easy scaling** — Add more shards by increasing modulus value

**But you still have the query problem** — you need to query all shards and aggregate results. That's where Thanos Query comes in.

---

## Thanos Architecture Overview

Think of Thanos as the orchestration layer that brings all your isolated Prometheus instances together. Each Prometheus continues running independently, but Thanos components connect them into a unified system.

{{< mermaid >}}
graph TB
subgraph "Cluster A"
P1[Prometheus] --- S1[Sidecar]
end

    subgraph "Cluster B"
        P2[Prometheus] --- S2[Sidecar]
    end

    S1 --> |gRPC| Q[Thanos Query]
    S2 --> |gRPC| Q
    S1 --> |Upload blocks| OBJ[(Object Storage)]
    S2 --> |Upload blocks| OBJ

    OBJ --> SG[Store Gateway]
    SG --> |gRPC| Q

    OBJ --> C[Compactor]

    Q --> |Unified PromQL| G[Grafana/Users]

    style Q fill:#74c7ec,color:#000
    style OBJ fill:#f9e2af,color:#000
    style G fill:#a6e3a1,color:#000

{{< /mermaid >}}

**Component roles:**

- **Sidecar** — Runs alongside each Prometheus, uploads blocks to object storage and serves real-time queries via gRPC
- **Thanos Query** — Aggregates data from all sidecars and store gateways, presents unified PromQL interface
- **Store Gateway** — Provides query access to historical data in object storage
- **Compactor** — Downsamples and compacts historical data to optimize storage
- **Ruler** — Evaluates recording and alerting rules on global data (not shown in diagram)

**We'll focus on sidecar + Thanos Query** — the foundation that solves immediate scaling problems. Everything else builds on this base.

---

## Deploying Prometheus with Thanos Sidecar

### Prometheus Configuration

Configure Prometheus with external labels and specific block durations:

```yaml
global:
  external_labels:
    cluster: production-us-east
    replica: prometheus-0
```

**External labels identify the data source** — Thanos Query uses these to deduplicate metrics when you run multiple Prometheus replicas for high availability.

### Container Arguments

The key Prometheus arguments when running with Thanos:

```yaml
spec:
  containers:
    - name: prometheus
      image: quay.io/prometheus/prometheus:v2.54.1
      args:
        - --config.file=/etc/prometheus/prometheus.yaml
        - --storage.tsdb.path=/var/prometheus
        - --storage.tsdb.min-block-duration=2h
        - --storage.tsdb.max-block-duration=2h
        - --web.enable-lifecycle
```

**Block duration settings** control how Prometheus chunks its time-series data:

- `min-block-duration=2h` and `max-block-duration=2h` force consistent 2-hour blocks
- Thanos compactor expects uniform block sizes for efficient downsampling
- All Prometheus instances must use the same block duration

**The `web.enable-lifecycle` flag** allows hot-reloading configuration without restarts.

### Sidecar Configuration

Run the Thanos sidecar alongside Prometheus:

```yaml
- name: thanos-sidecar
  image: quay.io/thanos/thanos:v0.36.1
  args:
    - sidecar
    - --prometheus.url=http://localhost:9090
    - --tsdb.path=/var/prometheus
    - --objstore.config-file=/etc/thanos/objstore.yaml
    - --grpc-address=0.0.0.0:10901
```

**What the sidecar does:**

- **Reads Prometheus TSDB** from shared volume at `/var/prometheus`
- **Uploads completed blocks** to object storage automatically
- **Serves real-time queries** via gRPC on port 10901
- **Provides metadata** about available time series to Thanos Query

**Shared volume is critical** — both Prometheus and sidecar containers must mount the same TSDB path. The sidecar reads completed blocks and uploads them to object storage.

### Object Storage Configuration

Create the object storage configuration:

```yaml
type: S3
config:
  bucket: thanos-metrics
  endpoint: s3.amazonaws.com
  region: us-east-1
```

Supports S3, GCS, Azure Blob Storage, and more. The sidecar uploads 2-hour blocks continuously as Prometheus completes them — no manual intervention required.

---

## Deploying Thanos Query

Thanos Query aggregates data from all Prometheus instances:

```yaml
- name: thanos-query
  image: quay.io/thanos/thanos:v0.36.1
  args:
    - query
    - --http-address=0.0.0.0:10902
    - --store=prometheus-0.prometheus:10901
    - --store=prometheus-1.prometheus:10901
    - --store=thanos-store-gateway:10901
    - --query.replica-label=replica
    - --query.auto-downsampling
```

**How it works:**

- **`--store` endpoints** define where to fetch data from — sidecars for recent data, store gateways for historical data
- **`--query.replica-label=replica`** tells Thanos Query which external label identifies Prometheus replicas for deduplication
- **`--query.auto-downsampling`** automatically selects appropriate data resolution based on query time range

**Deduplication** happens when you run multiple Prometheus replicas with the same `cluster` label but different `replica` labels. Thanos Query merges identical metrics and removes duplicates.

---

## Querying Across Clusters

Once deployed, point Grafana or your query tool to Thanos Query instead of individual Prometheus instances:

```yaml
# Grafana datasource configuration
apiVersion: 1
datasources:
  - name: Thanos
    type: prometheus
    url: http://thanos-query:9090
    access: proxy
```

Now you can query across all clusters with standard PromQL:

```promql
# Query metrics from all clusters
rate(http_requests_total[5m])

# Query specific cluster using external labels
rate(http_requests_total{cluster="production-us-east"}[5m])

# Compare metrics across clusters
sum by (cluster) (rate(http_requests_total[5m]))
```

**Thanos Query handles:**

- **Deduplication** — Removes duplicate samples from HA Prometheus pairs
- **Aggregation** — Merges results from multiple stores into single response
- **Downsampling selection** — Automatically uses appropriate resolution based on query time range

---

## Adding Store Gateway for Historical Data

The sidecar only serves recent data still in Prometheus TSDB. For queries beyond local retention, deploy the store gateway:

```yaml
- name: thanos-store-gateway
  image: quay.io/thanos/thanos:v0.36.1
  args:
    - store
    - --data-dir=/var/thanos/store
    - --objstore.config-file=/etc/thanos/objstore.yaml
    - --grpc-address=0.0.0.0:10901
```

**What the store gateway does:**

- **Indexes object storage blocks** for fast query access
- **Caches frequently accessed data** locally to reduce object storage API calls
- **Serves unlimited retention** — Query years of historical data without Prometheus disk constraints

Point Thanos Query to the store gateway by adding `--store=thanos-store-gateway:10901` to its arguments. Now queries can span both recent data (from sidecars) and historical data (from store gateway) seamlessly.

---

## Adding Compactor for Storage Optimization

The compactor optimizes long-term storage:

```yaml
- name: thanos-compactor
  image: quay.io/thanos/thanos:v0.36.1
  args:
    - compact
    - --data-dir=/var/thanos/compactor
    - --objstore.config-file=/etc/thanos/objstore.yaml
    - --retention.resolution-raw=30d
    - --retention.resolution-5m=180d
    - --retention.resolution-1h=0d
```

**What the compactor does:**

- **Downsamples data** — Creates 5-minute and 1-hour resolution blocks from raw data
- **Compacts blocks** — Merges small blocks into larger ones for storage efficiency
- **Applies retention policies** — Deletes old blocks based on resolution-specific retention
- **Removes duplicates** — Deduplicates overlapping blocks from HA Prometheus setups

**Retention strategy:**

- `--retention.resolution-raw=30d` — Keep full-resolution data for 30 days
- `--retention.resolution-5m=180d` — Keep 5-minute downsampled data for 180 days
- `--retention.resolution-1h=0d` — Keep 1-hour downsampled data indefinitely

**Critical:** Only run **one compactor instance** per object storage bucket. Multiple compactors will conflict and corrupt data.

---

## Wrapping Up

- **Handles unlimited retention** — Object storage removes local disk constraints
- **Provides global querying** — Single PromQL interface across all clusters
- **Enables high availability** — Automatic deduplication with replica labels
- **Optimizes storage costs** — Downsampling and compaction reduce storage requirements
- **Scales horizontally** — Add more sidecars, Thanos Query instances, or store gateways as needed

---

## 📚 References

- [Official Thanos documentation](https://thanos.io/tip/thanos/getting-started.md/)
- [Thanos architecture overview](https://thanos.io/tip/thanos/design.md/)
- [Prometheus storage documentation](https://prometheus.io/docs/prometheus/latest/storage/)
- [Thanos GitHub repository](https://github.com/thanos-io/thanos)
