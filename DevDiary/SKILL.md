---
name: DevDiary
description: Development diary system that captures screenshots, events, and learnings from dev sessions and synthesizes them into publishable blog posts. USE WHEN dev diary, capture progress, screenshot progress, document development, blog about building, dev blog, capture milestone, development journal, session diary.
---

# DevDiary

Automated development diary that turns your dev sessions into publishable content. Captures screenshots (via MCP, Browser skill, or file system), bundles them with session events (file changes, errors, decisions, learnings), and synthesizes everything into narrative Markdown blog posts.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/DevDiary/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Content Directory

All diary content is stored in:
```
~/.claude/MEMORY/CONTENT/{project-name}/{YYYY-MM-DD}/
├── screenshots/          # Visual captures
│   ├── 001_description.png
│   └── 002_description.png
├── events.jsonl          # Structured event log
└── posts/                # Generated blog posts
    └── draft-post.md
```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Capture** | "capture this", "screenshot milestone", "diary entry", "log progress" | `Workflows/Capture.md` |
| **Synthesize** | "write blog post", "generate diary post", "synthesize diary" | `Workflows/Synthesize.md` |
| **Publish** | "publish diary", "finalize post", "export post" | `Workflows/Publish.md` |
| **Review** | "review diary", "show captures", "diary status" | `Workflows/Review.md` |

## Screenshot Capture Methods

DevDiary supports multiple screenshot sources:

| Method | When | How |
|--------|------|-----|
| **MCP Server** | Godot, game engines, connected apps | Use the project's MCP screenshot tool |
| **Browser Skill** | Web apps, web-based pipelines | `bun Browse.ts screenshot` |
| **File Reference** | Pipeline output files already on disk | Copy from output path |
| **Window Capture** | Any native window (fallback) | PowerShell or node-screenshots |

**Priority:** MCP > Browser > File Reference > Window Capture

## Examples

**Example 1: Capture a game development milestone**
```
User: "capture this - the vector field is working now"
→ Invokes Capture workflow
→ Takes screenshot via Godot MCP server
→ Logs event with description + file changes since last capture
→ Stores in MEMORY/CONTENT/godot-game/2026-02-08/
```

**Example 2: Generate a blog post from today's session**
```
User: "synthesize today's dev diary into a blog post"
→ Invokes Synthesize workflow
→ Reads all captures from today's content directory
→ Pulls session context (ActivityParser, SessionHarvester)
→ Generates narrative Markdown with embedded screenshots
→ Outputs draft to posts/ subdirectory
```

**Example 3: Capture a failure for the blog**
```
User: "capture this bug - physics collision is broken"
→ Invokes Capture workflow
→ Takes screenshot showing the broken state
→ Captures error output from terminal/console
→ Tags event as "failure" for narrative contrast in blog post
```

## Quick Reference

- **Content storage:** `~/.claude/MEMORY/CONTENT/{project}/{date}/`
- **Event format:** JSONL with timestamp, type, description, screenshot path, file changes
- **Blog output:** Markdown with frontmatter and relative image paths
- **Reads from:** PAI WORK/ directories, ActivityParser, SessionHarvester, FailureCapture
