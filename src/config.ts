export const site = {
  title: "PoLog",
  description: "Po Lo's blog",
  author: { name: "PoLog" },
  links: [
    { name: "github", url: "https://github.com/polo871209" },
    { name: "linkedin", url: "https://linkedin.com/in/polohi" },
    { name: "email", url: "mailto:qazh0123@gmail.com" },
  ],
  giscus: {
    repo: "polo871209/blog",
    repoId: "R_kgDOPd7LFA",
    category: "General",
    categoryId: "DIC_kwDOPd7LFM4C7LkF",
  },
} as const;

// Sections == folders under src/content/. Drives routes, nav, and list pages.
export const sections = {
  logs: {
    title: "Logs",
    lede: "Just sharing the simple solutions that work.",
    toc: true,
  },
  misc: {
    title: "Misc",
    lede: "Things that don't fit anywhere else.",
    toc: false,
  },
} as const;

export type Section = keyof typeof sections;

export const nav = [
  { name: "About", href: "/", match: "home" },
  ...Object.entries(sections).map(([key, s]) => ({
    name: s.title,
    href: `/${key}/`,
    match: key,
  })),
];
