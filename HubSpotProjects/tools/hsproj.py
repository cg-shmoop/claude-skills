#!/usr/bin/env python3
"""
hsproj.py — HubSpot Projects (custom object 0-970) CLI.

Zero-dependency Python (stdlib only). Designed to be invoked from any
working directory via the HubSpotProjects skill.

See ~/.claude/skills/HubSpotProjects/SKILL.md for docs.

Portal configuration
--------------------
The pipeline and stage IDs below are portal-specific. Point this CLI at your
own portal before the stage-aware commands work:

  * HUBSPOT_PORTAL_ID            — your portal ID (used to build record URLs)
  * HUBSPOT_PROJECT_PIPELINE_ID  — your Project pipeline UUID
  * STAGES (below)               — fill in your portal's stage UUIDs; discover
                                   them from the hs_pipeline_stage property
                                   metadata:
                                   GET /crm/v3/properties/0-970/hs_pipeline_stage
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

PORTAL_ID = os.environ.get("HUBSPOT_PORTAL_ID", "YOUR_PORTAL_ID")
OBJECT_TYPE = "0-970"  # HubSpot standard Projects object (same across portals)
PROJECT_PIPELINE_ID = os.environ.get("HUBSPOT_PROJECT_PIPELINE_ID", "<your-project-pipeline-id>")

# Portal-specific stage UUIDs. Replace the placeholders with your portal's
# values (see GET /crm/v3/properties/0-970/hs_pipeline_stage).
STAGES = {
    "planning":  "<planning-stage-id>",
    "execution": "<execution-stage-id>",
    "review":    "<review-stage-id>",
    "completed": "<completed-stage-id>",
    "cancelled": "<cancelled-stage-id>",
    "on_hold":   "<on_hold-stage-id>",
}
STAGE_ID_TO_NAME = {v: k for k, v in STAGES.items()}

STATUSES = {"on_track", "delayed", "blocked", "completed", "on_hold", "at_risk"}

API = "https://api.hubapi.com"
DEFAULT_READ_PROPS = [
    "hs_name", "hs_status", "hs_pipeline", "hs_pipeline_stage",
    "hubspot_owner_id", "hs_start_date", "hs_target_due_date",
    "hs_close_date", "hs_createdate", "hs_lastmodifieddate",
    "hs_description",
]


def die(msg, code=1):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def load_token():
    tok = os.environ.get("HUBSPOT_PROJECTS_TOKEN")
    if tok:
        return tok.strip()
    candidates = [
        Path.home() / ".hubspot_projects_token",
    ]
    for p in candidates:
        try:
            if p.is_file():
                val = p.read_text().strip()
                if val:
                    return val
        except OSError:
            pass
    die(
        "no HubSpot token found. Set HUBSPOT_PROJECTS_TOKEN or put a pat-na1-... "
        "token in ~/.hubspot_projects_token"
    )


def hs_request(method, path, token, body=None, query=None):
    url = f"{API}{path}"
    if query:
        url += "?" + urllib.parse.urlencode(query, doseq=True)
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": f"Bearer {token}"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw}
        # Surface scope errors clearly
        if e.code == 403 and isinstance(parsed, dict):
            ctx = ""
            for err in parsed.get("errors", []):
                scopes = err.get("context", {}).get("requiredGranularScopes")
                if scopes:
                    ctx = f" (add scope: {', '.join(scopes)})"
            die(f"403 from {method} {path}{ctx}: {parsed.get('message', raw)}")
        if e.code == 401:
            die(f"401 Unauthorized — token invalid or expired: {parsed.get('message', raw)}")
        die(f"HTTP {e.code} from {method} {path}: {parsed}")


def ms_from_date(s):
    """Accepts YYYY-MM-DD or M/D/YYYY. Returns epoch milliseconds at UTC midnight."""
    if s is None:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            d = datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
            return str(int(d.timestamp() * 1000))
        except ValueError:
            continue
    die(f"unparseable date: {s!r} (expected YYYY-MM-DD)")


def fmt_date(iso):
    if not iso:
        return ""
    try:
        return iso.split("T")[0]
    except Exception:
        return iso


def resolve_stage(name):
    if name is None:
        return None
    key = name.lower().replace("-", "_").replace(" ", "_")
    if key in STAGES:
        return STAGES[key]
    if name in STAGES.values():
        return name
    die(f"unknown stage {name!r}. Options: {', '.join(STAGES)}")


def resolve_status(name):
    if name is None:
        return None
    key = name.lower().replace("-", "_").replace(" ", "_")
    if key in STATUSES:
        return key
    die(f"unknown status {name!r}. Options: {', '.join(sorted(STATUSES))}")


_owners_cache = None


def load_owners(token):
    global _owners_cache
    if _owners_cache is None:
        _, d = hs_request("GET", "/crm/v3/owners/", token, query={"limit": 100})
        _owners_cache = d.get("results", [])
    return _owners_cache


def resolve_owner(email_or_id, token):
    if email_or_id is None:
        return None
    if email_or_id.isdigit():
        return email_or_id
    for o in load_owners(token):
        if (o.get("email") or "").lower() == email_or_id.lower():
            return str(o["id"])
    die(f"no owner with email {email_or_id!r} (try: hsproj.py owners)")


def build_properties(args, token):
    props = {}
    if getattr(args, "name", None):
        props["hs_name"] = args.name
    if getattr(args, "description", None):
        props["hs_description"] = args.description
    stage = resolve_stage(getattr(args, "stage", None))
    if stage:
        props["hs_pipeline_stage"] = stage
        props["hs_pipeline"] = PROJECT_PIPELINE_ID
    status = resolve_status(getattr(args, "status", None))
    if status:
        props["hs_status"] = status
    start = ms_from_date(getattr(args, "start", None))
    if start:
        props["hs_start_date"] = start
    end = ms_from_date(getattr(args, "end", None))
    if end:
        props["hs_target_due_date"] = end
    owner = resolve_owner(getattr(args, "owner", None), token)
    if owner:
        props["hubspot_owner_id"] = owner
    return props


def print_record(r, as_json=False):
    if as_json:
        print(json.dumps(r, indent=2))
        return
    p = r.get("properties", {})
    stage_id = p.get("hs_pipeline_stage")
    stage_name = STAGE_ID_TO_NAME.get(stage_id, stage_id)
    owner_id = p.get("hubspot_owner_id")
    owner_display = owner_id
    if owner_id:
        try:
            for o in _owners_cache or []:
                if str(o["id"]) == str(owner_id):
                    owner_display = f"{o.get('firstName','')} {o.get('lastName','')}".strip() + f" ({owner_id})"
                    break
        except Exception:
            pass
    url = f"https://app.hubspot.com/contacts/{PORTAL_ID}/record/{OBJECT_TYPE}/{r['id']}"
    print(f"id:        {r['id']}")
    print(f"name:      {p.get('hs_name')}")
    print(f"status:    {p.get('hs_status')}")
    print(f"stage:     {stage_name}")
    print(f"owner:     {owner_display}")
    print(f"start:     {fmt_date(p.get('hs_start_date'))}")
    print(f"end:       {fmt_date(p.get('hs_target_due_date'))}")
    print(f"close:     {fmt_date(p.get('hs_close_date'))}")
    print(f"url:       {url}")


def cmd_get(args):
    token = load_token()
    load_owners(token)
    _, d = hs_request(
        "GET", f"/crm/v3/objects/{OBJECT_TYPE}/{args.id}", token,
        query={"properties": ",".join(DEFAULT_READ_PROPS)},
    )
    print_record(d, args.json)


def cmd_list(args):
    token = load_token()
    load_owners(token)
    q = {"limit": args.limit, "properties": ",".join(DEFAULT_READ_PROPS)}
    _, d = hs_request("GET", f"/crm/v3/objects/{OBJECT_TYPE}", token, query=q)
    results = d.get("results", [])
    # Local filtering (HubSpot's search endpoint is a separate beast — keep this simple)
    owner_id = resolve_owner(args.owner, token) if args.owner else None
    stage_id = resolve_stage(args.stage) if args.stage else None
    for r in results:
        p = r.get("properties", {})
        if owner_id and str(p.get("hubspot_owner_id")) != str(owner_id):
            continue
        if stage_id and p.get("hs_pipeline_stage") != stage_id:
            continue
        if args.json:
            print(json.dumps(r))
        else:
            stage_name = STAGE_ID_TO_NAME.get(p.get("hs_pipeline_stage"), "?")
            print(f"  {r['id']:>14}  [{stage_name:<10}] {p.get('hs_status') or '-':<10}  {p.get('hs_name')}")


def cmd_create(args):
    token = load_token()
    load_owners(token)
    props = build_properties(args, token)
    if "hs_name" not in props:
        die("--name is required")
    if "hs_pipeline_stage" not in props:
        props["hs_pipeline_stage"] = STAGES["planning"]
        props["hs_pipeline"] = PROJECT_PIPELINE_ID
    _, d = hs_request("POST", f"/crm/v3/objects/{OBJECT_TYPE}", token, body={"properties": props})
    # Refetch to get populated fields (create response is partial)
    _, d = hs_request(
        "GET", f"/crm/v3/objects/{OBJECT_TYPE}/{d['id']}", token,
        query={"properties": ",".join(DEFAULT_READ_PROPS)},
    )
    print_record(d, args.json)


def cmd_update(args):
    token = load_token()
    load_owners(token)
    props = build_properties(args, token)
    if not props:
        die("no fields to update")
    hs_request("PATCH", f"/crm/v3/objects/{OBJECT_TYPE}/{args.id}", token, body={"properties": props})
    _, d = hs_request(
        "GET", f"/crm/v3/objects/{OBJECT_TYPE}/{args.id}", token,
        query={"properties": ",".join(DEFAULT_READ_PROPS)},
    )
    print_record(d, args.json)


def cmd_close(args):
    token = load_token()
    load_owners(token)
    stage = STAGES["cancelled"] if args.cancel else STAGES["completed"]
    status = "completed"  # HubSpot also has no "cancelled" status value; leave status=completed
    close_ms = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    body = {"properties": {
        "hs_pipeline": PROJECT_PIPELINE_ID,
        "hs_pipeline_stage": stage,
        "hs_status": status,
        "hs_close_date": close_ms,
    }}
    hs_request("PATCH", f"/crm/v3/objects/{OBJECT_TYPE}/{args.id}", token, body=body)
    _, d = hs_request(
        "GET", f"/crm/v3/objects/{OBJECT_TYPE}/{args.id}", token,
        query={"properties": ",".join(DEFAULT_READ_PROPS)},
    )
    print_record(d, args.json)


_HTML_TAG_RE = re.compile(r"</?(p|br|ul|ol|li|b|strong|i|em|a|code|div|h[1-6])\b", re.I)


def text_to_hubspot_html(text: str) -> str:
    """Convert plain text into tight HTML that renders cleanly in the HubSpot
    note timeline.

    HubSpot stores hs_note_body as HTML. Plain-text newlines collapse on render,
    and whitespace BETWEEN block tags becomes visible rendered spacing. So this
    function:

    - Splits input on blank lines into paragraphs.
    - Within each paragraph, groups consecutive lines beginning with ``- `` or
      ``* `` into a single ``<ul><li>...</li></ul>`` block.
    - Escapes ``&``, ``<``, ``>`` in text runs so stray angle brackets do not
      become tags.
    - Emits with no whitespace between block tags.

    If the input already contains HTML-looking tags (``<p>``, ``<br>``, ``<ul>``
    etc.), returns it unchanged apart from collapsing inter-tag whitespace. Use
    the ``--html`` flag when you want the input passed through verbatim.
    """
    raw = (text or "").strip()
    if not raw:
        return ""
    if _HTML_TAG_RE.search(raw):
        # Looks like HTML already; just strip whitespace runs between tags.
        return re.sub(r">\s+<", "><", raw)

    def esc(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    paragraphs = re.split(r"\n\s*\n", raw)
    out: list[str] = []
    for para in paragraphs:
        lines = [ln.rstrip() for ln in para.split("\n") if ln.strip()]
        if not lines:
            continue
        blocks: list[str] = []
        bullets: list[str] = []
        text_buf: list[str] = []

        def flush_text():
            if text_buf:
                blocks.append("<p>" + "<br>".join(esc(t) for t in text_buf) + "</p>")
                text_buf.clear()

        def flush_bullets():
            if bullets:
                blocks.append("<ul>" + "".join(f"<li>{esc(b)}</li>" for b in bullets) + "</ul>")
                bullets.clear()

        for ln in lines:
            stripped = ln.lstrip()
            if stripped.startswith(("- ", "* ")):
                flush_text()
                bullets.append(stripped[2:])
            else:
                flush_bullets()
                text_buf.append(ln)
        flush_text()
        flush_bullets()
        out.extend(blocks)
    return "".join(out)


def _resolve_comment_text(args) -> str:
    """Resolve the text argument, honouring --from-file."""
    if getattr(args, "from_file", None):
        with open(args.from_file, "r", encoding="utf-8") as fh:
            return fh.read()
    return args.text or ""


def cmd_comment(args):
    token = load_token()
    raw = _resolve_comment_text(args)
    if not raw.strip():
        die("comment text is empty (supply text arg or --from-file)")
    body_html = raw if args.html else text_to_hubspot_html(raw)
    now_ms = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    note_body = {"properties": {"hs_note_body": body_html, "hs_timestamp": now_ms}}
    _, note = hs_request("POST", "/crm/v3/objects/notes", token, body=note_body)
    note_id = note["id"]
    # Associate note -> project. For custom objects, use the default association category.
    path = f"/crm/v4/objects/notes/{note_id}/associations/default/{OBJECT_TYPE}/{args.id}"
    hs_request("PUT", path, token, body={})
    if args.json:
        print(json.dumps({"note_id": note_id, "project_id": args.id}))
    else:
        print(f"note {note_id} attached to project {args.id}")


def cmd_owners(args):
    token = load_token()
    owners = load_owners(token)
    q = (args.search or "").lower()
    for o in owners:
        name = f"{o.get('firstName') or ''} {o.get('lastName') or ''}".strip()
        em = (o.get("email") or "").lower()
        if q and q not in name.lower() and q not in em:
            continue
        if args.json:
            print(json.dumps(o))
        else:
            print(f"  ownerId={o['id']:>10}  {em:<35} {name}")


def cmd_stages(args):
    print("Pipeline:", PROJECT_PIPELINE_ID)
    print("Stages:")
    for k, v in STAGES.items():
        print(f"  {k:<10} {v}")
    print("Statuses:")
    for s in sorted(STATUSES):
        print(f"  {s}")


def add_field_flags(p):
    p.add_argument("--name")
    p.add_argument("--description")
    p.add_argument("--owner", help="owner email or ID")
    p.add_argument("--stage", help=f"one of {', '.join(STAGES)}")
    p.add_argument("--status", help=f"one of {', '.join(sorted(STATUSES))}")
    p.add_argument("--start", help="YYYY-MM-DD")
    p.add_argument("--end", help="YYYY-MM-DD")
    p.add_argument("--json", action="store_true")


def main():
    ap = argparse.ArgumentParser(prog="hsproj", description="HubSpot Projects CLI")
    sub = ap.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("get")
    g.add_argument("id")
    g.add_argument("--json", action="store_true")
    g.set_defaults(func=cmd_get)

    ls = sub.add_parser("list")
    ls.add_argument("--limit", type=int, default=50)
    ls.add_argument("--owner")
    ls.add_argument("--stage")
    ls.add_argument("--json", action="store_true")
    ls.set_defaults(func=cmd_list)

    c = sub.add_parser("create")
    add_field_flags(c)
    c.set_defaults(func=cmd_create)

    u = sub.add_parser("update")
    u.add_argument("id")
    add_field_flags(u)
    u.set_defaults(func=cmd_update)

    cl = sub.add_parser("close")
    cl.add_argument("id")
    cl.add_argument("--cancel", action="store_true", help="move to Cancelled instead of Completed")
    cl.add_argument("--json", action="store_true")
    cl.set_defaults(func=cmd_close)

    cm = sub.add_parser(
        "comment",
        help="Add a Note engagement to a project. Plain text is auto-formatted "
             "into tight HubSpot-friendly HTML (blank lines -> paragraphs, "
             "lines starting with '- ' -> bullets). Use --html to pass raw HTML.",
    )
    cm.add_argument("id")
    cm.add_argument("text", nargs="?", help="Note body (omit when using --from-file)")
    cm.add_argument("--html", action="store_true",
                    help="Treat text as raw HTML; skip auto-formatting")
    cm.add_argument("--from-file", dest="from_file",
                    help="Read note body from this file instead of the text arg")
    cm.add_argument("--json", action="store_true")
    cm.set_defaults(func=cmd_comment)

    ow = sub.add_parser("owners")
    ow.add_argument("--search")
    ow.add_argument("--json", action="store_true")
    ow.set_defaults(func=cmd_owners)

    st = sub.add_parser("stages")
    st.set_defaults(func=cmd_stages)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
