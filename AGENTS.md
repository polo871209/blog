# Astro Blog Guide

Astro static blog. Kanagawa Lotus (light) palette, Fira Code mono. Client JS: the opengarden tree on `/` (WebGPU, hidden in browsers without it), mermaid + giscus on posts. Keep other pages JS-free. `pnpm dev | build | preview`. `pnpm run deploy` builds and uploads `dist/` to Cloudflare at lochingpo.com (`wrangler.jsonc`, wrangler from `mise.toml`). Plain `pnpm deploy` is a pnpm built-in and does not run the script. The GitHub Pages workflow still deploys polo.is-not-a.dev on push to `main`.

## Layout

- One collection: the folder under `src/content/` is the URL section, e.g. `logs/foo.md` -> `/logs/foo/`. New section = new folder + entry in `sections` (`src/config.ts`).
- `src/content/{logs,misc}/*.md` -- posts
- `src/pages/` -- `index.astro` (home: garden hero, manifest, recent posts. The site title links here, there is no About tab), `[section]/index.astro` (lists), `[...slug].astro` (posts), `index.xml.js` (RSS)
- Garden: `@opengardenjs/web` + `@opengardenjs/cherry` (github.com/polo871209/opengarden), mounted in `index.astro`, always spring. Ground and camera come from the package, so fix them there, not in this repo.
- `src/layouts/` -- `Document.astro` (html shell), `BaseLayout.astro` (list and post pages), `Post.astro`
- `src/config.ts` -- site meta, `sections`, derived nav, giscus
- `src/lib/posts.ts` -- `titleOf` / `sectionOf` / `byDateDesc` / `iso`
- `src/styles/main.css` -- all styling. `--frame`, `--gutter`, and `--bar-top` place the nav bar (`Nav.astro`) at the same spot on every page
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

- Fenced code: always tag the language (Shiki, `kanagawa-lotus`).
- Raw terminal output: hand-write `<pre><code class="language-x">` with inline `<span style="color:#...">` to colorize; passes through unhighlighted. Use Lotus hexes that read on `#f2ecbc`: green `#6f894e`, red `#c84053`, violet `#624c83`, orange `#cc6d00`, aqua `#597b75`, yellow `#77713f`, dim `#8a8980`.
- Mermaid: ```mermaid fence. Posts without one ship no mermaid JS.
- `public/fonts/FiraCode-VF.woff2` is subset to Latin-1, punctuation, arrows, math, box drawing, and shapes, at weights 400 to 700. If a glyph falls back to another font, rebuild it from the full font in `c2ae7a2`: `git show c2ae7a2:public/fonts/FiraCode-VF.woff2 > full.woff2`, then `uvx --from 'fonttools[woff]' fonttools varLib.instancer` (`wght=400:700`) and `pyftsubset --layout-features=calt,liga,ccmp,locl --flavor=woff2` with the extra `--unicodes`.
- Callouts: `<div class="alert">` / `alert-error` (raw HTML inside, markdown won't parse).
- Cross-links: absolute, `/logs/<slug>/`.

## Content

- Technical audience, assume familiarity. Fluent, casual, direct. No emojis.
- Backticks for code/tools. Short paragraphs.
- TL;DR is user-provided -- never write from scratch, only reword when asked.
- Verify CLI flags (`--help` / docs); don't invent.
