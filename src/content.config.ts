import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const postSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  lastmod: z.coerce.date().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).default([]),
  toc: z.boolean().optional(),
  aliases: z.array(z.string()).optional(),
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
