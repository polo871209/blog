# AGENTS.md - Hugo Blog Development Guide

## Build/Test Commands
- **Build site**: `hugo` (output to `public/`)
- **Dev server**: `hugo server` or `hugo serve -D` (includes drafts)
- **Build with minification**: `hugo --gc --minify`
- **Build specific environment**: `HUGO_ENVIRONMENT=production hugo`

## Content Guidelines
- **Posts location**: `content/posts/`
- **Post format**: Markdown with YAML frontmatter
- **Required frontmatter**: `date`, `title`
- **Draft posts**: Set `draft: true` in frontmatter
- **Date format**: ISO 8601 with timezone (e.g., `2025-08-14T22:08:48+08:00`)

## Hugo Configuration
- **Config file**: `hugo.yaml` (YAML format)
- **Theme**: PaperMod (located in `themes/PaperMod/`)
- **Base URL**: https://polo871209.github.io
- **Output formats**: HTML, RSS, JSON

## File Structure
- Content in `content/` directory
- Static assets auto-generated to `public/`
- Theme customizations via `hugo.yaml` params
- GitHub Pages deployment via `.github/workflows/hugo.yaml`