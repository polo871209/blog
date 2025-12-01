---
title: "Understanding Bazel with Distroless"
date: 2025-11-30
lastmod: 2025-11-30
description: "A comprehensive step-by-step guide to understanding Bazel build system by analyzing the GoogleContainerTools/distroless repository"
summary: "Learn Bazel fundamentals by exploring how Google builds distroless container images. From MODULE.bazel dependencies to multi-architecture OCI images, understand production-grade Bazel patterns through real-world examples."
tags: ["bazel", "containers", "distroless", "oci", "docker", "build-systems"]
---

## TL;DR

Learning Bazel from documentation alone can be challenging. I explored Google's distroless project to understand how Bazel works in production. This article walks through the codebase step-by-step, sharing what I learned about core Bazel concepts, dependency management, and build patterns.

---

## Background: What is Distroless?

Distroless images contain only your application and its runtime dependencies—no package managers, shells, or standard Linux distribution tools. This approach reduces attack surface, minimizes CVE exposure, and shrinks image sizes dramatically.

The smallest distroless image, `gcr.io/distroless/static-debian12`, is around 2 MiB compared to Alpine's 5 MiB and Debian's 124 MiB. Major projects like Kubernetes, Knative, and Tekton use these images in production.

Building these images requires precision:
- Exact Debian package versions for reproducibility
- Multi-architecture support (amd64, arm64, arm, s390x, ppc64le)
- Image layering for efficient reuse
- Automated testing and publishing

Bazel handles all of this elegantly.

---

## Core Bazel Concepts

Before diving into code, let's establish fundamental concepts:

### Build System Philosophy

Bazel follows these principles:

**Hermetic builds** — Builds are isolated from the host system. Dependencies are explicitly declared and fetched from known sources. The same inputs always produce identical outputs.

**Correct incremental builds** — Bazel tracks all dependencies and rebuilds only what changed. This makes large codebases manageable.

**Multi-language support** — Build Go, Python, Java, Rust, and container images in the same repository with consistent commands.

**Scalability** — Designed for Google's monorepo with millions of lines of code and thousands of engineers.

### Key Files in Bazel Projects

Every Bazel project uses these files:

**`.bazelversion`** — Pins the exact Bazel version. Distroless uses `7.4.0`.

**`MODULE.bazel`** — Modern dependency management system (introduced in Bazel 6). Declares external dependencies like `rules_oci` for container building or `rules_go` for Go support.

**`WORKSPACE`** — Legacy dependency system, still used for some toolchains. The distroless `WORKSPACE` is minimal, with most dependencies in `MODULE.bazel`.

**`BUILD` files** — Define build targets in directories. These specify what to build and how.

**`.bzl` files** — Starlark code for reusable functions and macros. Think of these as libraries.

**`.bazelrc`** — Configuration flags for build, test, and run commands.

### Build Targets and Labels

Everything in Bazel is a target referenced by labels:

```
//path/to/package:target_name
```

For example:
- `//static:static_root_amd64_debian12` — The static image for amd64 on Debian 12
- `//base:base_debug_nonroot_arm64_debian12` — Debug base image for arm64, nonroot user

The `//` prefix refers to the workspace root. You can reference targets from external repositories with `@repo_name//path:target`.

---

## MODULE.bazel: Modern Dependency Management

The `MODULE.bazel` file declares dependencies:

```python
module(name = "distroless")

bazel_dep(name = "bazel_skylib", version = "1.8.1")
bazel_dep(name = "rules_oci", version = "1.8.0")
bazel_dep(name = "rules_distroless", version = "0.5.3")
bazel_dep(name = "rules_go", version = "0.57.0")
bazel_dep(name = "rules_python", version = "1.5.3")
```

Each `bazel_dep()` pulls a ruleset that teaches Bazel how to build specific artifacts:

**`rules_oci`** — Build OCI container images and push to registries

**`rules_distroless`** — Helpers for APT package management and distroless patterns

**`rules_go`** — Compile Go code and build binaries

**`rules_python`** — Python toolchain and dependencies

**`rules_pkg`** — Create tar archives for image layers

These rules provide functions like `oci_image()`, `go_binary()`, and `pkg_tar()` used throughout the project.

### Module Extensions for Custom Logic

Extensions fetch external resources and configure repositories:

```python
# Fetch busybox binaries for debug images
busybox = use_extension("//private/extensions:busybox.bzl", "busybox")
busybox.archive()
use_repo(busybox, "busybox_amd64", "busybox_arm64", "busybox_arm", 
         "busybox_ppc64le", "busybox_s390x")

# Configure Debian package repositories
include("//private/repos/deb:deb.MODULE.bazel")
```

The busybox extension downloads pre-built binaries for each architecture. The Debian extension configures APT repositories with snapshot URLs for reproducibility.

---

## Debian Package Management

Distroless images are built from Debian packages. The configuration lives in `private/repos/deb/`:

### Package Manifest

The `bookworm.yaml` file declares dependencies:

```yaml
version: 1

sources:
  - channel: bookworm main
    url: https://snapshot.debian.org/archive/debian/20251115T203127Z
  - channel: bookworm-security main
    url: https://snapshot.debian.org/archive/debian-security/20251115T203127Z

archs:
  - amd64
  - arm64
  - armhf
  - s390x
  - ppc64el

packages:
  - base-files
  - ca-certificates
  - libc6
  - libssl3
  - tzdata
```

Key aspects:

**Snapshot URLs** — Point to specific timestamps in Debian's snapshot archive. This ensures builds are reproducible—the same packages are available years later.

**Multiple architectures** — Single manifest covers all supported CPU architectures.

**Minimal packages** — Only essential libraries, no package managers or shells.

### Lock Files

The `bookworm.lock.json` file pins exact package versions:

```json
{
  "packages": {
    "base-files": {
      "amd64": {
        "version": "12.4+deb12u5",
        "sha256": "...",
        "url": "..."
      }
    }
  }
}
```

This prevents builds from breaking when new package versions are released.

### APT Extension Integration

The `deb.MODULE.bazel` configures the APT extension:

```python
apt = use_extension("@rules_distroless//apt:extensions.bzl", "apt")

apt.install(
    name = "bookworm",
    lock = "//private/repos/deb:bookworm.lock.json",
    manifest = "//private/repos/deb:bookworm.yaml",
    resolve_transitive = False,
)

use_repo(apt, "bookworm")
```

This creates a Bazel repository named `@bookworm` containing all declared packages. You can reference them like:

```python
"@bookworm//ca-certificates/amd64"
"@bookworm//libssl3/arm64"
```

---

## BUILD Files: Defining Build Targets

BUILD files specify what to build. Let's examine `static/BUILD`:

```python
load(":static.bzl", "static_image", "static_image_index")
load(":config.bzl", "STATIC_ARCHITECTURES", "STATIC_DISTROS")

package(default_visibility = ["//visibility:public"])

[
    static_image(
        arch = arch,
        distro = distro,
    )
    for distro in STATIC_DISTROS
    for arch in STATIC_ARCHITECTURES[distro]
]

[
    static_image_index(
        architectures = STATIC_ARCHITECTURES[distro],
        distro = distro,
    )
    for distro in STATIC_DISTROS
]
```

Breaking this down:

**Load statements** — Import functions from `.bzl` files. The `static_image()` function is defined in `static.bzl`.

**List comprehensions** — Generate multiple targets efficiently. For each distro and architecture combination, invoke `static_image()`.

**Configuration separation** — Constants like `STATIC_DISTROS = ["debian12", "debian13"]` live in `config.bzl` for easy updates.

This pattern generates targets like:
- `//static:static_root_amd64_debian12`
- `//static:static_debug_nonroot_arm64_debian12`
- `//static:static_root_debian12` (multi-arch index)

---

## Image Building with rules_oci

The actual image construction happens in `static.bzl`:

```python
def static_image(distro, arch):
    for (user, uid, workdir) in USER_VARIANTS:
        oci_image(
            name = "static_" + user + "_" + arch + "_" + distro,
            env = {
                "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                "SSL_CERT_FILE": "/etc/ssl/certs/ca-certificates.crt",
            },
            tars = [
                deb.package(arch, distro, "base-files"),
                deb.package(arch, distro, "netbase"),
                deb.package(arch, distro, "tzdata"),
                deb.package(arch, distro, "media-types"),
                "//common:rootfs",
                "//common:passwd",
                "//common:group",
                "//common:tmp",
                ":nsswitch.tar",
                "//common:os_release_" + distro,
                "//common:cacerts_" + distro + "_" + arch,
            ],
            user = "%d" % uid,
            workdir = workdir,
            os = "linux",
            architecture = arch,
        )
```

### Understanding oci_image()

The `oci_image()` rule from `@rules_oci` builds OCI-compliant container images:

**`name`** — Build target identifier, generated programmatically.

**`env`** — Environment variables set in the container.

**`tars`** — List of tar archives layered into the image. Order matters—later layers overwrite earlier ones.

**`user`** — UID to run as. Nonroot images use UID 65532.

**`workdir`** — Default working directory.

**`architecture`** — Target CPU architecture for cross-compilation.

### Package References with deb.package()

The `deb.package()` helper constructs Bazel labels:

```python
def _package(arch, dist, package):
    arch = ARCH_ALIAS[arch]  # arm -> armhf, ppc64le -> ppc64el
    dist = DIST_ALIAS[dist]  # debian12 -> bookworm
    return "@{dist}//{package}/{arch}".format(
        arch=arch, dist=dist, package=package
    )
```

So `deb.package("amd64", "debian12", "ca-certificates")` becomes `@bookworm//ca-certificates/amd64`.

### Debug Image Variants

Debug images add busybox shell:

```python
oci_image(
    name = "static_debug_" + user + "_" + arch + "_" + distro,
    base = ":static_" + user + "_" + arch + "_" + distro,
    entrypoint = ["/busybox/sh"],
    env = {"PATH": "$PATH:/busybox"},
    tars = ["//experimental/busybox:busybox_" + arch],
)
```

The `base` parameter creates image inheritance. Debug images build on top of regular images, adding only busybox.

---

## Image Layering and Composition

Distroless images follow a layering strategy for reuse:

### Layer Hierarchy

**static** — Absolute minimum: filesystem structure, certificates, timezone data
↓
**base** — Adds core libraries (libc, libssl, openssl)
↓
**cc** — Adds C++ standard library (libstdc++, libgcc)
↓
**Language-specific** — python3, java, nodejs with runtime dependencies

This is visible in `base/base.bzl`:

```python
oci_image(
    name = "base_" + user + "_" + arch + "_" + distro,
    base = "//static:static_" + user + "_" + arch + "_" + distro,
    tars = [
        deb.package(arch, distro, pkg)
        for pkg in packages  # ["libc6", "libssl3", "openssl", ...]
    ],
)
```

The `base` parameter references the static image, creating a dependency graph that Bazel tracks.

### Benefits of Layering

**Efficient rebuilds** — Changing Java packages doesn't rebuild the static layer.

**Smaller downloads** — Docker only pulls changed layers.

**Clear dependencies** — Image relationships mirror actual runtime dependencies.

**Reusability** — Multiple language images share the same base.

---

## Multi-Architecture Image Indexes

Supporting multiple architectures requires building separate images and combining them:

```python
def static_image_index(distro, architectures):
    [
        oci_image_index(
            name = "static_" + user + "_" + distro,
            images = [
                "static_" + user + "_" + arch + "_" + distro
                for arch in architectures
            ],
        )
        for user in ["root", "nonroot"]
    ]
```

The `oci_image_index()` rule creates a multi-platform manifest. When you pull `gcr.io/distroless/static-debian12:latest`, Docker automatically selects the correct architecture.

For Debian 12, this combines:
- `static_root_amd64_debian12`
- `static_root_arm64_debian12`
- `static_root_arm_debian12`
- `static_root_s390x_debian12`
- `static_root_ppc64le_debian12`

Into a single pullable reference: `//static:static_root_debian12`

---

## The Publishing Pipeline

The root `BUILD` file orchestrates publishing at `/BUILD:1-332`:

```python
DEFAULT_DISTRO = "debian12"

# Map container tags to build targets
STATIC = {
    "{REGISTRY}/{PROJECT_ID}/static:latest-amd64": 
        "//static:static_root_amd64_debian12",
    "{REGISTRY}/{PROJECT_ID}/static:latest-arm64": 
        "//static:static_root_arm64_debian12",
    "{REGISTRY}/{PROJECT_ID}/static:latest": 
        "//static:static_root_debian12",
}

# Generate tags for all images
ALL = {}
ALL |= STATIC
ALL |= BASE
ALL |= CC
ALL |= PYTHON3
ALL |= NODEJS
ALL |= JAVA_BASE

sign_and_push_all(
    name = "sign_and_push",
    images = ALL,
)
```

This creates a mapping between:
- **Container registry tags** — What users pull (`gcr.io/distroless/static:latest`)
- **Bazel build targets** — What Bazel builds (`//static:static_root_debian12`)

The `sign_and_push_all()` macro handles:
1. Building all images
2. Signing with cosign
3. Pushing to Google Container Registry
4. Creating commit-specific tags for rollback

---

## Testing Container Images

Every image includes structure tests:

```python
container_structure_test(
    name = "static_amd64_debian12_test",
    configs = ["testdata/static.yaml"],
    image = ":check_certs_image_amd64_debian12",
)
```

The test configuration verifies:

```yaml
schemaVersion: 2.0.0

fileExistenceTests:
  - name: 'SSL certificates'
    path: '/etc/ssl/certs/ca-certificates.crt'
    shouldExist: true

commandTests:
  - name: 'Check certificates work'
    command: '/check_certs'
    expectedOutput: ['Certificate verification successful']
```

This ensures:
- Required files exist
- Permissions are correct
- Applications can access certificates
- Environment variables are set properly

Tests run automatically in CI before images are published.

---

## Practical Example: Building Locally

Let's build a static image:

```bash
# Clone the repository
git clone https://github.com/GoogleContainerTools/distroless.git
cd distroless

# Build the static image for amd64 on Debian 12
bazel build //static:static_root_amd64_debian12

# The output is an OCI tarball
ls -lh bazel-bin/static/static_root_amd64_debian12/tarball.tar

# Load into Docker
bazel run //static:static_root_amd64_debian12.load

# Verify it's loaded
docker images | grep static
```

To build for a different architecture:

```bash
# Build for ARM64
bazel build //static:static_root_arm64_debian12

# Build all architectures for a distro (creates multi-arch index)
bazel build //static:static_root_debian12
```

To run tests:

```bash
# Run structure tests for static image
bazel test //static:static_amd64_debian12_test

# Run all tests in the static package
bazel test //static:all
```

---

## Key Bazel Patterns Demonstrated

### 1. Configuration as Code

Constants in separate files (`config.bzl`) make updates easy:

```python
STATIC_DISTROS = ["debian12", "debian13"]
STATIC_ARCHITECTURES = {
    "debian12": ["amd64", "arm64", "arm", "s390x", "ppc64le"],
    "debian13": ["amd64", "arm64", "arm", "s390x", "ppc64le"],
}
```

Adding a new architecture or distro requires minimal changes.

### 2. Target Generation with Macros

Instead of writing repetitive BUILD targets:

```python
# Don't do this
oci_image(name = "static_root_amd64_debian12", ...)
oci_image(name = "static_root_arm64_debian12", ...)
oci_image(name = "static_root_arm_debian12", ...)
# ... 50+ more targets
```

Use list comprehensions and functions:

```python
[
    static_image(arch=arch, distro=distro)
    for distro in DISTROS
    for arch in ARCHITECTURES[distro]
]
```

### 3. Hermetic Builds

Snapshot URLs ensure reproducibility:

```yaml
sources:
  - channel: bookworm main
    url: https://snapshot.debian.org/archive/debian/20251115T203127Z
```

The exact timestamp guarantees the same packages are available indefinitely.

### 4. Dependency Tracking

Bazel knows the entire dependency graph. If you change `//common:passwd`, Bazel rebuilds only images that depend on it, not unrelated ones like `//nodejs`.

### 5. Remote Execution Ready

The hermetic build properties make distroless compatible with Bazel's remote execution. Google builds these images in their internal build cluster.

---

## Key Takeaways

After exploring distroless, you should understand:

**Bazel is declarative** — You describe what to build, not how. The `oci_image()` rule abstracts the complexity of image construction.

**Dependencies are explicit** — Everything needed for a build is declared in `MODULE.bazel`, manifests, or BUILD files. No hidden system dependencies.

**Reproducibility requires discipline** — Snapshot URLs, lock files, and hermetic rules ensure builds work the same everywhere.

**Composition enables reuse** — Layering images and factoring out common components (like `//common:cacerts`) reduces duplication.

**Codegen is powerful** — List comprehensions and macros generate hundreds of targets from concise code.

**Testing is first-class** — Container structure tests run alongside builds, preventing regressions.

**Bazel scales** — The patterns shown here work for small projects and Google-sized monorepos.

---

## Next Steps

To deepen your understanding:

**Experiment with distroless** — Clone the repo, modify a BUILD file, and rebuild. See what changes.

**Create a custom image** — Add your own packages to `bookworm.yaml` and build a custom distroless variant.

**Explore rules_oci** — Read the [rules_oci documentation](https://github.com/bazel-contrib/rules_oci) to understand all `oci_image()` options.

**Study rules_distroless** — The [rules_distroless repository](https://github.com/GoogleContainerTools/rules_distroless) shows how to use distroless patterns in your own projects.

**Read Bazel documentation** — With concrete examples in mind, the [official Bazel docs](https://bazel.build/start) make more sense.

**Apply to your projects** — Consider migrating container builds to Bazel for reproducibility and multi-architecture support.

Bazel has a learning curve, but understanding production examples like distroless accelerates mastery. The patterns you've learned here apply to building any artifact: applications, libraries, containers, or deployment packages.

---

## References

- [GoogleContainerTools/distroless](https://github.com/GoogleContainerTools/distroless) — Source repository
- [Bazel Documentation](https://bazel.build/) — Official Bazel docs
- [rules_oci](https://github.com/bazel-contrib/rules_oci) — OCI image building rules
- [rules_distroless](https://github.com/GoogleContainerTools/rules_distroless) — Distroless helper rules
- [Bazel Module Documentation](https://bazel.build/external/module) — Understanding MODULE.bazel
- [Debian Snapshot Archive](https://snapshot.debian.org/) — Historical package snapshots
- [OCI Image Specification](https://github.com/opencontainers/image-spec) — Container image format
- [Container Structure Test](https://github.com/GoogleContainerTools/container-structure-test) — Testing framework
