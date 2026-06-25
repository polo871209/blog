import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// One collection; the folder under src/content/ becomes the URL section.
// Entry ids look like "logs/wolfi_made_easy" or "misc/attempts".
// Everything optional: a post can ship with no frontmatter at all.
const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content" }),
  schema: z.object({
    title: z.string().optional(),
    date: z.coerce.date().optional(),
    lastmod: z.coerce.date().optional(),
    toc: z.boolean().optional(),
  }),
});

export const collections = { posts };
