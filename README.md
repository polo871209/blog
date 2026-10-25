# PoLog

Personal blog. Built with [Astro](https://astro.build). Live at [lochingpo.com](https://lochingpo.com).

Theme: [Kanagawa Lotus](https://github.com/rebelot/kanagawa.nvim) palette, [Fira Code](https://github.com/tonsky/FiraCode) mono. The home page renders a cherry tree from [opengarden](https://github.com/polo871209/opengarden).

## Develop

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build      # static output to dist/
pnpm preview    # serve the build locally
```

## Deploy

```bash
pnpm run deploy    # build, then wrangler deploy to lochingpo.com
```
