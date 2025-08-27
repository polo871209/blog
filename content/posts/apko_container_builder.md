---
title: "Apko: Container Image Builder"
date: 2025-08-19T10:24:33+08:00
description: "apko builds minimal, secure container images from APK packages using declarative YAML configuration"
tags: ["apko", "containers", "security", "chainguard", "wolfi", "alpine"]
---

## TL;DR

Ever wonder how to build your own [Wolfi](wolfi_made_easy) base images?

**[apko](https://github.com/chainguard-dev/apko)** is Chainguard's declarative container image builder that replaces Dockerfiles with YAML configuration. Instead of imperative `RUN` commands, you declare packages, users, and filesystem layout — apko handles the rest.

The result? **Single-layer images** built directly from APK packages with automatic SBOM generation and multi-arch support. Perfect for security-conscious teams building reproducible base images, though it can't replace Docker entirely for complex application builds.

---

## Basic Usage

Let's jump right into the practical stuff — we'll cover the 'why apko?' discussion after you see it in action.

### Nginx image

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/chainguard-dev/apko/main/pkg/build/types/schema.json
contents:
  keyring:
    - https://packages.wolfi.dev/os/wolfi-signing.rsa.pub
  repositories:
    - https://packages.wolfi.dev/os
  packages:
    - wolfi-baselayout
    - nginx

entrypoint:
  type: service-bundle
  services:
    nginx: /usr/sbin/nginx -c /etc/nginx/nginx.conf -g "daemon off;"

environment:
  PATH: /usr/local/sbin:/usr/local/bin:/usr/bin:/usr/sbin:/sbin:/bin

accounts:
  groups:
    - groupname: nginx
      gid: 10000
  users:
    - username: nginx
      uid: 10000

paths:
  - path: /run/nginx
    type: directory
    uid: 10000
    gid: 10000
    permissions: 0o755
  - path: /etc/nginx/http.d/default.conf
    type: hardlink
    source: /etc/nginx/nginx.conf.default
    uid: 10000
    gid: 10000
    permissions: 0o644

work-dir: /usr/share/nginx

archs:
  - x86_64
  - aarch64
```

> **Syntax:** check schema https://raw.githubusercontent.com/chainguard-dev/apko/main/pkg/build/types/schema.json for all the reference

### Build Process

```bash
# Build and load into Docker
apko build nginx.yaml nginx:latest nginx.tar
docker load < nginx.tar
docker run --platform linux/arm64 -p 8080:80 nginx:latest-arm64
```

### Supply Chain Features

```bash
# Check vulnerabilities in SBOM
grype sbom:sbom-index.spdx.json
 ✔ Scanned for vulnerabilities     [0 vulnerability matches]
   ├── by severity: 0 critical, 0 high, 0 medium, 0 low, 0 negligible
   └── by status:   0 fixed, 0 not-fixed, 0 ignored

# Optionally sign with Cosign
cosign sign docker-username/demo-container
```

> 🤯 Yup, Zero vulnerabilities detected

---

## Reproducibility

```yaml
# ❌ Non-reproducible
packages:
  - nginx

# ✅ Reproducible
packages:
  - nginx=1.26.1-r0
```

### Lockfile Workflow

```bash
# Generate lockfile with exact versions
apko lock nginx.yaml
# Build from lockfile (fully reproducible)
apko build nginx.yaml --lockfile nginx.lock.json nginx:v1.0.0 nginx.tar
```

---

## The Declarative Advantage

**The declarative advantage** — apko configurations are **deterministic blueprints** rather than imperative scripts. No more layer cache mysteries or "works on my machine" builds.

Notice how the nginx example above contains zero shell scripts? That's apko's strength and limitation rolled into one. **You define what packages you want, not how to install them.** This makes apko excellent for creating secure base images like Python or Node.js containers, but it can't replace Docker entirely — complex application builds still need imperative steps.

**The foundation difference** is key here. Traditional containers start with bloated base images like Ubuntu or Alpine. apko starts with `wolfi-baselayout` — just the essential Linux filesystem structure. Everything else is explicitly declared packages.

**Single-layer simplicity** eliminates Docker's layer caching complexity. Your YAML config becomes a pure package-to-image transformation. **Reproducible by design** — lock your package versions once, build identically across all environments and architectures.

**Supply chain transparency** comes built-in through automatic SBOM generation and package verification. Every dependency is tracked, signed, and auditable — critical for security-conscious deployments.

## Will I Actually Use It?

For building applications, apko adds a complexity layer — the short answer is **yes, but selectively**.

I previously maintained a dedicated repository in my organization just for building all the base images used across GitLab CI and application deployments. apko would be perfect for that use case — standardized, reproducible base images with built-in security scanning.

---

## 📚 References

- **GitHub:** https://github.com/chainguard-dev/apko
- **Examples:** https://github.com/chainguard-dev/apko/tree/main/examples
- **Wolfi Packages:** https://packages.wolfi.dev/os
- **Chainguard Images:** https://github.com/chainguard-images
