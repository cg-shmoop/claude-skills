# Authenticate Workflow

Launches a headed Playwright browser so the user can manually log in to a protected site. Captures and saves the browser session state (cookies, localStorage, sessionStorage) to a JSON file for use by subsequent scan workflows.

## Description

Many web applications require authentication before pages can be scanned. This workflow opens a visible (headed) browser window, navigates to the login URL, and waits for the user to complete the login process. Once logged in, the browser's storage state is serialized to a JSON file that the Scan.ts tool can load via the `--auth` flag.

## Intent-to-Flag Mapping

Map the user's intent to Authenticate.ts CLI flags:

| User Says | Flag | Example |
|-----------|------|---------|
| URL to log in at | `<url>` (positional) | `https://dynhome.com/login` |
| Save session to specific path | `--output <path>` | `--output ./my-auth.json` |
| Wait longer for login | `--timeout <ms>` | `--timeout 120000` |
| Use specific browser | `--browser <type>` | `--browser firefox` |

## Procedure

### Step 1: Construct the Command

Build the Authenticate.ts command from the user's request:

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Authenticate.ts <login-url> [flags]
```

**Default command (most common case):**
```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Authenticate.ts https://example.com/login
```

**With custom output path:**
```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Authenticate.ts https://example.com/login --output ./custom-auth-state.json
```

### Step 2: Execute the Command

Run the constructed command. The tool will:

1. Launch a **headed** (visible) Chromium browser
2. Navigate to the provided login URL
3. Print instructions to the console telling the user to log in
4. Wait for the user to complete authentication (up to the timeout)

**Important:** The browser window must remain open. Do not close it or run other browser automation commands while the user is logging in.

### Step 3: Tell the User to Log In

After launching, inform the user:

```
A browser window has opened to the login page. Please:
1. Log in with your credentials in the browser window
2. Navigate to a page that confirms you are logged in (e.g., dashboard)
3. Return here and press Enter (or the tool will detect the session automatically)

The session will be saved for use in accessibility scans.
```

### Step 4: Report the State File Location

Once the tool completes, report:

```
Session saved successfully.
  State file: ./auth-state.json (or custom path)
  Captured: cookies, localStorage, sessionStorage
  Valid for: Subsequent scans using --auth flag

To use in scans:
  npx tsx Scan.ts https://example.com/dashboard --auth ./auth-state.json
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Browser launch failed` | Playwright browsers not installed | Run `npx playwright install chromium` |
| `Timeout waiting for authentication` | User did not complete login in time | Re-run with `--timeout 180000` for more time |
| `Cannot write to output path` | Permission denied or invalid path | Check directory exists and is writable |
| `Login page not loading` | Network issue or invalid URL | Verify URL is correct and reachable; check VPN if needed |
| `Session state appears empty` | User closed browser before completing login | Re-run and complete the full login flow before closing |

## Security Notes

- The `auth-state.json` file contains sensitive session data (cookies, tokens)
- Do not commit this file to version control
- Add `auth-state.json` to `.gitignore`
- Session tokens typically expire after 30 minutes to 24 hours depending on the application
- Re-run this workflow when scans fail with 401/403 responses

## Re-Authentication

Sessions expire. Signs that re-authentication is needed:

- Scan results show login/redirect pages instead of actual content
- All pages return the same violation set (likely scanning the login page repeatedly)
- JSON results contain a `url` field pointing to `/login` or `/auth` instead of the target URL

When this happens, re-run the Authenticate workflow to capture a fresh session.
