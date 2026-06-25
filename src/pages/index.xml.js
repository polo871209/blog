import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { site } from "../config";

export async function GET(context) {
  const logs = (await getCollection("logs")).map((p) => ({
    p,
    section: "logs",
  }));
  const misc = (await getCollection("misc")).map((p) => ({
    p,
    section: "misc",
  }));
  const all = [...logs, ...misc].sort(
    (a, b) => b.p.data.date.getTime() - a.p.data.date.getTime(),
  );

  return rss({
    title: site.title,
    description: site.description,
    site: context.site,
    items: all.map(({ p, section }) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.summary ?? "",
      link: `/${section}/${p.id}/`,
    })),
  });
}
