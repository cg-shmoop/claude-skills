# EnrichPrompts Workflow

Enrich all image prompt files for a story with rich visual descriptions, using Claude Code's own generation capabilities (Max subscription, no API needed).

---

## When to Use

- User says "enrich prompts" or "enrich prompts for [story]"
- User says "fill in the prompt descriptions"
- User says "write visual descriptions for the assets"
- Prompt files exist but have empty or placeholder descriptions
- After running `GenerateImagePrompts` which creates structural templates

---

## Workflow

### Step 1: Identify the Story

Determine which story to enrich. The user may provide:
- A story name (e.g., "Gutei") — search `300_stories/310_story/` for matching folder
- A manifest path — use directly
- Nothing — list available stories and ask

**Find these files:**
- Story scenes: `300_stories/310_story/[id]/[id]_scenes.md`
- Asset manifest: `300_stories/310_story/[id]/[id]_assets.md`
- Prompt files: `300_stories/310_story/[id]/prompts/*.md`

### Step 2: Read Story Context

Read the story scenes file completely. Extract:

1. **All Visual: lines** from every shot — these contain the rich visual descriptions
2. **Visual Language Rules** — symbolic meaning assignments (e.g., "Radial distortion = kensho / insight")
3. **Scene headers** — scene names and narratives for environment context

### Step 3: Read Style Seed

Read the style seed file referenced in the manifest (usually `style_seed_zen_ink_v1.md` at `000_config/020_ai_prompts/visual/`). This defines the global aesthetic constraints.

### Step 4: Read All Prompt Files

Read every `char_*.md`, `bg_*.md`, and `symbol_*.md` file in the story's `prompts/` directory. Note each file's:
- `asset_type` (character, background, symbol)
- `asset_name`
- Current description (may be empty or placeholder)

### Step 5: Generate Enriched Descriptions

For each prompt file, generate **two layers** in a single pass:

1. **Image Layer** — a detailed visual description paragraph (4-8 sentences) for static image generation
2. **Video Layer** — a motion/animation description paragraph (3-6 sentences) for video AI platforms (Grok, Leonardo AI, RunwayML)

Both layers draw from the same story context. Generate them together.

#### Image Layer Rules (by asset type)

**Characters:**
- Gather all Visual: lines from shots where this character's name appears
- Describe: physical appearance, age, clothing, posture, expression, distinguishing features
- This is a neutral base pose cutout — do NOT describe actions or scenes
- The description sits between the `# Character Prompt: Name` header and the `Centered figure, full body visible.` structural line

**Backgrounds:**
- Gather all Visual: lines from the scene matching this environment name
- Describe: architecture, spatial layout, lighting, atmosphere, depth planes
- No people. Designed as a flat background plate
- The description replaces the `Scene environment: [Name]` placeholder line, before `Perspective slightly frontal`

**Symbols:**
- Gather Visual: lines where this symbol appears + its meaning from visual language rules
- Describe: graphic form, visual weight, texture, rendering technique
- Minimalist. Flat. Transparent background
- The description replaces the meaning line (e.g., "kensho / insight"), before `Minimalist.`

#### Video Layer Rules (by asset type)

The video layer goes in a `## Video Layer` section inserted between the `Avoid:` block and the `---` / `**Lineage:**` section at the bottom of the file.

**Characters:**
- Idle motion: subtle breathing, cloth sway, weight shifts (2-3 seconds loop)
- Key actions: the primary movements this character performs across shots (raising finger, running, bowing)
- Expression transitions: how their face changes across the story arc
- Entry/exit: how they typically appear in and leave scenes

**Backgrounds:**
- Parallax planes: which elements are foreground, midground, background and their relative scroll speeds
- Atmospheric animation: fog drift, light shifts, particle effects (dust motes, incense smoke)
- Environmental motion: wind effects, flickering light, water movement
- Transitions: how this environment connects to adjacent scenes (fade, dissolve, cut)

**Symbols:**
- Appearance: how it materializes (fade in, burst outward, brush-stroke draw-on)
- Active behavior: pulsing, expanding, rotating, rippling
- Dissolution: how it exits (fade, scatter, absorb into character)
- Timing: typical duration on screen and pace of animation

**Video Layer Writing Guidelines:**
- Describe motion in terms a video AI can interpret: direction, speed, easing, duration
- Reference specific shots from the story where this asset animates
- Keep descriptions platform-agnostic — usable by any video generation tool
- Do NOT repeat the static image description — assume the image layer is the starting frame
- Use present tense: "The fog drifts left to right" not "The fog should drift"

### Step 6: Write Enriched Files

For each prompt file:
1. Use Edit to insert the image layer description between the header and the structural lines
2. Use Edit to insert a `## Video Layer` section between the `Avoid:` block and the `---` / `**Lineage:**` at the bottom
3. Add provenance to frontmatter:
   ```yaml
   enriched_by: "claude-code-opus"
   enriched_at: "[ISO timestamp]"
   ```

### Step 7: Verify

- Read 2-3 enriched files to confirm structure is intact
- Confirm frontmatter has enrichment provenance
- Confirm image description sits correctly between header and structural lines
- Confirm `## Video Layer` section exists between Avoid block and Lineage
- Confirm lineage wikilinks are preserved at bottom
- Report count: X characters, Y backgrounds, Z symbols enriched (image + video)

---

## Output Format

After enrichment, report a summary table:

```
| Asset | Type | Image Description | Video Layer |
|-------|------|-------------------|-------------|
| Gutei | character | Elderly monk, shaved head... | Subtle breathing, finger raise... |
| Boy | character | Young attendant, missing finger... | Running motion, pain clutch... |
| ... | ... | ... | ... |
```

---

## Notes

- **Idempotent:** Safe to re-run. New descriptions overwrite previous ones.
- **No API needed:** Uses Claude Code Max subscription credits, not external API.
- **Python fallback:** The `enrich_image_prompts.py` script exists for automated runs via Ollama/Gemini/Anthropic API when Claude Code is not in the loop.
- **Video layer included:** Both static image and video motion descriptions are generated in a single pass per asset.
