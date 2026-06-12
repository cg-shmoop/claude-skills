---
name: FreesoundSearch
description: Search Freesound.org for sound effects matching story SFX cues and download previews for review. USE WHEN user says search freesound, find sound effects, search sfx, download sfx, freesound search, source sfx, OR wants to find sound effects for a story's audio cues from Freesound.org.
---

# FreesoundSearch

Searches the Freesound.org API for sound effects matching SFX cue descriptions from the StoryProductionVault asset manifests. Downloads HQ preview files for human review before ingestion into the vault.

This skill wraps `freesound_search.py` — a Python CLI tool that calls the Freesound APIv2.

## Prerequisites

- **Freesound API key** — Get one at https://freesound.org/apiv2/apply
- Set as environment variable `FREESOUND_API_KEY` or in `D:\Projects\StoryProductionVault\.env`

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/FreesoundSearch/`

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **SearchSFX** | "search freesound", "find sfx", "download sound effects", "source sfx for [story]" | `Workflows/SearchSFX.md` |

## Quick Reference

- **Script:** `500_production/510_scripts/510_400_assets/freesound_search.py`
- **Staging dir:** `400_media/420_audio/_staging/[story_id]/`
- **Ingest:** Use `ingest_generated_asset.py` with `-g freesound` after review
- **License default:** CC0 (no attribution). Use `--license cc-by` for more results.
- **SFX guide:** `700_docs/SFX_SOURCING.md`

## Examples

**Example 1: Search for a specific sound**
```
User: "search freesound for temple bell sounds"
-> Runs: python freesound_search.py --query "temple bell" --story-id gutei
-> Shows top 5 results with name, duration, license, rating
```

**Example 2: Batch search all pending SFX for a story**
```
User: "find sound effects for Gutei story"
-> Runs: python freesound_search.py --manifest 310_001_gutei_assets.md --batch
-> Searches all 30 pending SFX cues, shows best match for each
```

**Example 3: Search and download previews**
```
User: "download freesound previews for Gutei sfx"
-> Runs: python freesound_search.py --manifest 310_001_gutei_assets.md --batch --download
-> Downloads HQ MP3 previews to 420_audio/_staging/gutei/
-> Prints ingest commands for each downloaded file
```
