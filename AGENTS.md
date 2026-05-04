# Hugo Blog Guide

Custom Hugo blog. Kanagawa Wave palette, Fira Code mono.

## Sections

- **Logs** (`content/logs/`) — technical writeups, default TOC ON
- **Misc** (`content/misc/`) — reflections, tangents, default TOC OFF
- **About** (`content/_index.md`) — homepage

## Post Frontmatter

```yaml
---
title: "Post title"
date: 2025-08-13           # publish date, yyyy-mm-dd
lastmod: 2025-09-15        # bump on every meaningful edit
summary: "Concise list-view summary (also used as SEO meta description)"
tags: ["specific-tool", "domain"]   # max 4
# toc: false               # uncomment to disable auto-TOC
---
```

Body skeleton: `## TL;DR` → `---` → main content with H2/H3 → `---` → `## References`.

## Tags

- Max **4** per post
- **Specific over generic** — `argo-rollouts` not `deployment`, `prometheus` not `monitoring`
- **No catch-alls** — `build`, `infrastructure`, `cicd-tools`, `tooling`, `devops`
- **No overlaps** — if tagged `containers`, don't also add `oci`/`docker`
- **Format** — lowercase, hyphenated: `service-mesh`, `supply-chain`

## Tone & Style

- Audience: technical pros, assume familiarity
- Voice: fluent, casual, direct
- **No emojis** in posts
- Backticks for inline code, tools, key phrases
- Short paragraphs, visual separators between sections
- Code blocks: always specify language
- Raw terminal output: `<pre><code>` HTML blocks when syntax highlighting hurts readability

## TL;DR Rule

User provides TL;DR. Do not write from scratch. Only adjust wording when explicitly asked.

## Technical Accuracy

Verify CLI examples (`--help` or run them). Cross-check official docs. Don't invent flags.

## Shortcodes

- `{{< lead >}}...{{< /lead >}}` — italic intro
- `{{< alert "info|error" >}}...{{< /alert >}}` — callout box
- `{{< mermaid >}}...{{< /mermaid >}}` — mermaid diagrams
