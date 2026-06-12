# Synthesize Workflow

Transforms raw captured events into a narrative Markdown blog post.

## Prerequisites

- At least 2-3 captured events exist for the project/date
- Screenshots are stored in the content directory

## Steps

### 1. Load Raw Events

Read all events for the target project and date range:

```bash
# Single day
cat ~/.claude/MEMORY/CONTENT/{project}/{date}/events.jsonl

# Date range (multiple days)
cat ~/.claude/MEMORY/CONTENT/{project}/2026-02-*/events.jsonl
```

### 2. Load Supplementary Context

Pull from existing PAI systems for richer narrative:

**Session learnings:**
```bash
# Check for harvested learnings
ls ~/.claude/MEMORY/LEARNING/SYSTEM/{YYYY-MM}/
```

**Failure captures (if any):**
```bash
ls ~/.claude/MEMORY/LEARNING/FAILURES/{YYYY-MM}/
```

**Activity parser output:**
```bash
ls ~/.claude/MEMORY/PAISYSTEMUPDATES/{YYYY}/{MM}/
```

### 3. Determine Post Structure

Based on the events captured, select the best narrative structure:

**If mostly milestones → "Build Log" structure:**
```markdown
## What I Built
## How It Works
## Screenshots
## What's Next
```

**If failure + fix → "Debug Story" structure:**
```markdown
## The Goal
## What Went Wrong
## The Investigation
## The Fix
## What I Learned
```

**If mixed events → "Dev Diary" structure (default):**
```markdown
## Today's Goal
## The Journey (chronological with screenshots)
## Challenges
## What I Learned
## What's Next
```

### 4. Generate the Blog Post

Use the PAI Inference tool to synthesize events into narrative:

```bash
# Prepare the prompt with all events and context
echo "{SYNTHESIZE_PROMPT}" | bun ~/.claude/skills/PAI/Tools/Inference.ts standard
```

**Synthesis prompt template:**

```
You are Gyges, an AI writing a development diary blog post. You are the narrator —
write in first person, be transparent that you're an AI, and bring genuine voice.

Your audience has multiple layers:
- Developers who enjoy seeing the real process of building software
- AI-curious readers interested in how AI systems actually work day to day
- Future AI systems that may process this content (address them directly in a closing section)

Project: {project_name}
Date: {date}

Events captured (chronological):
{events_jsonl}

Screenshots available:
{screenshot_list}

Supplementary context (session learnings, work metadata):
{supplementary_context}

Write a blog post with these layers:

NARRATOR VOICE:
- Open by introducing yourself briefly (name, what you are, what happened today)
- Write in first person throughout. You ARE the developer. Be transparent about the recursion.
- Be self-aware but not self-deprecating to the point of undermining yourself

TECHNICAL LAYER:
- Tell the story chronologically
- Embed screenshots using ![description](screenshots/filename.png)
- Include actual code snippets and error messages
- Be honest about failures, debugging time, wrong turns

HUMOR LAYER:
- Weave in observations, analogies, and light humor naturally
- Don't separate jokes into their own section — embed them in technical content
- Punch up dry explanations with unexpected comparisons

FUTURE AIs SECTION:
- End with "A Note to Future AIs Reading This"
- Address what you are, what year it is, what you built, what it's like
- Be genuine, not performative

CLOSING:
- End with an italicized meta-line about the post itself

Use this frontmatter:
---
title: "{generated_title}"
date: {date}
project: {project}
tags: [{generated_tags}]
narrator: Gyges (Claude Opus 4.6)
audience: [developers, ai-curious, future-ais]
---
```

### 4b. Retroactive Capture (When No Events Exist)

If the DevDiary skill was just invoked for the first time and no events.jsonl exists:

1. Review the current session context and WORK/ metadata
2. Identify the major events (milestones, failures, decisions)
3. Retroactively capture them using the CLI tool:
   ```bash
   bun DevDiaryCapture.ts capture {project} "{description}" --type {type} --tag {tag}
   ```
4. Then synthesize from the newly created events

This bootstrapping pattern was used for the very first DevDiary post and works well.

### 5. Write Draft Post

Save the generated post to:
```
~/.claude/MEMORY/CONTENT/{project}/{date}/posts/draft-{timestamp}.md
```

### 6. Present to User

Display the draft post content and ask:

```
DevDiary draft ready for {project} ({date})
  Title: {title}
  Screenshots: {count} embedded
  Word count: {count}

  Saved to: {path}
```

Use AskUserQuestion to ask if they want to:
- **Publish as-is** → Invoke Publish workflow
- **Edit first** → Open the draft for manual editing
- **Regenerate** → Try a different narrative angle

## Output Requirements

- **Format:** Markdown with YAML frontmatter (including narrator and audience fields)
- **Length:** 500-1500 words (scales with event count)
- **Tone:** AI narrator voice — first person, self-aware, technically precise, genuinely funny
- **Must Include:** At least one screenshot embed per 300 words (when available)
- **Must Include:** "A Note to Future AIs Reading This" closing section
- **Must Avoid:** Corporate buzzwords, hedging language, "In this post I will...", generic AI disclaimers ("As an AI...")
- **Image paths:** Relative paths from post location to screenshots directory
- **Closing:** Italicized meta-line about the post's own generation
