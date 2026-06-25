# Astro Blog Guide

Astro static blog. Kanagawa Wave palette, Fira Code mono. Zero client JS except mermaid + giscus on posts. `npm run dev | build | preview`.

## Layout

- One collection: the folder under `src/content/` is the URL section, e.g. `logs/foo.md` -> `/logs/foo/`. New section = new folder + entry in `sections` (`src/config.ts`).
- `src/content/{logs,misc}/*.md` -- posts
- `src/pages/` -- `index.astro` (About), `[section]/index.astro` (lists), `[...slug].astro` (posts), `index.xml.js` (RSS)
- `src/config.ts` -- site meta, `sections`, derived nav, giscus
- `src/lib/posts.ts` -- `titleOf` / `sectionOf` / `byDateDesc` / `iso`
- `src/styles/main.css` -- all styling
- `astro.config.mjs` -- `remarkMermaid`, inline-CSS + lightningcss

## Frontmatter

All optional (no frontmatter = title from filename, undated sorts last):

```yaml
---
title: "Post title"
date: 2025-08-13
lastmod: 2025-09-15 # bump on meaningful edits
---
```

Body: `## TL;DR` -> `---` -> H2/H3 content -> `---` -> `## References`.

## Authoring

- Fenced code: always tag the language (Shiki, `kanagawa-wave`).
- Raw terminal output: hand-write `<pre><code class="language-x">` with inline `<span style="color:#...">` to colorize; passes through unhighlighted.
- Mermaid: ```mermaid fence.
- Callouts: `<div class="alert">` / `alert-error` (raw HTML inside, markdown won't parse).
- Cross-links: absolute, `/logs/<slug>/`.

## Content

- Technical audience, assume familiarity. Fluent, casual, direct. No emojis.
- Backticks for code/tools. Short paragraphs.
- TL;DR is user-provided -- never write from scratch, only reword when asked.
- Verify CLI flags (`--help` / docs); don't invent.
