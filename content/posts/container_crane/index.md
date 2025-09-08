---
title: "Crane: Remote Container Swiss Army Knife"
date: 2025-09-08
lastmod: 2025-09-08
description: "Learn how Google's crane CLI tool enables remote container image manipulation without Docker, including copying images between registries and adding layers directly to remote repositories."
summary: "Explore crane, Google's lightweight CLI for remote container registry operations. Manipulate images, copy between registries, and add layers without local Docker pulls."
tags: ["containers", "registry", "cicd"]
---

## TL;DR

Google's `crane` is a lightweight CLI tool for interacting with container registries remotely. This allows you to mutate images without pulling them to localhost - even adding layers directly to remote registries. Perfect for CI/CD workflows where you need fast, efficient image operations without the overhead of local Docker pulls.

---

## Key Operations

> **Registry Authentication Required:** You must authenticate with the registry before performing operations.

### Image Retag

**Tag existing remote images without pulling:**

<pre><code class="language-bash">$ <span style="color: #cba6f7;">crane</span> tag registry.example.com/library/ubuntu:v0 v1
</code></pre>

This eliminates the traditional workflow of `pull → tag → push` by operating directly on the registry.

### Export Files

**List files in an image without pulling:**

<pre><code class="language-bash">$ <span style="color: #cba6f7;">crane</span> export ubuntu - | tar -tvf - | less
</code></pre>

**Extract specific files from remote images:**

<pre><code class="language-bash">$ <span style="color: #cba6f7;">crane</span> export ubuntu - | tar -Oxf - etc/passwd
</code></pre>

<pre><code class="language-bash">$ <span style="color: #cba6f7;">crane</span> export ubuntu - | tar -Oxf - etc/hostname > hostname.txt
</code></pre>

The `export` command streams the entire image as a tar archive to stdout (`-`), allowing you to pipe it directly to standard Unix tools. This is particularly useful for inspecting image contents or extracting configuration files without local storage overhead.

> You can use `dive` for this use case too, but `crane export` is a more lightweight and faster solution for file extraction without the interactive overhead.

### Get Config

**Inspect image configuration without pulling:**

<pre><code class="language-bash">$ <span style="color: #cba6f7;">crane</span> config busybox:1.33
</code></pre>

**Compare configurations between image versions:**

<pre><code class="language-bash">$ <span style="color: #cba6f7;">diff</span> <(crane config busybox:1.32 | jq) <(crane config busybox:1.33 | jq)
</code></pre>

This reveals environment variables, entrypoints, working directories, and other image metadata directly from the registry.

### Append

**Add layers to remote images without local pulls:**

This is actually the feature that first introduced me to this tool - the ability to append layers directly to remote images.

<pre><code class="language-bash">$ <span style="color: #cba6f7;">echo</span> "custom content" > myfile.txt
$ <span style="color: #cba6f7;">tar</span> -czf myfile.tar.gz myfile.txt
$ <span style="color: #cba6f7;">crane</span> append -b ubuntu:22.04 -f myfile.tar.gz -t registry.example.com/myapp:custom
</code></pre>

The `append` command takes a base image (`-b`), adds new layers from tarballs (`-f`), and creates a new tagged image (`-t`) directly in the registry, bypassing the need for local Docker builds or intermediate storage.

See how powerful this command is? Imagine you have a CUDA image that's 5GB to build - with `crane append`, you can add your application layer without downloading that massive base image.

**Traditional Docker workflow vs Crane append:**

{{< mermaid >}}
graph TD
subgraph "Traditional Docker Build"
A[Pull 5GB CUDA base] --> B[Add application files]
B --> C[Build new image locally]
C --> D[Push complete image]
end

    subgraph "Crane Append Workflow"
        E[Create tarball locally] --> F[crane append -b cuda:base]
        F --> G[New image created remotely]
    end

    A -.->|"5GB download"| B
    C -.->|"5GB+ upload"| D
    E -.->|"~MB tarball"| F
    F -.->|"Only layer diff"| G

{{< /mermaid >}}

With `crane append`, you're only transferring the new layer content - not the entire base image. This makes it incredibly efficient for adding small customizations to large base images.

---

## Wrapping Up

These operations represent just a glimpse of what `crane` offers for optimizing CI/CD workflows. By enabling direct registry manipulation, crane shifts how we think about container operations - moving from local-first to registry-first approaches.

The core value proposition is network efficiency: instead of downloading gigabytes to perform simple operations, crane works directly with remote registries. This translates to faster pipelines, reduced bandwidth costs, and more efficient resource utilization across your delivery process.

What I'd covered here are just the one I found useful to start with. Crane supports many more use cases.

{{< alert >}}
**Disclaimer:** While `crane` is a stable and production-ready tool, the go-containerregistry repository doesn't appear to be actively maintained with frequent updates. The tool works reliably for current use cases, but consider this when planning long-term dependencies.
{{< /alert >}}

---

## 📚 References

- [Official crane documentation](https://github.com/google/go-containerregistry/blob/main/cmd/crane/doc/crane.md)
- [Crane recipes and examples](https://github.com/google/go-containerregistry/blob/main/cmd/crane/recipes.md)
- [Go containerregistry project](https://github.com/google/go-containerregistry)
