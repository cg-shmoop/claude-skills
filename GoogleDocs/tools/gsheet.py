#!/usr/bin/env python3
"""Upload a local .xlsx/.csv to Google Drive and convert to a native Google Sheet.

Auth: reuses the OAuth client embedded in ~/.gdoc_token.json (Docs flow) but
requests the Drive scope; caches a separate token at ~/.gsheet_token.json.
First run opens a browser for consent (run it yourself with `! python ...`).

Usage:
    python gsheet.py <path-to-xlsx-or-csv> ["Sheet Title"] [parent_folder_id]
Prints the new spreadsheet's webViewLink.
"""
import os, sys, json
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
GDOC_TOKEN = Path.home() / ".gdoc_token.json"
TOKEN = Path.home() / ".gsheet_token.json"

def load_creds():
    creds = None
    if TOKEN.is_file():
        creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES)
    if creds and creds.valid:
        return creds
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request()); TOKEN.write_text(creds.to_json()); return creds
    # Build a client_config from the embedded creds in the gdoc token
    g = json.loads(GDOC_TOKEN.read_text())
    client_config = {"installed": {
        "client_id": g["client_id"], "client_secret": g["client_secret"],
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": g.get("token_uri", "https://oauth2.googleapis.com/token"),
        "redirect_uris": ["http://localhost"]}}
    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    creds = flow.run_local_server(port=0, open_browser=True)
    TOKEN.write_text(creds.to_json())
    print(f"Auth cached to {TOKEN}", file=sys.stderr)
    return creds

def main():
    if len(sys.argv) < 2:
        print("usage: gsheet.py <file> [title] [parent_id]", file=sys.stderr); sys.exit(1)
    path = sys.argv[1]
    title = sys.argv[2] if len(sys.argv) > 2 else Path(path).stem
    arg3 = sys.argv[3] if len(sys.argv) > 3 else None
    drive = build("drive", "v3", credentials=load_creds(), cache_discovery=False)
    src_mime = ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                if path.lower().endswith("xlsx") else "text/csv")
    media = MediaFileUpload(path, mimetype=src_mime, resumable=False)
    if arg3 and arg3.startswith("update:"):   # replace content of an existing Sheet (keeps URL)
        fid = arg3.split(":", 1)[1]
        f = drive.files().update(fileId=fid, media_body=media,
                                 body={"name": title}, fields="id,webViewLink").execute()
    else:
        meta = {"name": title, "mimeType": "application/vnd.google-apps.spreadsheet"}
        if arg3: meta["parents"] = [arg3]
        f = drive.files().create(body=meta, media_body=media,
                                 fields="id,webViewLink").execute()
    print(f["webViewLink"])

if __name__ == "__main__":
    main()
