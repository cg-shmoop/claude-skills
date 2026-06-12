# Authenticate.ts

Captures browser session state (cookies, localStorage, sessionStorage) for use in authenticated accessibility scans. Launches a headed Playwright browser, navigates to a login URL, and waits for the user to complete authentication manually.

## Usage

```
bun Authenticate.ts <login-url> [flags]
```

```bash
bun ~/.claude/skills/AccessibilityScan/Tools/Authenticate.ts https://example.com/login
```

## Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `<login-url>` | positional | -- | URL of the login page to navigate to (required) |
| `--output <path>` | string | `./auth-state.json` | Path to save the storage state JSON file |
| `--timeout <ms>` | number | `60000` | Maximum time (ms) to wait for user to complete login |
| `--browser <type>` | string | `chromium` | Browser engine: `chromium`, `firefox`, or `webkit` |

## Examples

### Basic authentication

```bash
bun ~/.claude/skills/AccessibilityScan/Tools/Authenticate.ts https://dynhome.com/login
```

Opens a visible Chromium window to the login page. After the user logs in and presses Enter (or the timeout is reached), saves session state to `./auth-state.json`.

### Custom output path

```bash
bun ~/.claude/skills/AccessibilityScan/Tools/Authenticate.ts https://dynhome.com/login \
  --output ./sessions/dynhome-auth.json
```

### Extended timeout for MFA flows

```bash
bun ~/.claude/skills/AccessibilityScan/Tools/Authenticate.ts https://dynhome.com/login \
  --timeout 120000
```

Gives 2 minutes for login flows that include multi-factor authentication, email verification, or other slow steps.

### Using Firefox

```bash
bun ~/.claude/skills/AccessibilityScan/Tools/Authenticate.ts https://dynhome.com/login \
  --browser firefox
```

## How storageState Works

Playwright's `storageState()` method serializes the browser's current state into a JSON file containing:

```json
{
  "cookies": [
    {
      "name": "session_id",
      "value": "abc123...",
      "domain": "dynhome.com",
      "path": "/",
      "expires": 1739400000,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "origins": [
    {
      "origin": "https://dynhome.com",
      "localStorage": [
        { "name": "auth_token", "value": "eyJhb..." },
        { "name": "user_prefs", "value": "{\"theme\":\"dark\"}" }
      ]
    }
  ]
}
```

When Scan.ts receives `--auth ./auth-state.json`, it creates a new Playwright browser context pre-loaded with this state. The browser behaves as if the user is already logged in -- no login step needed.

**What gets captured:**
- All cookies for the domain (including HttpOnly cookies)
- localStorage entries for each origin
- sessionStorage is NOT persisted (by Playwright design -- it is tab-scoped)

**What does NOT get captured:**
- IndexedDB data
- Service worker registrations
- Cache storage
- In-memory JavaScript state

For most web applications, cookies + localStorage are sufficient for maintaining an authenticated session.

## Session Expiration

Saved sessions do not last forever. Expiration depends on the target application's session management:

| Session Type | Typical Lifetime | Signs of Expiration |
|-------------|-----------------|---------------------|
| **Session cookie** | Until browser closes (but Playwright restores them) | Redirect to login page |
| **Persistent cookie** | Hours to days (set by server `expires` / `max-age`) | 401/403 responses; redirect to login |
| **JWT in localStorage** | Minutes to hours (depends on `exp` claim) | API calls fail; frontend shows auth errors |
| **OAuth refresh token** | Days to weeks | Token refresh fails; full re-auth required |

**General guidance:**
- Re-authenticate at the start of each scanning session
- If a batch scan takes longer than 30 minutes, the session may expire mid-scan
- If scan results suddenly show login page content, the session has expired
- For long-running batch scans, authenticate with "remember me" / "stay logged in" if available

**How to detect expiration during batch scans:**
- Multiple pages return identical violation sets (they are all scanning the login page)
- Page titles in results show "Login" or "Sign In" instead of expected page titles
- The `url` field in JSON results shows a redirect URL instead of the target URL

## Security Considerations

The `auth-state.json` file contains sensitive authentication material:

- **Session tokens** that grant access to the application
- **Cookies** including HttpOnly cookies not normally accessible to JavaScript
- **localStorage tokens** that may include JWTs with user identity

**Security practices:**

1. **Do not commit to version control.** Add to `.gitignore`:
   ```
   auth-state.json
   **/auth-state.json
   sessions/*.json
   ```

2. **Delete after use.** Remove the file when the scanning session is complete:
   ```bash
   rm ./auth-state.json
   ```

3. **Restrict file permissions.** On Linux/macOS:
   ```bash
   chmod 600 ./auth-state.json
   ```

4. **Do not share.** The file grants the same access as the logged-in user. Anyone with this file can impersonate the session.

5. **Use a dedicated test account** when possible, rather than a personal or admin account.

6. **Be aware of audit logs.** The scans will appear in the application's access logs under the authenticated user's identity. Coordinate with the team so automated scan traffic is not mistaken for suspicious activity.
