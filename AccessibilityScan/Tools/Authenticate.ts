#!/usr/bin/env node

/**
 * Authenticate.ts - Browser Authentication State Capture for Accessibility Scanning
 *
 * Launches a visible Chromium browser, lets the user log in manually via
 * Playwright Inspector, then saves the browser storage state (cookies,
 * localStorage, sessionStorage) to a JSON file for later headless reuse.
 *
 * Usage:
 *   bun Authenticate.ts <login-url>                  # Open browser, manual login, save state
 *   bun Authenticate.ts <login-url> --output <file>  # Custom state file path
 *   bun Authenticate.ts --verify <state-file>        # Check if session still valid
 *   bun Authenticate.ts --help                       # Show usage
 */

import { chromium } from "playwright";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LOGIN_URL = "https://app.example.com/login";
const DEFAULT_STATE_PATH = path.join(
  os.homedir(),
  ".claude",
  "skills",
  "AccessibilityScan",
  "auth-state.json",
);
const NOTIFY_URL = "http://localhost:8888/notify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printHelp(): void {
  const help = `
Authenticate - Browser Authentication State Capture
====================================================

Launches a visible Chromium browser so you can log in manually, then saves
the browser storage state (cookies, localStorage) for later headless reuse
in accessibility scanning.

Usage:
  bun Authenticate.ts [login-url]                  Open browser at login URL, save state
  bun Authenticate.ts [login-url] --output <file>  Save state to a custom file path
  bun Authenticate.ts --verify <state-file>        Check if a saved session is still valid
  bun Authenticate.ts --help                       Show this help message

Arguments:
  login-url    The URL to navigate to for login (default: ${DEFAULT_LOGIN_URL})

Options:
  --output <file>    Path to save the authentication state JSON
                     (default: ${DEFAULT_STATE_PATH})
  --verify <file>    Verify that a saved auth state file is still valid
  --help             Show this help message

Examples:
  bun Authenticate.ts
  bun Authenticate.ts https://myapp.example.com/login
  bun Authenticate.ts --output ./my-auth.json
  bun Authenticate.ts --verify ~/.claude/skills/AccessibilityScan/auth-state.json
`.trim();

  console.log(help);
}

async function notify(message: string): Promise<void> {
  try {
    await fetch(NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        title: "Authenticate Tool",
      }),
    });
  } catch {
    // Voice server may not be running - non-fatal
  }
}

function log(step: string, detail: string): void {
  console.log(`[Authenticate] ${step}: ${detail}`);
}

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------

interface ParsedArgs {
  mode: "capture" | "verify" | "help";
  loginUrl: string;
  outputPath: string;
  verifyPath: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // strip bun + script path

  const result: ParsedArgs = {
    mode: "capture",
    loginUrl: DEFAULT_LOGIN_URL,
    outputPath: DEFAULT_STATE_PATH,
    verifyPath: "",
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.mode = "help";
      return result;
    }

    if (arg === "--verify") {
      result.mode = "verify";
      i++;
      if (i >= args.length) {
        console.error("Error: --verify requires a state file path argument.");
        process.exit(1);
      }
      result.verifyPath = path.resolve(args[i]);
      i++;
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      i++;
      if (i >= args.length) {
        console.error("Error: --output requires a file path argument.");
        process.exit(1);
      }
      result.outputPath = path.resolve(args[i]);
      i++;
      continue;
    }

    // Positional: treat as login URL (first positional only)
    if (!arg.startsWith("--")) {
      result.loginUrl = arg;
      i++;
      continue;
    }

    console.error(`Error: Unknown option "${arg}". Use --help for usage.`);
    process.exit(1);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Capture Mode - launch browser, let user log in, save state
// ---------------------------------------------------------------------------

async function captureAuthState(
  loginUrl: string,
  outputPath: string,
): Promise<void> {
  log("Start", "Launching visible Chromium browser for manual authentication");
  await notify("Launching browser for authentication capture");

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to launch Chromium browser.\n${message}`);
    console.error(
      "\nMake sure Playwright browsers are installed: bunx playwright install chromium",
    );
    process.exit(1);
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  log("Navigate", `Opening ${loginUrl}`);
  try {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to navigate to ${loginUrl}.\n${message}`);
    await browser.close();
    process.exit(1);
  }

  console.log("");
  console.log("=".repeat(60));
  console.log("  MANUAL LOGIN REQUIRED");
  console.log("=".repeat(60));
  console.log("");
  console.log("  The Playwright Inspector will open.");
  console.log("  1. Log in to the application in the browser window");
  console.log("  2. Verify you are fully authenticated");
  console.log('  3. Click the "Resume" button in Playwright Inspector');
  console.log("");
  console.log("=".repeat(60));
  console.log("");

  // Pause lets the user interact with the browser via Playwright Inspector
  await page.pause();

  log("Capture", "Saving browser storage state (cookies, localStorage, sessionStorage)");

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    console.error(
      `Error: Failed to create output directory ${outputDir}.\n${message}`,
    );
    await browser.close();
    process.exit(1);
  }

  // Save storage state
  try {
    await context.storageState({ path: outputPath });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    console.error(
      `Error: Failed to save storage state to ${outputPath}.\n${message}`,
    );
    await browser.close();
    process.exit(1);
  }

  await browser.close();

  console.log("");
  log("Success", `Authentication state saved to:`);
  console.log(`  ${outputPath}`);
  console.log("");
  console.log("You can now use this state file for headless accessibility scans.");
  await notify("Authentication state captured and saved successfully");
}

// ---------------------------------------------------------------------------
// Verify Mode - check if a saved auth state is still valid
// ---------------------------------------------------------------------------

async function verifyAuthState(stateFilePath: string): Promise<void> {
  log("Verify", `Checking auth state file: ${stateFilePath}`);
  await notify("Verifying saved authentication state");

  // Check file exists
  if (!fs.existsSync(stateFilePath)) {
    console.error(`Error: State file not found: ${stateFilePath}`);
    process.exit(1);
  }

  // Validate JSON
  let stateData: unknown;
  try {
    const raw = fs.readFileSync(stateFilePath, "utf-8");
    stateData = JSON.parse(raw);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    console.error(
      `Error: State file is not valid JSON.\n${message}`,
    );
    process.exit(1);
  }

  // Basic structure check
  if (
    typeof stateData !== "object" ||
    stateData === null ||
    !("cookies" in stateData)
  ) {
    console.error(
      "Error: State file does not look like a valid Playwright storage state (missing 'cookies').",
    );
    process.exit(1);
  }

  log("Structure", "State file has valid Playwright storage state format");

  // Launch browser with saved state and check for login redirect
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to launch Chromium for verification.\n${message}`);
    process.exit(1);
  }

  let isValid = false;
  try {
    const context = await browser.newContext({ storageState: stateFilePath });
    const page = await context.newPage();

    // Navigate to the site root (derived from cookies or fallback to default)
    const cookies = (stateData as { cookies: Array<{ domain: string }> }).cookies;
    let checkUrl = DEFAULT_LOGIN_URL.replace(/\/login\/?$/, "/");
    if (cookies.length > 0) {
      const domain = cookies[0].domain.replace(/^\./, "");
      checkUrl = `https://${domain}/`;
    }

    log("Navigate", `Checking session at ${checkUrl}`);
    const response = await page.goto(checkUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const finalUrl = page.url();
    log("Result", `Final URL: ${finalUrl}`);

    // Check if we got redirected to a login page
    const loginIndicators = ["/login", "/signin", "/sign-in", "/auth", "/sso"];
    const wasRedirectedToLogin = loginIndicators.some((indicator) =>
      finalUrl.toLowerCase().includes(indicator),
    );

    if (wasRedirectedToLogin && !checkUrl.toLowerCase().includes("/login")) {
      console.log("");
      console.log("  Session appears EXPIRED - redirected to login page.");
      console.log(`  Redirected to: ${finalUrl}`);
      console.log("");
      console.log("  Run this tool again without --verify to capture a new session.");
      isValid = false;
    } else if (response && response.ok()) {
      console.log("");
      console.log("  Session appears VALID - no login redirect detected.");
      console.log(`  Status: ${response.status()}`);
      isValid = true;
    } else {
      console.log("");
      console.log(
        `  Session check inconclusive - status ${response?.status() ?? "unknown"}.`,
      );
      console.log("  You may want to re-authenticate to be safe.");
      isValid = false;
    }

    await context.close();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    console.error(`Error during session verification: ${message}`);
    isValid = false;
  }

  await browser.close();

  if (isValid) {
    log("Verify", "Authentication state is VALID");
    await notify("Authentication state verified as valid");
    process.exit(0);
  } else {
    log("Verify", "Authentication state is INVALID or EXPIRED");
    await notify("Authentication state is expired or invalid");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);

  switch (parsed.mode) {
    case "help":
      printHelp();
      process.exit(0);
      break;

    case "verify":
      await verifyAuthState(parsed.verifyPath);
      break;

    case "capture":
      await captureAuthState(parsed.loginUrl, parsed.outputPath);
      break;
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nUnhandled error: ${message}`);
  process.exit(1);
});
