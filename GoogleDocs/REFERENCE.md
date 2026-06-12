# GoogleDocs — Docs API reference

How `gdoc.py` talks to the Google Docs API, the mental model that took longest to learn, and the request shapes that come up most.

## Mental model

The Docs API has **one important endpoint** for mutations: `documents.batchUpdate`. It takes an **ordered list of requests** and applies them sequentially against a single document. Each request operates on **absolute document indices** — character positions in the doc's body. There is no concept of "anchors" or relative positions.

Reads use `documents.get`, which returns a JSON tree of structural elements (paragraphs, runs, tables) with `startIndex` and `endIndex` on each element.

**The doc is text + style overlays.** When you insert text, you're inserting raw characters. To make a paragraph a heading, you issue a SECOND request that says "the paragraph at this index has `namedStyleType: HEADING_2`." Same pattern for bullets: insert text first, THEN apply `createParagraphBullets` to a range.

## Indices, off-by-one, and the trailing newline

Two pitfalls cost real time:

1. **`updateParagraphStyle` range must include the trailing newline.** If your heading text is at indices `100..125` (i.e. 25 characters), the range to style it is `startIndex: 100, endIndex: 126` (covering the `\n` at 125). Style without the `\n` and the next paragraph inherits the style. Style WITH the `\n` and the next paragraph stays clean.

2. **`createParagraphBullets` operates on whole paragraphs.** Pass a range and EVERY paragraph touching that range becomes a bullet. So for a contiguous run of bullet lines, give one request covering the whole run (with `endIndex` past the last newline). Bullet preset: `BULLET_DISC_CIRCLE_SQUARE` is the standard `•` ◦ ▪ nested hierarchy.

## Recipe — appending a styled section with bullets

This is what `gdoc.py append-section` does. The input is:

```
Notes
- bullet1
- bullet2

Action items
- bullet3
```

The output should be: an H2 heading, plain text "Notes", three bulleted paragraphs, plain text "Action items", one bulleted paragraph.

```python
# 1. Find where to insert
end = doc.body.content[-1].endIndex - 1  # the doc's end-of-body cursor

# 2. Parse body: strip "- " prefix from bullet lines, record their offsets
cleaned_body, bullet_rel_ranges = parse_body_with_bullets(raw_body)

# 3. Build the insertion string
insertion = f"\n{heading_text}\n{cleaned_body}"
heading_start = end + 1
heading_end   = heading_start + len(heading_text)
body_start    = heading_end + 1  # past the newline after the heading

# 4. Emit batchUpdate requests, in order:
requests = [
    {"insertText":          {"location": {"index": end}, "text": insertion}},
    {"updateParagraphStyle": {
        "range": {"startIndex": heading_start, "endIndex": heading_end + 1},
        "paragraphStyle": {"namedStyleType": "HEADING_2"},
        "fields": "namedStyleType"
    }},
]
for (rel_start, rel_end) in bullet_rel_ranges:
    requests.append({"createParagraphBullets": {
        "range": {
            "startIndex": body_start + rel_start,
            "endIndex":   body_start + rel_end + 1   # +1 to include the trailing \n
        },
        "bulletPreset": "BULLET_DISC_CIRCLE_SQUARE"
    }})
```

**Critical: do NOT include the `- ` prefix in the inserted text.** The Doc renders the bullet marker itself. Inserting `- foo` and then bulleting it produces `•  - foo`.

## Common request shapes

| Operation | Request | Notes |
|---|---|---|
| Insert text | `{"insertText": {"location": {"index": i}, "text": str}}` | Insert at cursor `i`. Newlines in `str` create new paragraphs. |
| Apply heading style | `{"updateParagraphStyle": {"range": {...}, "paragraphStyle": {"namedStyleType": "HEADING_2"}, "fields": "namedStyleType"}}` | `HEADING_1` / `_2` / `_3` / `_4` / `NORMAL_TEXT` / `TITLE` / `SUBTITLE`. Always set `fields` or the API rejects the request. |
| Bulleted list | `{"createParagraphBullets": {"range": {...}, "bulletPreset": "BULLET_DISC_CIRCLE_SQUARE"}}` | Other presets: `NUMBERED_DECIMAL_NESTED`, `BULLET_ARROW_DIAMOND_DISC`, `BULLET_CHECKBOX`. |
| Remove bullets | `{"deleteParagraphBullets": {"range": {...}}}` | |
| Delete range | `{"deleteContentRange": {"range": {"startIndex": i, "endIndex": j}}}` | Removes characters `i..j-1`. |
| Find/replace | `{"replaceAllText": {"containsText": {"text": "old", "matchCase": true}, "replaceText": "new"}}` | Global across the doc. Response includes `replies[].replaceAllText.occurrencesChanged`. |

## Reading + walking the doc

`documents.get` returns `body.content[]` — a list of structural elements. Each can be a `paragraph`, `sectionBreak`, `table`, or `tableOfContents`. Walking paragraphs:

```python
for elem in doc["body"]["content"]:
    para = elem.get("paragraph")
    if not para: continue
    style = para.get("paragraphStyle", {}).get("namedStyleType")  # e.g. "HEADING_2"
    text = "".join(
        r["textRun"]["content"]
        for r in para.get("elements", [])
        if "textRun" in r
    )
    start = elem["startIndex"]
    end   = elem["endIndex"]
```

This is how `gdoc.py delete-section` finds an H2 by exact text and computes the range to the next H2 (or end of body).

## Auth

OAuth desktop-app flow, single user. Scopes: `https://www.googleapis.com/auth/documents` (sufficient for `documents.get` + `documents.batchUpdate`). Drive scope is NOT required for these ops if the user already has edit permission on the Doc.

Token cache: `~/.gdoc_token.json` (refresh token auto-renews access token; refresh fails only if the user revokes consent in Google account settings, in which case delete the cache and re-run).

## Failures and what they mean

| Error | Cause | Fix |
|---|---|---|
| `403 PERMISSION_DENIED` | Account can't edit the Doc OR Docs API not enabled for the OAuth client's project | Check Doc share settings; check GCP project has Docs API enabled |
| `400 Invalid range` | Index out of bounds — usually computed from a stale doc state | Re-fetch the doc; recompute indices |
| `400 The provided text in requests[N].insertText is empty` | Passing `""` as text | Skip the request |
| `invalid_grant` (during refresh) | User revoked consent or token expired beyond grace period | Delete `~/.gdoc_token.json`, re-run, re-consent |
| `RefreshError: Token has been expired or revoked` | Same as above | Same fix |

## What's NOT in gdoc.py (intentional)

- **Sheets / Slides** — separate APIs, separate CLI if/when needed.
- **`apply-styles` markdown conversion** — converting `#`/`##`/`###` markers in EXISTING doc paragraphs to Heading styles. Useful for cleaning up the stale skeleton in already-cloned template docs. Designed in `ai/plans/2026-05-11-gdoc-py-cli-plan.md` but not yet built (low priority — new content goes through `append-section` which handles structure correctly from the start).
- **`list-folder`** — overlaps with Drive MCP; not built.
- **Real-time watching / sync** — out of scope.
