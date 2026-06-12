---
name: EnrichPrompts
description: Enrich structural image prompts with rich visual descriptions using Claude's own capabilities. USE WHEN user says enrich prompts, enrich image prompts, fill in prompts, write visual descriptions, describe assets, OR wants to add descriptions to empty/structural prompt files in StoryProductionVault.
---

# EnrichPrompts

Reads story scene descriptions, visual language rules, and style seed to generate cinematographically-informed visual descriptions and video motion layer for each image prompt file (characters, backgrounds, symbols). Writes both image and video layer descriptions directly into prompt files in a single pass using Claude Code's Max subscription — no external API needed.

This skill operates on the StoryProductionVault production pipeline. It fills the gap between `GenerateImagePrompts` (structural templates) and `GenerateAssets` (image generation) by adding rich, specific visual descriptions that an image generator can use.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/EnrichPrompts/`

Customizable elements:
- `PREFERENCES.md` — Default style seed, description length, tone preferences
- Additional style constraints or aesthetic rules

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **EnrichPrompts** | "enrich prompts", "enrich [story] prompts", "fill in prompt descriptions" | `Workflows/EnrichPrompts.md` |

## Quick Reference

- **Input:** Asset manifest path OR story folder path
- **Reads:** Story scenes file (shot Visual: lines), visual language rules, style seed
- **Writes:** Image descriptions + Video Layer section into each `char_*.md`, `bg_*.md`, `symbol_*.md` prompt file
- **Provenance:** Adds `enriched_by: claude-code-opus` and `enriched_at` to frontmatter
- **Idempotent:** Safe to re-run — overwrites previous enrichment with fresh descriptions
- **Single pass:** Both image and video layers generated together from the same story context

## Examples

**Example 1: Enrich all prompts for a story**
```
User: "enrich prompts for Gutei"
-> Reads 310_001_gutei_scenes.md for visual context
-> Finds 16 prompt files (4 chars, 7 backgrounds, 5 symbols)
-> Generates visual descriptions for each
-> Writes back with provenance
```

**Example 2: Re-enrich after story edits**
```
User: "I changed the Gutei scene descriptions, re-enrich the prompts"
-> Re-reads story context
-> Regenerates all descriptions to match updated scenes
-> Overwrites previous enrichment
```

## Output Layers

Each enriched prompt file contains two layers:

| Layer | Section | Purpose |
|-------|---------|---------|
| **Image** | Description paragraph (after header) | Static image generation (Flux, Nano Banana, Imagen) |
| **Video** | `## Video Layer` (before Lineage) | Video AI platforms (Grok, Leonardo AI, RunwayML) — motion, timing, transitions |

Both layers are generated in a single pass from the same story context.

## File Conventions

| Pattern | Location | Example |
|---------|----------|---------|
| Story scenes | `300_stories/310_story/[id]/[id]_scenes.md` | `310_001_gutei_scenes.md` |
| Asset manifest | `300_stories/310_story/[id]/[id]_assets.md` | `310_001_gutei_assets.md` |
| Prompt files | `300_stories/310_story/[id]/prompts/*.md` | `char_gutei.md`, `bg_title.md` |
| Style seed | `000_config/020_ai_prompts/visual/style_seed_*.md` | `style_seed_zen_ink_v1.md` |
| Meta-prompt | `000_config/020_ai_prompts/visual/enrich_prompt_v1.md` | Reference template |
