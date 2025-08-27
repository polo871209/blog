# Hugo Blog Development Guide

## Overview

This guide provides instructions for developing and managing a Hugo blog with the PaperMod theme.

## Prerequisites

- Hugo server already running with `hugo server -D` in the background
- Verify functionality at: http://localhost:1313/blog/

## Directory Structure

```
├── content/
│   └── posts/          # All blog posts go here
├── hugo.yaml           # Main configuration file
└── [other directories] # Handled automatically by Hugo or manually
```

## Content Creation Rules

### Post Location

- **Directory**: `content/posts/`
- **Format**: Markdown files (`.md`)

### Frontmatter Requirements

All posts MUST include YAML frontmatter with these fields:

- `title`: Post title (required)
- `date`: Publication date (required)
- **description**: Meta description for SEO
- **tags**: Array of tags for categorization

### Date Format

- **Standard**: ISO 8601 with timezone
- **Example**: `2025-08-15T10:24:33+08:00`

### Post Template

```yaml
---
title: "Your Post Title"
date: 2025-08-15T10:24:33+08:00
description: "Brief description for SEO"
tags: ["tag1", "tag2"]
ShowToc: true
TocOpen: true
---

## TL;DR

[User-provided TL;DR content - only improve wording/clarity when user specifically asks]

## Introduction/Background

Your main content starts here...
```

### Content Structure Requirements

Every post MUST start with:

1. **TL;DR section** - User will provide content, agent may only make minor wording improvements when requested
2. **Main content** - Detailed explanation, examples, and insights

## Writing Style Guidelines

### Tone and Voice

- **Audience**: Technical professionals — assume familiarity with concepts
- **Style**: Fluent but casual, don't use emoji
- **Approach**: Conversational and direct
- **Language**: Clear and concise, technical terms are expected

### TL;DR Guidelines

- **User provides TL;DR content** - do not create from scratch
- **Improvements only when requested** - only adjust wording/clarity when user specifically asks
- **Preserve user's intent** - keep the main points and tone as intended
- **Do not remove key information**

### Content Structure

- Start with user-provided TL;DR, then expand into detailed content
- Use clear headings and subheadings
- Break up long paragraphs for readability

## Layout and Readability Guidelines

**ALWAYS apply these layout improvements for better readability:**

- Add relevant emojis to ALL section headers for visual scanning
- Use **em dashes (—)** instead of colons in bullet points
- Apply **bold text** for key phrases and concepts
- Use _italic text_ for commentary and asides
- Add blockquotes (`>`) for key insights with emoji prefixes like `> **💡 Key Insight:**`
- Break up long paragraphs into shorter, scannable chunks
- Use blockquotes to highlight important concepts
- Add strategic emphasis with bold and italic formatting
- Include visual separators and white space
- Always specify language for code blocks (`dockerfile, `bash, etc.)
- Add Table of Contents for posts with 4+ sections with horizontal rule (`---`) after TOC

### When to Apply

- **Always** apply these formatting rules when creating or editing blog posts
- Focus on scanability and visual hierarchy
- Ensure consistent emoji usage throughout sections

### Technical Accuracy

- **Verify commands** — Test CLI examples using `--help` or actual execution when possible
- **Check syntax** — Ensure flags, parameters, and command structure are correct
- **Reference docs** — Cross-check against official tool documentation
- **Note versions** — Add disclaimers when commands may vary between tool versions
