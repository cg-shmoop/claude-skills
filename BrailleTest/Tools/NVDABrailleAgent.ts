/**
 * NVDABrailleAgent — Autonomous braille accessibility testing orchestrator.
 *
 * This is NOT a standalone CLI anymore. The orchestration happens from the
 * Claude Code conversation, which:
 *
 * 1. SETUP: Launches a non-headless browser via BrowserLauncher.ts (background)
 * 2. NAVIGATE: Spawns a Task subagent as the "blind braille user"
 *    - The subagent curls NVDA bridge (localhost:8889) to read braille and send commands
 *    - The subagent reasons about what it sees and logs each step to a JSONL file
 *    - The subagent has NO access to DOM, page structure, or Playwright
 * 3. ASSEMBLE: Runs SessionAssembler.ts to produce the final transcript
 *
 * The subagent prompt is built by BrailleAgentLLM.ts (buildBrailleAgentPrompt).
 *
 * Files:
 *   BrowserLauncher.ts  — Launches Chromium, stays alive until killed
 *   BrailleAgentLLM.ts  — Builds the subagent prompt
 *   SessionAssembler.ts — Reads JSONL log, runs assessment, renders markdown
 *   adapters/nvda-bridge.ts — HTTP client for NVDA add-on (used by subagent via curl)
 *
 * This file exists as documentation and as a programmatic entry point
 * for the BrailleTest skill to coordinate the three phases.
 */

export { buildBrailleAgentPrompt } from './BrailleAgentLLM.js';
export type { BrailleAgentPromptConfig } from './BrailleAgentLLM.js';
export { getCredentials, requiresAuth } from './credentials.js';
