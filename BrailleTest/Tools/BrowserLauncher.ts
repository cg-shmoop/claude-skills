#!/usr/bin/env npx tsx
/**
 * BrowserLauncher — Launches a non-headless Chromium browser for NVDA testing.
 *
 * Opens the specified URL and stays alive until killed.
 * NVDA detects the visible browser window and builds a virtual buffer.
 *
 * Usage:
 *   npx tsx Tools/BrowserLauncher.ts <URL>
 *
 * Output: Writes browser PID info to stdout. Kill the process to close browser.
 */

import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) {
  console.error('Usage: npx tsx Tools/BrowserLauncher.ts <URL>');
  process.exit(1);
}

const targetUrl = url.startsWith('http') ? url : `https://${url}`;

async function main() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--force-renderer-accessibility'],
  });

  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e: any) {
    process.stderr.write(`Warning: ${e.message}\n`);
  }

  const title = await page.title();
  console.log(JSON.stringify({ status: 'ready', url: targetUrl, title, pid: process.pid }));

  // Stay alive until killed or browser closes
  await new Promise<void>((resolve) => {
    process.on('SIGTERM', () => { browser.close().then(resolve); });
    process.on('SIGINT', () => { browser.close().then(resolve); });

    // Poll to check if browser is still connected
    const interval = setInterval(async () => {
      if (!browser.isConnected()) {
        clearInterval(interval);
        resolve();
      }
    }, 2000);
  });
}

main().catch((err) => {
  console.error('BrowserLauncher error:', err);
  process.exit(1);
});
