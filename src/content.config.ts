import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Everything optional: a post can ship with no frontmatter at all.
// title -> humanized filename, date -> omitted, tags -> none.
const postSchema = z.object({
  title: z.string().optional(),
  date: z.coerce.date().optional(),
  lastmod: z.coerce.date().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).default([]),
  toc: z.boolean().optional(),
});

const logs = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/logs" }),
  schema: postSchema,
});

const misc = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/misc" }),
  schema: postSchema,
});

export const collections = { logs, misc };
