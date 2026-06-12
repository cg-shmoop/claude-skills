#!/usr/bin/env python3
"""Surgically write individual cells of a Google Sheet WITHOUT overwriting the rest.

Non-destructive: only the named cells change; all other cells (incl. human edits)
and formulas are left intact. Use this instead of gsheet.py's whole-file update
once a Sheet is being edited by people.

Auth: reuses ~/.gsheet_token.json (drive.file scope; works on app-created files).

Usage:
    python gsheet_cells.py <fileId> "Tab Name!A1=value" "Tab Name!B2=123" ...
Values that parse as numbers are written as numbers; everything else as text.
A value beginning with '=' is written as a formula (USER_ENTERED).
"""
import sys
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

TOKEN = Path.home() / ".gsheet_token.json"
SCOPES = ["https://www.googleapis.com/auth/drive.file"]

def creds():
    c = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if c and c.expired and c.refresh_token:
        c.refresh(Request()); TOKEN.write_text(c.to_json())
    return c

def main():
    if len(sys.argv) < 3:
        print('usage: gsheet_cells.py <fileId> "Tab!A1=value" ...', file=sys.stderr); sys.exit(1)
    fid = sys.argv[1]
    data = []
    for arg in sys.argv[2:]:
        rng, val = arg.split("=", 1)
        if not val.startswith("="):
            try: val = float(val) if ("." in val or "e" in val.lower()) else int(val)
            except ValueError: pass
        data.append({"range": rng.strip(), "values": [[val]]})
    svc = build("sheets", "v4", credentials=creds(), cache_discovery=False)
    res = svc.spreadsheets().values().batchUpdate(
        spreadsheetId=fid,
        body={"valueInputOption": "USER_ENTERED", "data": data}).execute()
    print("updated cells:", [d["range"] for d in data],
          "| ranges written:", res.get("totalUpdatedCells"))

if __name__ == "__main__":
    main()
