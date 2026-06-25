# Astro Blog Guide

Custom Astro blog. Kanagawa Wave palette, Fira Code mono. Static output, zero client JS except the mermaid + giscus islands on posts.

## Structure

- **One content collection.** The folder under `src/content/` is the URL section, e.g. `src/content/logs/foo.md` → `/logs/foo/`. To add a section, just make a folder and register it in `sections` (`src/config.ts`).
- `src/content/logs/*.md` — technical writeups
- `src/content/misc/*.md` — reflections, tangents
- `src/pages/index.astro` — About homepage (YAML manifest)
- `src/pages/[section]/index.astro` — section list (dynamic); `src/pages/[...slug].astro` — post pages (dynamic)
- `src/pages/index.xml.js` — RSS feed
- `src/config.ts` — site metadata, `sections` (title/lede), nav (derived), social links, giscus
- `src/lib/posts.ts` — `titleOf` / `sectionOf` / `byDateDesc` / `iso` helpers
- `src/styles/main.css` — all styling
- `astro.config.mjs` — `remarkMermaid` plugin, inline-CSS + lightningcss build tuning

## Post Frontmatter

All optional — a post can have none (title falls back to the humanized filename, undated posts sort last).

```yaml
---
title: "Post title" # optional; defaults to filename
date: 2025-08-13 # optional, yyyy-mm-dd
lastmod: 2025-09-15 # optional; bump on meaningful edits
---
```

Body skeleton: `## TL;DR` → `---` → main content with H2/H3 → `---` → `## References`.

## Authoring helpers

- Code highlighting: Shiki, `kanagawa-wave` theme. Always specify a fenced language.
- Raw terminal output: hand-write `<pre><code class="language-x">...</code></pre>` HTML when Shiki highlighting hurts readability (e.g. colorize only a value with an inline `<span style="color:#...">`). These pass through unhighlighted by design.
- Mermaid: a ```mermaid fenced block (the remark plugin turns it into a rendered diagram).
- Callouts: raw HTML `<div class="alert">...</div>` (or `alert-error`). Markdown does not parse inside, so write inline HTML (`<strong>`, `<code>`).
- Cross-links between posts: absolute, e.g. `/logs/wolfi_made_easy/`.

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
