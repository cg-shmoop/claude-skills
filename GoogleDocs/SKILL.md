---
name: GoogleDocs
description: Read, append, and replace content in Google Docs via OAuth. USE WHEN edit google doc, append to google doc, replace text in google doc, gdoc.py, paste meeting notes into doc, project doc append, write to google doc, batchUpdate. Drive MCP can't edit Docs — this CLI fills that gap.
---

# GoogleDocs skill

`gdoc.py` — OAuth-authenticated CLI for Google Docs. Fills the gap left by the `claude.ai Google Drive` MCP, which can read/copy/create files but cannot edit Doc content.

## Why this exists

The pipeline `transcript → AI parse → append dated meeting section to project Doc` needs to **edit** Docs. The Drive MCP has no edit/append capability. So we use the Google Docs API directly via `documents.batchUpdate`.

## Setup (one-time)

1. Go to https://console.cloud.google.com/apis/credentials in a GCP project you control.
2. Enable the **Google Docs API** for that project (APIs & Services → Library → "Google Docs API" → Enable).
3. Configure the **OAuth consent screen** if not already done. User type: External (or Internal if you're in a Workspace). Add yourself as a test user. Scope: `https://www.googleapis.com/auth/documents`.
4. Create credentials: **OAuth 2.0 Client ID** → application type: **Desktop app** → name it whatever (e.g. "gdoc.py local").
5. Download the JSON. Save it to `~/.gdoc_oauth_client.json`.
6. Run any `gdoc.py` command. A browser tab opens, you consent, the refresh token is cached to `~/.gdoc_token.json`. Subsequent runs are silent.

Override paths with env vars `GDOC_OAUTH_CLIENT` and `GDOC_TOKEN_FILE` if needed.

## Subcommands

```bash
python ~/.claude/skills/GoogleDocs/tools/gdoc.py <command> [args]
```

| Command | Signature | Purpose |
|---|---|---|
| `get` | `<docId>` | Print plain-text content of the Doc |
| `append` | `<docId> --text "..."` or `--file PATH` | Insert text at end of body |
| `append-section` | `<docId> --heading "H2 text" --file PATH` | Append H2 heading + body. **Lines starting with `- ` or `  - ` become bulleted paragraphs**; the dash prefix is stripped and `createParagraphBullets` is applied. |
| `replace-content` | `<docId> --file PATH` | Wipe entire body, insert file content |
| `replace-text` | `<docId> --from "old" --to "new"` | Batch find/replace via `replaceAllText` |
| `delete-section` | `<docId> --heading "H2 text"` | Find an H2 by exact text, delete from there to the next H2 (or EOF). Pair with `append-section` to redo a section. |

Global flag: `--dry-run` prints the `batchUpdate` request JSON without sending.

## Examples

```bash
# Read a Doc
python gdoc.py get <docId>

# Append a meeting-notes section
python gdoc.py append-section <docId> \
  --heading "2026-05-11 | Weekly sync" \
  --file ./meeting-notes.md

# Fix a stale field
python gdoc.py replace-text <docId> --from "Status: blocked" --to "Status: on_track"
```

## Common errors

- **`OAuth client JSON not found`** → finish the GCP setup, save `client_secret.json` to `~/.gdoc_oauth_client.json`.
- **`403 PERMISSION_DENIED`** → your Google account doesn't have edit permission on the Doc, OR the Docs API isn't enabled for the OAuth client's GCP project.
- **`invalid_grant`** → token expired beyond refresh window. Delete `~/.gdoc_token.json` and re-run any command to re-authorize.

## Related

- `~/.claude/skills/GoogleDocs/REFERENCE.md` — Docs API mental model, request shapes, and the bullet-formatting recipe
