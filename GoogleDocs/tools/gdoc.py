#!/usr/bin/env python3
"""
gdoc.py - Google Docs CLI for the GoogleDocs skill.

Auth: OAuth user flow (matches hsproj.py pattern). Token cached at ~/.gdoc_token.json.

Subcommands:
  get               <docId>                              Print plain-text content
  append            <docId> --text "..." | --file PATH   Append text to end of doc
  append-section    <docId> --heading "..." --file PATH  Append H2 + body, lines starting with "- " become bullets
  replace-content   <docId> --file PATH                  Wipe and replace entire doc body
  replace-text      <docId> --from "..." --to "..."      Find/replace via batchUpdate
  delete-section    <docId> --heading "..."              Delete H2 by text + everything until next H2 (or EOF)

See ~/.claude/skills/GoogleDocs/SKILL.md for setup and usage.
"""
import argparse
import json
import os
import sys
from pathlib import Path

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError as e:
    print(
        "error: missing Google API libs. Install with:\n"
        "  pip install --user google-api-python-client google-auth-oauthlib google-auth-httplib2\n"
        f"  ({e})",
        file=sys.stderr,
    )
    sys.exit(1)


SCOPES = ["https://www.googleapis.com/auth/documents"]
DEFAULT_CLIENT = Path.home() / ".gdoc_oauth_client.json"
DEFAULT_TOKEN = Path.home() / ".gdoc_token.json"


def die(msg, code=1):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def load_credentials():
    """Load cached creds, refresh if expired, run OAuth flow if no token yet."""
    client_path = Path(os.environ.get("GDOC_OAUTH_CLIENT") or DEFAULT_CLIENT)
    token_path = Path(os.environ.get("GDOC_TOKEN_FILE") or DEFAULT_TOKEN)

    creds = None
    if token_path.is_file():
        try:
            creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
        except Exception as e:
            print(f"warning: token cache at {token_path} unreadable ({e}), re-authorizing", file=sys.stderr)
            creds = None

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            token_path.write_text(creds.to_json())
            return creds
        except Exception as e:
            print(f"warning: refresh failed ({e}), running full auth flow", file=sys.stderr)
            creds = None

    if not client_path.is_file():
        die(
            f"OAuth client JSON not found at {client_path}.\n"
            f"  1. Go to https://console.cloud.google.com/apis/credentials\n"
            f"  2. Enable Google Docs API on a project you can use\n"
            f"  3. Create OAuth 2.0 Client ID, application type 'Desktop app'\n"
            f"  4. Download the JSON and save it to {client_path}\n"
            f"  5. Re-run this command. A browser will open for the consent flow.\n"
            f"  Override path with env var GDOC_OAUTH_CLIENT."
        )

    flow = InstalledAppFlow.from_client_secrets_file(str(client_path), SCOPES)
    creds = flow.run_local_server(port=0, open_browser=True)
    token_path.write_text(creds.to_json())
    print(f"OAuth token cached to {token_path}", file=sys.stderr)
    return creds


def get_service(creds):
    return build("docs", "v1", credentials=creds, cache_discovery=False)


def doc_end_index(svc, doc_id):
    """Return the end-of-body index (where we'd insert to append)."""
    doc = svc.documents().get(documentId=doc_id, fields="body(content(endIndex))").execute()
    content = doc.get("body", {}).get("content", [])
    if not content:
        return 1
    return content[-1].get("endIndex", 1) - 1


def doc_plain_text(svc, doc_id):
    """Return the plain-text content of a Doc."""
    doc = svc.documents().get(documentId=doc_id).execute()
    out = []
    for elem in doc.get("body", {}).get("content", []):
        para = elem.get("paragraph")
        if not para:
            continue
        for run in para.get("elements", []):
            tr = run.get("textRun")
            if tr and "content" in tr:
                out.append(tr["content"])
    return "".join(out)


def cmd_get(args, svc):
    text = doc_plain_text(svc, args.doc_id)
    sys.stdout.write(text)
    if not text.endswith("\n"):
        sys.stdout.write("\n")


def cmd_append(args, svc):
    if args.text and args.file:
        die("pass --text OR --file, not both")
    if not args.text and not args.file:
        die("pass --text or --file")
    body_text = args.text if args.text else Path(args.file).read_text(encoding="utf-8")
    if not body_text.startswith("\n"):
        body_text = "\n" + body_text
    end = doc_end_index(svc, args.doc_id)
    requests = [{"insertText": {"location": {"index": end}, "text": body_text}}]
    if args.dry_run:
        print(json.dumps(requests, indent=2))
        return
    svc.documents().batchUpdate(documentId=args.doc_id, body={"requests": requests}).execute()
    print(f"appended {len(body_text)} chars to {args.doc_id}")


def parse_body_with_bullets(body_text):
    """
    Parse body text. Lines starting with optional whitespace then "- " become bullet items.
    The "- " prefix is stripped from output. Returns (cleaned_text, bullet_rel_ranges).
    bullet_rel_ranges is a list of (start_offset, end_offset) tuples for each contiguous
    bullet run, measured from the start of cleaned_text. end_offset is the index of the
    LAST CHAR of the last bullet line in the run (not exclusive).
    """
    raw_lines = body_text.splitlines()
    cleaned_lines = []
    bullet_line_idxs = []
    for i, line in enumerate(raw_lines):
        stripped = line.lstrip()
        if stripped.startswith("- "):
            cleaned_lines.append(stripped[2:])
            bullet_line_idxs.append(i)
        else:
            cleaned_lines.append(line)
    cleaned_text = "\n".join(cleaned_lines)
    if body_text.endswith("\n"):
        cleaned_text += "\n"

    # Compute per-line (start, end-of-content) offsets in cleaned_text
    line_offsets = []
    pos = 0
    for line in cleaned_lines:
        line_offsets.append((pos, pos + len(line)))
        pos += len(line) + 1  # +1 for newline

    # Group consecutive bullet line indices into runs
    bullet_rel_ranges = []
    if bullet_line_idxs:
        run_start = bullet_line_idxs[0]
        prev = bullet_line_idxs[0]
        for idx in bullet_line_idxs[1:]:
            if idx == prev + 1:
                prev = idx
            else:
                bullet_rel_ranges.append((line_offsets[run_start][0], line_offsets[prev][1]))
                run_start = idx
                prev = idx
        bullet_rel_ranges.append((line_offsets[run_start][0], line_offsets[prev][1]))

    return cleaned_text, bullet_rel_ranges


def cmd_append_section(args, svc):
    """Append an H2 heading + body. Lines starting with '- ' become bulleted paragraphs."""
    heading_text = args.heading
    raw_body = Path(args.file).read_text(encoding="utf-8") if args.file else (args.text or "")
    if not heading_text:
        die("--heading is required")

    cleaned_body, bullet_rel_ranges = parse_body_with_bullets(raw_body)

    end = doc_end_index(svc, args.doc_id)
    # Block we insert: "\n<heading>\n<cleaned_body>"
    insertion = f"\n{heading_text}\n{cleaned_body}"
    if not insertion.endswith("\n"):
        insertion += "\n"

    heading_start = end + 1  # after leading "\n"
    heading_end = heading_start + len(heading_text)
    body_start = heading_end + 1  # after newline that terminates heading

    requests = [
        {"insertText": {"location": {"index": end}, "text": insertion}},
        {
            "updateParagraphStyle": {
                "range": {"startIndex": heading_start, "endIndex": heading_end + 1},
                "paragraphStyle": {"namedStyleType": "HEADING_2"},
                "fields": "namedStyleType",
            }
        },
    ]
    for (rel_start, rel_end) in bullet_rel_ranges:
        abs_start = body_start + rel_start
        # +1 so the range includes the trailing newline of the last bullet line —
        # ensures Docs treats the final paragraph as part of the bulleted range
        abs_end = body_start + rel_end + 1
        requests.append({
            "createParagraphBullets": {
                "range": {"startIndex": abs_start, "endIndex": abs_end},
                "bulletPreset": "BULLET_DISC_CIRCLE_SQUARE",
            }
        })

    if args.dry_run:
        print(json.dumps(requests, indent=2))
        return
    svc.documents().batchUpdate(documentId=args.doc_id, body={"requests": requests}).execute()
    print(
        f"appended H2 section '{heading_text}' "
        f"({len(cleaned_body)} chars body, {len(bullet_rel_ranges)} bullet runs) "
        f"to {args.doc_id}"
    )


def cmd_delete_section(args, svc):
    """Delete from an H2 heading by exact text down to the next H2 (or EOF)."""
    doc = svc.documents().get(documentId=args.doc_id).execute()
    content = doc.get("body", {}).get("content", [])

    target = None
    next_h2_start = None
    for elem in content:
        para = elem.get("paragraph")
        if not para:
            continue
        style = para.get("paragraphStyle", {}).get("namedStyleType")
        if style != "HEADING_2":
            continue
        text = "".join(
            r.get("textRun", {}).get("content", "")
            for r in para.get("elements", [])
        ).rstrip("\n")
        if target is None and text == args.heading:
            target = elem
        elif target is not None and next_h2_start is None:
            next_h2_start = elem.get("startIndex")
            break

    if target is None:
        die(f"H2 heading '{args.heading}' not found")

    start = target.get("startIndex")
    if next_h2_start is not None:
        end = next_h2_start
    else:
        # delete through end of body
        end = content[-1].get("endIndex", 1) - 1

    if end <= start:
        die(f"computed empty range start={start} end={end}; nothing to delete")

    requests = [{"deleteContentRange": {"range": {"startIndex": start, "endIndex": end}}}]
    if args.dry_run:
        print(json.dumps(requests, indent=2))
        return
    svc.documents().batchUpdate(documentId=args.doc_id, body={"requests": requests}).execute()
    print(f"deleted section '{args.heading}' (chars {start}-{end})")


def cmd_replace_content(args, svc):
    """Wipe the entire body and replace with file content."""
    new_text = Path(args.file).read_text(encoding="utf-8")
    doc = svc.documents().get(documentId=args.doc_id, fields="body(content(endIndex))").execute()
    content = doc.get("body", {}).get("content", [])
    if not content:
        end = 1
    else:
        end = content[-1].get("endIndex", 1) - 1
    requests = []
    if end > 1:
        requests.append({"deleteContentRange": {"range": {"startIndex": 1, "endIndex": end}}})
    if new_text:
        requests.append({"insertText": {"location": {"index": 1}, "text": new_text}})
    if args.dry_run:
        print(json.dumps(requests, indent=2))
        return
    if requests:
        svc.documents().batchUpdate(documentId=args.doc_id, body={"requests": requests}).execute()
    print(f"replaced body of {args.doc_id} with {len(new_text)} chars")


def cmd_replace_text(args, svc):
    requests = [
        {
            "replaceAllText": {
                "containsText": {"text": args.from_text, "matchCase": True},
                "replaceText": args.to_text,
            }
        }
    ]
    if args.dry_run:
        print(json.dumps(requests, indent=2))
        return
    resp = svc.documents().batchUpdate(documentId=args.doc_id, body={"requests": requests}).execute()
    replaced = resp.get("replies", [{}])[0].get("replaceAllText", {}).get("occurrencesChanged", 0)
    print(f"replaced {replaced} occurrences in {args.doc_id}")


def build_parser():
    p = argparse.ArgumentParser(prog="gdoc", description="Google Docs CLI (OAuth)")
    p.add_argument("--dry-run", action="store_true", help="print batchUpdate request without sending")
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("get", help="print plain-text content")
    g.add_argument("doc_id")

    a = sub.add_parser("append", help="append text to end of doc")
    a.add_argument("doc_id")
    a.add_argument("--text")
    a.add_argument("--file")

    s = sub.add_parser("append-section", help="append H2 heading + body to end")
    s.add_argument("doc_id")
    s.add_argument("--heading", required=True)
    s.add_argument("--text")
    s.add_argument("--file")

    r = sub.add_parser("replace-content", help="wipe doc and insert file content")
    r.add_argument("doc_id")
    r.add_argument("--file", required=True)

    rt = sub.add_parser("replace-text", help="batchUpdate replaceAllText")
    rt.add_argument("doc_id")
    rt.add_argument("--from", dest="from_text", required=True)
    rt.add_argument("--to", dest="to_text", required=True)

    d = sub.add_parser("delete-section", help="delete H2 by text + everything until next H2 or EOF")
    d.add_argument("doc_id")
    d.add_argument("--heading", required=True)

    return p


def main():
    parser = build_parser()
    args = parser.parse_args()
    creds = load_credentials()
    svc = get_service(creds)

    handlers = {
        "get": cmd_get,
        "append": cmd_append,
        "append-section": cmd_append_section,
        "replace-content": cmd_replace_content,
        "replace-text": cmd_replace_text,
        "delete-section": cmd_delete_section,
    }
    try:
        handlers[args.cmd](args, svc)
    except HttpError as e:
        die(f"Google API error: {e}")


if __name__ == "__main__":
    main()
