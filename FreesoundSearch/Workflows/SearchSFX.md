# SearchSFX Workflow

Search Freesound.org for sound effects and download previews for review.

---

## When to Use

- User says "search freesound" or "find sfx" or "download sound effects"
- User wants to source SFX for a specific story
- User references Freesound or wants to find sounds for audio cues

---

## Workflow

### Step 1: Check API Key

Verify `FREESOUND_API_KEY` is available:

```bash
echo $FREESOUND_API_KEY
```

If not set, check for `.env` file at vault root (`D:\Projects\StoryProductionVault\.env`). If neither exists, tell the user:
- Get a free API key at https://freesound.org/apiv2/apply
- Set it: `set FREESOUND_API_KEY=your_key` or add to `.env`

### Step 2: Determine Search Mode

**Single search** — user provides a specific query:
```bash
python "D:\Projects\StoryProductionVault\500_production\510_scripts\510_400_assets\freesound_search.py" --query "QUERY" --story-id STORY_ID
```

**Batch search** — user wants to search all pending SFX for a story:
1. Identify the story (ask if not clear)
2. Find the asset manifest: `300_stories/310_story/[id]/[id]_assets.md`
3. Run:
```bash
python "D:\Projects\StoryProductionVault\500_production\510_scripts\510_400_assets\freesound_search.py" --manifest "MANIFEST_PATH" --batch --story-id STORY_ID
```

### Step 3: Download (if requested)

Add `--download` flag to download HQ preview MP3s to `400_media/420_audio/_staging/[story_id]/`:

```bash
python "D:\Projects\StoryProductionVault\500_production\510_scripts\510_400_assets\freesound_search.py" --manifest "MANIFEST_PATH" --batch --download --story-id STORY_ID
```

### Step 4: Review & Ingest

After downloading, the script prints ingest commands. The user should:
1. Listen to the previews in `420_audio/_staging/[story_id]/`
2. Delete unwanted files
3. Run ingest commands for keepers:
```bash
python "D:\Projects\StoryProductionVault\500_production\510_scripts\510_400_assets\ingest_generated_asset.py" "path/to/sfx.mp3" "story_file.md" -g freesound -n "sfx_name"
```

### Options Reference

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--query` | `-q` | — | Single search query |
| `--manifest` | `-m` | — | Asset manifest path (for batch) |
| `--batch` | `-b` | off | Batch mode |
| `--download` | `-d` | off | Download top result previews |
| `--story-id` | `-s` | — | Story ID |
| `--license` | `-l` | cc0 | License filter: cc0, cc-by, cc-by-nc, all |
| `--results` | `-r` | 5 | Number of results to show |
| `--sort` | — | rating_desc | Sort: rating_desc, score, downloads_desc |
| `--min-duration` | — | 0.5 | Min duration (seconds) |
| `--max-duration` | — | 30 | Max duration (seconds) |

---

## Notes

- Previews are HQ MP3 — no OAuth2 needed (just API key token auth)
- Full-quality WAV download requires OAuth2 (future enhancement)
- CC0 is the default filter — broadest commercial use rights
- Use `--license cc-by` if CC0 returns too few results (add attribution in credits)
- Designed silence cues are auto-skipped (generate in DAW instead)
- Duplicate/near-duplicate cues are auto-deduplicated in batch mode
