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
  nav: [
    { name: "About", href: "/", match: "home" },
    { name: "Logs", href: "/logs/", match: "logs" },
    { name: "Misc", href: "/misc/", match: "misc" },
  ],
} as const;
