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

### Date Format

- **Standard**: ISO 8601 with timezone
- **Example**: `2025-08-15T10:21:05+08:00`
- **Template**: `YYYY-MM-DDTHH:MM:SS+08:00`

### Post Template

```yaml
---
title: "Your Post Title"
date: 2025-08-15T10:21:05+08:00
lastmod:
description: "Brief description for SEO"
tags: ["tag1", "tag2"]
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

### Essential Front Matter Variables

- **title**: Page title
- **date**: Publication date (use current timezone +08:00)
- **lastmod**: Last modification date
- **description**: Meta description for SEO
- **tags**: Array of tags for categorization

## Writing Style Guidelines

### Tone and Voice

- **Style**: Fluent but casual
- **Approach**: Conversational and approachable
- **Perspective**: Personal insights and experiences
- **Language**: Clear, direct, and jargon-free when possible

### TL;DR Guidelines

- **User provides TL;DR content** - do not create from scratch
- **Improvements only when requested** - only adjust wording/clarity when user specifically asks
- **Preserve user's intent** - keep the main points and tone as intended
- **Do not remove key information**

### Content Structure

- Start with user-provided TL;DR, then expand into detailed content
- Use clear headings and subheadings
- Break up long paragraphs for readability
- Include practical examples where relevant
- End with actionable takeaways or conclusions

### Writing Tips

- Write as if talking to a friend who's interested in the topic
- Share personal experiences and lessons learned
- Use "I" and "you" naturally in conversation
- Keep sentences varied in length but generally concise
- Include relevant code examples with proper syntax highlighting

## Configuration

- **File**: `hugo.yaml` (YAML format only)
- **Theme**: PaperMod (pre-configured)

## Key Points

1. Only modify files in `content/` directory and `hugo.yaml`
2. All other directories are managed by Hugo automatically
3. Always test changes at http://localhost:1313/blog/ if hugo.yaml are modified
4. Ensure frontmatter follows exact format requirements
5. Use proper ISO 8601 date formatting with timezone (+08:00)
6. Every post MUST start with a TL;DR section (user-provided content)

