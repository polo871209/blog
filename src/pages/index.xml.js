import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { site } from "../config";
import { titleOf, byDateDesc } from "../lib/posts";

export async function GET(context) {
  const logs = (await getCollection("logs")).map((p) => ({
    p,
    section: "logs",
  }));
  const misc = (await getCollection("misc")).map((p) => ({
    p,
    section: "misc",
  }));
  const all = [...logs, ...misc].sort((a, b) => byDateDesc(a.p, b.p));

  return rss({
    title: site.title,
    description: site.description,
    site: context.site,
    items: all.map(({ p, section }) => ({
      title: titleOf(p),
      ...(p.data.date ? { pubDate: p.data.date } : {}),
      description: p.data.summary ?? "",
      link: `/${section}/${p.id}/`,
    })),
  });
}
