import type { CollectionEntry } from "astro:content";

export type AnyPost = CollectionEntry<"logs"> | CollectionEntry<"misc">;

// Title falls back to a humanized file id when frontmatter omits it.
export function titleOf(post: AnyPost): string {
  if (post.data.title) return post.data.title;
  return post.id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Undated posts sort to the bottom.
export function byDateDesc(a: AnyPost, b: AnyPost): number {
  return (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0);
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);
