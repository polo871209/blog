import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { site } from "../config";
import { titleOf, byDateDesc } from "../lib/posts";

export async function GET(context) {
  const posts = (await getCollection("posts")).sort(byDateDesc);

  return rss({
    title: site.title,
    description: site.description,
    site: context.site,
    items: posts.map((p) => ({
      title: titleOf(p),
      ...(p.data.date ? { pubDate: p.data.date } : {}),
      link: `/${p.id}/`,
    })),
  });
}
