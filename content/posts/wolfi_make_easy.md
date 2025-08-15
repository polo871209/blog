---
date: "2025-08-14T22:08:48+08:00"
title: "Wolfi Make Easy"
tags: ["container", "wolfi", "security", "docker", "python"]
description: "A practical guide to using Wolfi - the minimal, secure container base image that gives you package management without the bloat"
---

## 📖 Table of Contents

- [🔍 What Makes Wolfi Special?](#-what-makes-wolfi-special)
- [🚀 Real-World Example: Python Service with UV](#-real-world-example-python-service-with-uv)
- [🔧 Breaking Down the Magic](#-breaking-down-the-magic)
- [🔄 Why I Switched from Alpine](#-why-i-switched-from-alpine)
- [🏁 The Bottom Line](#-the-bottom-line)
- [📚 References](#-references)

---

## TL;DR

We all know about scratch – the empty container image. With literally nothing in it, you can run binaries with zero overhead while still utilizing every advantage containers have to offer.

However, this also means debugging feels like trying to fix a car with the hood welded shut and adding any libraries can be a real nightmare. No shell, no package manager, no nothing.

So here I am, introducing **[Wolfi](https://github.com/wolfi-dev)** – a minimal container image that's both tiny and secure, yet still gives you the benefits of a proper package manager.

## 🔍 What Makes Wolfi Special?

Think of Wolfi as the sweet spot between `scratch` and bloated base images like Ubuntu or Alpine. It's designed from the ground up for containers, which means:

- **Tiny footprint** — We're talking megabytes, not gigabytes
- **APK-compatible package manager** — Familiar syntax, but it's actually Wolfi's own package ecosystem
- **Security-first** — No legacy baggage, modern toolchain with dedicated [security advisories](https://github.com/wolfi-dev/advisories)
- **Glibc-based** — Better compatibility than musl-based alternatives

> **Key Insight:** While Wolfi uses `apk` commands that look familiar, it's not actually using Alpine's packages. Wolfi maintains its own [OS repository](https://github.com/wolfi-dev/os) with packages built specifically for security and minimal attack surface.

## 🚀 Real-World Example: Python Service with UV

Let me show you how Wolfi shines in practice. Here's a multi-stage Dockerfile that builds a Python service with UV (you can find my complete project at [polo871209/rpc](https://github.com/polo871209/rpc/blob/main/client/Dockerfile)):

```dockerfile
# syntax=docker/dockerfile:1

FROM cgr.dev/chainguard/wolfi-base:latest AS builder

RUN apk add --no-cache \
      ca-certificates \
      py3.13-pip \
      python-3.13 \
      uv

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen

COPY app/ ./app/

# Runtime stage
FROM cgr.dev/chainguard/wolfi-base:latest

USER nonroot

RUN apk add --no-cache \
      ca-certificates \
      python-3.13 \
      tzdata

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH="/app" \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder --chown=nonroot:nonroot /app/app/ ./app/

EXPOSE 8000
```

## 🔧 Breaking Down the Magic

### 🛠️ Modern Tooling

Notice how Wolfi packages make modern toolchain development a breeze?

```bash
RUN apk add --no-cache \
      ca-certificates \
      py3.13-pip \
      python-3.13 \
      uv
```

**Compare this to Google's Distroless images**, where adding a single package means either:

- Starting from a different base image and copying everything over *(hello, massive multi-stage complexity)*
- Manually downloading and installing packages without a package manager *(debugging nightmare)*
- Or just giving up and going back to a full OS image

> **💡 The Distroless Problem:** You're essentially back to the scratch problem - secure but painfully limiting. Wolfi gives you the security benefits without the "why can't I just install one simple package?" frustration.

While the syntax looks like Alpine's `apk`, you're actually pulling from Wolfi's curated package repository. Each package is built with security in mind and maintained through their [OS project](https://github.com/wolfi-dev/os). No more outdated packages or security vulnerabilities lingering for months.

### 🔒 Security by Default

The runtime stage shows Wolfi's security-first design:

```dockerfile
USER nonroot
```

Wolfi comes with a `nonroot` user pre-configured, so you're not running as root by default. This is the kind of sensible security practice that should be standard but often isn't.

> **🛡️ Zero-Day Protection:** The real security magic happens at the package level. Wolfi's [security advisories system](https://github.com/wolfi-dev/advisories) proactively tracks and patches vulnerabilities before they become problems.

Unlike traditional distributions that wait for CVEs to be published, Wolfi monitors upstream sources and rebuilds packages immediately when security issues are discovered.

**This means potential zero-day vulnerabilities get patched in hours, not days or weeks.** When a security researcher finds a flaw, Wolfi's automated systems can rebuild and redistribute the fixed package before attackers even know the vulnerability exists.

## 🔄 Why I Switched from Alpine

I used to be an Alpine devotee, but Wolfi won me over for a few key reasons:

1. **Better compatibility** — Glibc means fewer "works on my machine" moments
2. **Dedicated security focus** — While Alpine reacts to CVEs, Wolfi proactively tracks and patches vulnerabilities through their [advisories system](https://github.com/wolfi-dev/advisories)
3. **Purpose-built packages** — Instead of repurposing server packages, Wolfi builds everything specifically for containers
4. **Faster security updates** — When a vulnerability hits, Wolfi's automated rebuild system pushes fixes in hours, not days

> **💡 Key Difference:** The `apk` syntax might look the same, but under the hood you're getting a completely different (and more secure) package ecosystem.

## 🏁 The Bottom Line

Wolfi feels like what container base images should have been from the start — **minimal but practical, secure but usable**. It's not trying to be everything to everyone; it's focused on doing the container base image job really well.

If you're tired of choosing between security and convenience, or between size and functionality, give Wolfi a shot. Your future self *(and your security team)* will thank you.

## 📚 References

- [Wolfi Overview - Chainguard Education](https://edu.chainguard.dev/open-source/wolfi/overview/)
- [Google Distroless Container Images](https://github.com/GoogleContainerTools/distroless)
- [Wolfi OS Package Repository](https://github.com/wolfi-dev/os)
- [Wolfi Security Advisories](https://github.com/wolfi-dev/advisories)
