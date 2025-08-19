---
title: "apko: Declarative Container Image Builder"
date: 2025-08-19T10:24:33+08:00
description: "apko builds minimal, secure container images from APK packages using declarative YAML configuration"
tags: ["apko", "containers", "security", "chainguard", "wolfi", "alpine"]
ShowToc: true
TocOpen: true
---

## TL;DR

Ever wonder how [Wolfi](../wolfi_made_easy) builds their own base images?

**[apko](https://github.com/chainguard-dev/apko)** is Chainguard's declarative YAML-based container image builder. Instead of writing Dockerfiles with `FROM scratch` and layers of `RUN apk add`, you define packages, users, and filesystem layout in a single YAML config file.

apko then builds single-layer OCI images directly from APK packages with built-in SBOM generation and multi-arch support. Perfect for creating your own minimal Wolfi or Alpine-based images with reproducible builds.

---

## 🏗️ Architecture

**apko** builds images directly from APK packages instead of layering filesystem changes:

```
Source packages → apk resolution → single OCI layer → signed image + SBOM
```

**Key differences:**

- **Single layer output** — No intermediate layers or caching complexity
- **Declarative config** — YAML-defined image specification
- **Built-in signing** — Integrates with Sigstore/Cosign
- **Reproducible builds** — When package versions are pinned

---

## 🛠️ Basic Usage

### 📝 Configuration Example

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

### 🚀 Build Process

```bash
# Build and load into Docker
apko build nginx.yaml nginx:latest nginx.tar
docker load < nginx.tar
docker run --platform linux/arm64 -p 8080:80 nginx:latest-arm64
```

### 🔗 Supply Chain Features

```bash
# Check vulnerabilities in SBOM
grype sbom:sbom-index.spdx.json

# Optionally sign with Cosign
cosign sign docker-username/demo-container
```

---

## 🔄 Reproducibility

> **⚠️ Important:** apko reproducibility requires **explicit version pinning**.

```yaml
# ❌ Non-reproducible
packages:
  - nginx

# ✅ Reproducible
packages:
  - nginx=1.26.1-r0
```

### 📋 Lockfile Workflow

```bash
# Generate lockfile with exact versions
apko lock nginx.yaml
# Build from lockfile (fully reproducible)
apko build nginx.yaml --lockfile nginx.lock.json nginx:v1.0.0 nginx.tar
```

---

## 📚 References

- **🏠 GitHub:** https://github.com/chainguard-dev/apko
- **📖 Examples:** https://github.com/chainguard-dev/apko/tree/main/examples
- **🐺 Wolfi Packages:** https://packages.wolfi.dev/os
- **📋 Chainguard Images:** https://github.com/chainguard-images

**apko provides a declarative alternative** to Dockerfile-based builds, optimized for **security-conscious container deployments** where minimal attack surface and supply chain transparency are priorities.
