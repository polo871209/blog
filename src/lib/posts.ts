import type { CollectionEntry } from "astro:content";
import type { Section } from "../config";

export type Post = CollectionEntry<"posts">;

// id is "<section>/<slug>", e.g. "logs/wolfi_made_easy".
// The folder must be registered in `sections` (config.ts) to get a list page + nav entry.
export const sectionOf = (post: Post) => post.id.split("/")[0] as Section;

// Title falls back to a humanized file slug when frontmatter omits it.
export function titleOf(post: Post): string {
  if (post.data.title) return post.data.title;
  return post.id
    .split("/")
    .pop()!
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Undated posts sort to the bottom.
export const byDateDesc = (a: Post, b: Post) =>
  (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0);

export const iso = (d: Date) => d.toISOString().slice(0, 10);
