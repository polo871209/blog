# Astro Blog Guide

Custom Astro blog. Kanagawa Wave palette, Fira Code mono. Static output, zero client JS except the mermaid + giscus islands on posts.

## Structure

- `src/content/logs/*.md` — technical writeups, default TOC ON
- `src/content/misc/*.md` — reflections, tangents, default TOC OFF
- `src/pages/index.astro` — About homepage (YAML manifest)
- `src/pages/{logs,misc}/index.astro` — section lists; `[...slug].astro` — post pages
- `src/pages/tags/[tag].astro` — tag pages
- `src/pages/index.xml.js` — RSS feed
- `src/config.ts` — site metadata, nav, social links, giscus config
- `src/styles/main.css` — all styling
- `astro.config.mjs` — `remarkMermaid` plugin + `/posts/*` redirects (old Hugo permalinks)

## Post Frontmatter

```yaml
---
title: "Post title"
date: 2025-08-13 # publish date, yyyy-mm-dd
lastmod: 2025-09-15 # bump on every meaningful edit
summary: "Concise list-view summary (also used as SEO meta description)"
tags: ["specific-tool", "domain"] # max 4
# toc: false               # override default-on (logs) / default-off (misc)
---
```

Body skeleton: `## TL;DR` → `---` → main content with H2/H3 → `---` → `## References`.

## Authoring helpers

- Code highlighting: Shiki, `kanagawa-wave` theme. Always specify a fenced language.
- Mermaid: a ```mermaid fenced block (the remark plugin turns it into a rendered diagram).
- Callouts: raw HTML `<div class="alert">...</div>` (or `alert-error`). Markdown does not parse inside, so write inline HTML (`<strong>`, `<code>`).
- Cross-links between posts: absolute, e.g. `/logs/wolfi_made_easy/`.

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

## TL;DR Rule

User provides TL;DR. Do not write from scratch. Only adjust wording when explicitly asked.

## Technical Accuracy

Verify CLI examples (`--help` or run them). Cross-check official docs. Don't invent flags.
