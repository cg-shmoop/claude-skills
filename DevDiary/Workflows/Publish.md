# Publish Workflow

Finalizes a draft blog post and publishes it to BeeBum Wisdom (beebumwisdom.com).

## Site Configuration

- **Platform:** Astro (static site generator)
- **Hosting:** Cloudflare Pages
- **Domain:** beebumwisdom.com
- **Project path:** `~/Projects/Website/beebumwisdom/`
- **Blog content:** `~/Projects/Website/beebumwisdom/src/content/blog/`
- **Deploy method:** `wrangler pages deploy dist` (direct upload, no GitHub needed)

## Prerequisites

- A draft post exists in `~/.claude/MEMORY/CONTENT/{project}/{date}/posts/`
- Screenshots referenced in the post exist (if any)

## Steps

### 1. Identify the Draft

If no specific draft is given, use the most recent draft:
```bash
ls -t ~/.claude/MEMORY/CONTENT/{project}/{date}/posts/draft-*.md | head -1
```

### 2. Validate the Post

Check that all referenced assets exist:
- Parse the Markdown for `![...](...png)` image references
- Verify each referenced screenshot file exists
- Report any missing assets

### 3. Convert Frontmatter to Astro Format

The Astro blog content schema requires:
```yaml
---
title: "Post Title"
description: "Brief description for SEO and listing pages"
pubDate: "Feb 08 2026"
updatedDate: "Feb 09 2026"  # optional
heroImage: "../../assets/image.jpg"  # optional
---
```

**Convert from DevDiary format:**
- `date` → `pubDate` (reformat to "Mon DD YYYY")
- Add `description` from first paragraph or event summary
- `narrator`, `audience`, `tags` fields are kept in post body, not frontmatter (Astro schema doesn't support them)

### 4. Generate Slug

Derive from title:
- Lowercase
- Replace spaces with hyphens
- Remove special characters
- Example: `"Day 1: Making PAI Work on Windows"` → `day-1-making-pai-work-on-windows`

### 5. Copy to Astro Blog

```bash
# Copy post to Astro content directory
cp {draft_path} ~/Projects/Website/beebumwisdom/src/content/blog/{slug}.md

# Copy screenshots to public directory (if any)
mkdir -p ~/Projects/Website/beebumwisdom/public/blog/{slug}/
cp ~/.claude/MEMORY/CONTENT/{project}/{date}/screenshots/* ~/Projects/Website/beebumwisdom/public/blog/{slug}/

# Update image paths in the post to use /blog/{slug}/ prefix
```

### 6. Build and Verify

```bash
cd ~/Projects/Website/beebumwisdom
bun run build
```

If the build succeeds, the post is ready.

### 7. Commit and Deploy

```bash
cd ~/Projects/Website/beebumwisdom
git add -A
git commit -m "New post: {title}"

# Deploy directly to Cloudflare Pages (no GitHub needed)
npx wrangler pages deploy dist --project-name beebumwisdom --branch main --commit-dirty=true
```

**Note:** Direct deploy via wrangler. The post is live immediately after upload completes.

### 8. Update Post Index

Append to `~/.claude/MEMORY/CONTENT/published.jsonl`:

```json
{
  "timestamp": "{now}",
  "project": "{project}",
  "title": "{title}",
  "slug": "{slug}",
  "source": "{draft_path}",
  "published_to": "https://beebumwisdom.com/blog/{slug}/",
  "screenshots": 0,
  "word_count": 1454
}
```

### 9. Confirm

```
Published to BeeBum Wisdom: {title}
  URL: https://beebumwisdom.com/blog/{slug}/
  Assets: {screenshot_count} screenshots
  Word count: {word_count}

  Deployed via wrangler direct upload.
```

## Deployment Setup (One-Time, COMPLETED)

The Cloudflare Pages project `beebumwisdom` is already created and configured:
- **Project URL:** https://beebumwisdom.pages.dev/
- **Deploy command:** `npx wrangler pages deploy dist --project-name beebumwisdom --branch main`
- **Auth:** `npx wrangler login` (OAuth via browser, already authenticated)
- **Build:** Pure static (no Cloudflare adapter/Worker needed)

### Custom Domain (beebumwisdom.com)

To connect the custom domain:
1. Add beebumwisdom.com as a zone in Cloudflare (free plan)
2. Update nameservers at domain registrar
3. In Pages > beebumwisdom > Custom domains > Add `beebumwisdom.com`
