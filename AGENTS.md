# Hugo Blog Development Guide

## Overview

Complete development guide for managing a Hugo blog with Congo theme — covers content creation rules, frontmatter requirements, writing style guidelines, and layout best practices for technical blog posts.

## Configuration Guidelines

- **Main config** — `config/_default/hugo.toml` for Hugo settings
- **Theme config** — `config/_default/params.toml` for Congo theme parameters
- **Languages** — `config/_default/languages.en.toml` for language-specific settings
- **Menus** — `config/_default/menus.en.toml` for navigation configuration
- **Follow Hugo documentation** — Reference https://gohugo.io/configuration/ for Hugo settings
- **Follow Congo documentation** — Reference https://jpanther.github.io/congo/docs/configuration/ for theme parameters
- **Use TOML format** — All configuration files use `.toml` extension

## Content Creation Rules

### Post Location

- **Directory** — `content/posts/{post_name}/index.md`

### Post Template

```yaml
---
# All posts MUST include YAML frontmatter with these fields:
title: "Post title"
date: 2020-08-13 # Publication date, format yyyy-mm-dd
lastmod: 2025-08-13 # Update every time there is change for the post, format yyyy-mm-dd
description: "Meta description for SEO"
summary: "Summary for quick intro view for the list view, concise without too much detail"
tags: ["post", "tech", "tags"] # Array of tags for categorization
---

## TL;DR

[User-provided TL;DR content - only improve wording/clarity when user specifically asks]

## Introduction/Background

Your main content starts here...
```

### Tone and Voice

- **Audience** — Technical professionals, assume familiarity with concepts
- **Style** — Fluent but casual, professional tone
- **Approach** — Conversational and direct
- **Language** — Clear and concise, technical terms are expected
- **Formatting** — **NEVER use emojis** in headers, content, or anywhere in blog posts

### Technical Accuracy

- **Verify commands** — Test CLI examples using `--help` or actual execution when possible
- **Check syntax** — Ensure flags, parameters, and command structure are correct
- **Reference docs** — Cross-check against official tool documentation

### TL;DR Guidelines

- **User provides TL;DR content** — do not create from scratch
- **Improvements only when requested** — only adjust wording/clarity when user specifically asks
- **Preserve user's intent** — keep the main points and tone as intended
- **Do not remove key information**

### Visual Formatting Rules

- **Backticks** — Apply `backquotes` for key phrases, concepts, and inline code
- **Official documentation** — Reference Congo docs for advanced features:
  - Shortcodes: https://jpanther.github.io/congo/docs/shortcodes/
  - Markdown samples: https://jpanther.github.io/congo/samples/markdown/
- **Paragraph structure** — Break up long paragraphs into shorter, scannable chunks
- **White space** — Include visual separators and breathing room between sections
- Always specify language for code blocks (`dockerfile`, `bash`, etc.)
- **For bash output** — Use HTML `<pre><code>` blocks with Catppuccin Mocha colors for syntax highlighting
