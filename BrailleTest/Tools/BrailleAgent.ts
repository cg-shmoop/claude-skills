#!/usr/bin/env npx tsx
/**
 * BrailleAgent — Core orchestrator for braille accessibility testing.
 *
 * Launches a browser, navigates a page as a blind braille display user would,
 * records every interaction in a structured session log, runs assessment rules,
 * and produces a JSON session file + Markdown transcript.
 *
 * Usage:
 *   bun Tools/BrailleAgent.ts https://example.com [--task "description"]
 *
 * The agent works primarily through Playwright's accessibility tree snapshot.
 * The UIA platform adapter is an optional enhancement -- the core flow does
 * not depend on it.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Page, Browser, BrowserContext, CDPSession } from 'playwright';

// --- Types ---
import type {
  BrailleView,
  NavigationCommand,
  CommandResult,
  ElementInfo,
  AccessibilityFinding,
  PageModel,
  SessionLogEntry,
  HeadingNode,
  LandmarkNode,
  LinkNode,
  FormFieldNode,
  NavigationStep,
} from './types/index.js';
import {
  BRAILLE_ABBREVIATIONS,
  BRAILLE_TIME_ESTIMATES,
  commandToKeystroke,
  commandToDescription,
} from './types/index.js';

// --- Constraint Layer ---
import { createDisplay, renderForBraille, pan, getCurrentView } from './constraint/braille-display.js';
import { createModeState, enterFormsMode, exitFormsMode, isCommandValid, shouldAutoSwitch } from './constraint/mode-state.js';
import { filterElement } from './constraint/blindfold.js';
import type { ConstrainedElement } from './constraint/blindfold.js';

// --- Strategies ---
import { createOrientationSteps, createFormCompletionSteps } from './strategies/index.js';

// --- Session ---
import { SessionLogger } from './SessionLogger.js';
import { renderSession } from './SessionRenderer.js';

// --- Assessment ---
import { createDefaultEngine } from './AssessmentEngine.js';

// --- Credentials ---
import { getCredentials, requiresAuth } from './credentials.js';


// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseArgs(): { url: string; task: string; auth?: string } {
  const args = process.argv.slice(2);
  let url = '';
  let task = 'orientation scan';
  let auth: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task' && args[i + 1]) {
      task = args[i + 1];
      i++; // skip next
    } else if (args[i] === '--auth' && args[i + 1]) {
      auth = args[i + 1];
      i++; // skip next
    } else if (!args[i].startsWith('--') && !url) {
      url = args[i];
    }
  }

  if (!url) {
    console.error('Usage: bun Tools/BrailleAgent.ts <URL> [--task "description"] [--auth path/to/auth-state.json]');
    process.exit(1);
  }

  // Ensure URL has protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  return { url, task, auth };
}


// =============================================================================
// Accessibility Tree Helpers
// =============================================================================

/**
 * Snapshot node from the accessibility tree.
 * Built from CDP Accessibility.getFullAXTree responses.
 */
interface AXNode {
  role: string;
  name: string;
  value?: string;
  description?: string;
  level?: number;
  checked?: boolean | 'mixed';
  pressed?: boolean | 'mixed';
  expanded?: boolean;
  disabled?: boolean;
  required?: boolean;
  focused?: boolean;
  children?: AXNode[];
  keyshortcuts?: string;
  roledescription?: string;
  valuetext?: string;
  autocomplete?: string;
  haspopup?: string;
  invalid?: string;
  orientation?: string;
}

/**
 * Flatten the accessibility tree into a linear list (depth-first).
 * This mirrors how a screen reader user encounters elements in the virtual buffer.
 */
function flattenAXTree(node: AXNode, depth = 0): Array<AXNode & { depth: number }> {
  const result: Array<AXNode & { depth: number }> = [];
  result.push({ ...node, depth });

  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenAXTree(child, depth + 1));
    }
  }

  return result;
}

/**
 * Convert an AXNode to an ElementInfo compatible with the blindfold filter.
 */
function axNodeToElementInfo(node: AXNode, index: number): ElementInfo {
  const states: string[] = [];
  if (node.checked === true) states.push('checked');
  if (node.checked === 'mixed') states.push('mixed');
  if (node.pressed === true) states.push('pressed');
  if (node.expanded === true) states.push('expanded');
  if (node.expanded === false) states.push('collapsed');
  if (node.disabled) states.push('disabled');
  if (node.focused) states.push('focused');
  if (node.required) states.push('required');
  if (node.invalid === 'true') states.push('hasError');

  return {
    automationId: `ax-${index}`,
    controlType: 0,
    controlTypeName: mapRoleToControlType(node.role),
    name: node.name || '',
    value: node.value || node.valuetext || '',
    role: node.role || '',
    ariaRole: node.role || '',
    level: node.level ?? 0,
    positionInSet: 0,
    sizeOfSet: 0,
    isEnabled: !node.disabled,
    isKeyboardFocusable: isFocusableRole(node.role),
    hasKeyboardFocus: node.focused ?? false,
    isRequired: node.required ?? false,
    isPassword: node.role === 'textbox' && node.name?.toLowerCase().includes('password'),
    states,
    description: node.description || '',
    helpText: '',
    landmarkType: mapRoleToLandmark(node.role),
  };
}

/**
 * Map Playwright AX roles to our controlTypeName keys.
 * These keys must match the BRAILLE_ABBREVIATIONS keys.
 */
function mapRoleToControlType(role: string): string {
  const mapping: Record<string, string> = {
    button: 'button',
    link: 'link',
    textbox: 'edit',
    checkbox: 'checkbox',
    radio: 'radiobutton',
    combobox: 'combobox',
    heading: 'heading',
    list: 'list',
    listitem: 'listitem',
    table: 'table',
    img: 'image',
    separator: 'separator',
    tab: 'tab',
    tree: 'tree',
    treeitem: 'treeitem',
    menu: 'menu',
    menuitem: 'menuitem',
    dialog: 'dialog',
    alert: 'alert',
    progressbar: 'progressbar',
    slider: 'slider',
    group: 'group',
    navigation: 'navigation',
    main: 'main',
    banner: 'banner',
    contentinfo: 'contentinfo',
    complementary: 'complementary',
    search: 'search',
    form: 'form',
    region: 'landmark',
    text: 'text',
    paragraph: 'text',
    generic: 'text',
    document: 'text',
    application: 'text',
    none: 'text',
    presentation: 'text',
  };
  return mapping[role] ?? 'text';
}

function isFocusableRole(role: string): boolean {
  const focusable = new Set([
    'button', 'link', 'textbox', 'checkbox', 'radio',
    'combobox', 'tab', 'menuitem', 'treeitem', 'slider',
  ]);
  return focusable.has(role);
}

function mapRoleToLandmark(role: string): string {
  const landmarks: Record<string, string> = {
    navigation: 'navigation',
    main: 'main',
    banner: 'banner',
    contentinfo: 'contentinfo',
    complementary: 'complementary',
    search: 'search',
    form: 'form',
    region: 'region',
  };
  return landmarks[role] ?? '';
}


// =============================================================================
// CDP-based Accessibility Tree
// =============================================================================

/**
 * Get the full accessibility tree via Chrome DevTools Protocol.
 * Playwright 1.58+ removed page.accessibility.snapshot(), so we use CDP directly.
 */
async function getAccessibilityTree(page: Page): Promise<AXNode | null> {
  try {
    const client = await page.context().newCDPSession(page);
    // Must enable accessibility domain before querying the tree
    await client.send('Accessibility.enable');
    const { nodes } = await client.send('Accessibility.getFullAXTree');
    await client.detach();

    if (!nodes || nodes.length === 0) return null;

    // CDP returns a flat list of nodes with nodeId and childIds.
    // We need to reconstruct the tree structure.
    const nodeMap = new Map<string, any>();
    for (const node of nodes) {
      nodeMap.set(node.nodeId, node);
    }

    function cdpNodeToAXNode(cdpNode: any): AXNode | null {
      if (!cdpNode) return null;

      const role = cdpNode.role?.value ?? '';
      const name = cdpNode.name?.value ?? '';

      // Skip InlineTextBox entirely — StaticText parents already carry the name
      if (role === 'InlineTextBox') return null;

      // For ignored nodes or generic/none with no name, pass through to children
      if (cdpNode.ignored || ((role === 'none' || role === 'generic') && !name)) {
        const children: AXNode[] = [];
        if (cdpNode.childIds) {
          for (const childId of cdpNode.childIds) {
            const childNode = nodeMap.get(childId);
            const child = cdpNodeToAXNode(childNode);
            if (child) children.push(child);
          }
        }
        if (children.length === 1) return children[0];
        if (children.length > 1) {
          return { role: 'group', name: '', children };
        }
        return null;
      }

      // Convert StaticText to a text node (screen readers announce these as plain text)
      if (role === 'StaticText') {
        return { role: 'text', name };
      }

      const axNode: AXNode = {
        role,
        name,
      };

      // Extract properties
      if (cdpNode.properties) {
        for (const prop of cdpNode.properties) {
          switch (prop.name) {
            case 'level':
              axNode.level = prop.value?.value;
              break;
            case 'checked':
              axNode.checked = prop.value?.value === 'true' ? true : prop.value?.value === 'mixed' ? 'mixed' : false;
              break;
            case 'pressed':
              axNode.pressed = prop.value?.value === 'true' ? true : prop.value?.value === 'mixed' ? 'mixed' : false;
              break;
            case 'expanded':
              axNode.expanded = prop.value?.value === 'true';
              break;
            case 'disabled':
              axNode.disabled = prop.value?.value === 'true';
              break;
            case 'required':
              axNode.required = prop.value?.value === 'true';
              break;
            case 'focused':
              axNode.focused = prop.value?.value === 'true';
              break;
            case 'invalid':
              axNode.invalid = prop.value?.value;
              break;
          }
        }
      }

      // Extract value
      if (cdpNode.value?.value) {
        axNode.value = cdpNode.value.value;
      }

      // Extract description
      if (cdpNode.description?.value) {
        axNode.description = cdpNode.description.value;
      }

      // Process children
      if (cdpNode.childIds && cdpNode.childIds.length > 0) {
        const children: AXNode[] = [];
        for (const childId of cdpNode.childIds) {
          const childNode = nodeMap.get(childId);
          const child = cdpNodeToAXNode(childNode);
          if (child) children.push(child);
        }
        if (children.length > 0) {
          axNode.children = children;
        }
      }

      return axNode;
    }

    return cdpNodeToAXNode(nodes[0]);
  } catch (err) {
    console.error('[BrailleAgent] Failed to get accessibility tree via CDP:', err);
    return null;
  }
}


// =============================================================================
// Virtual Navigation Engine
// =============================================================================

/**
 * The VirtualNavigator simulates JAWS-like navigation over the flattened
 * accessibility tree. It maintains a cursor position and supports quick-nav
 * by element type, heading level, landmarks, etc.
 */
class VirtualNavigator {
  private nodes: Array<AXNode & { depth: number }> = [];
  private cursor = 0;

  /**
   * Reload the accessibility tree from the page via CDP.
   */
  async refresh(page: Page): Promise<void> {
    const snapshot = await getAccessibilityTree(page);
    if (snapshot) {
      this.nodes = flattenAXTree(snapshot);
    } else {
      this.nodes = [];
    }
    // Don't reset cursor -- we want to stay near our position.
    if (this.cursor >= this.nodes.length) {
      this.cursor = 0;
    }
  }

  /**
   * Get the current node under the virtual cursor.
   */
  currentNode(): (AXNode & { depth: number }) | null {
    return this.nodes[this.cursor] ?? null;
  }

  /**
   * Get current cursor position.
   */
  getCursorIndex(): number {
    return this.cursor;
  }

  /**
   * Get all nodes (for element list queries).
   */
  allNodes(): Array<AXNode & { depth: number }> {
    return this.nodes;
  }

  /**
   * Move the cursor to the next element matching a predicate.
   * Returns the matched node, or null if none found (wraps around is NOT done
   * to simulate JAWS "no next element" beep).
   */
  findNext(predicate: (node: AXNode) => boolean): (AXNode & { depth: number }) | null {
    for (let i = this.cursor + 1; i < this.nodes.length; i++) {
      if (predicate(this.nodes[i])) {
        this.cursor = i;
        return this.nodes[i];
      }
    }
    return null; // No more matching elements
  }

  /**
   * Move the cursor to the previous element matching a predicate.
   */
  findPrev(predicate: (node: AXNode) => boolean): (AXNode & { depth: number }) | null {
    for (let i = this.cursor - 1; i >= 0; i--) {
      if (predicate(this.nodes[i])) {
        this.cursor = i;
        return this.nodes[i];
      }
    }
    return null;
  }

  /**
   * Collect all elements matching a predicate (for element lists).
   */
  collectAll(predicate: (node: AXNode) => boolean): Array<AXNode & { depth: number }> {
    return this.nodes.filter(predicate);
  }

  /**
   * Move cursor down by one node (linear scan).
   */
  moveDown(): (AXNode & { depth: number }) | null {
    if (this.cursor + 1 < this.nodes.length) {
      this.cursor++;
      return this.nodes[this.cursor];
    }
    return null;
  }

  /**
   * Move cursor up by one node.
   */
  moveUp(): (AXNode & { depth: number }) | null {
    if (this.cursor > 0) {
      this.cursor--;
      return this.nodes[this.cursor];
    }
    return null;
  }

  /**
   * Navigate by quick nav key. Returns the node reached, or null.
   */
  quickNav(key: string, direction: 'forward' | 'backward'): (AXNode & { depth: number }) | null {
    const predicate = quickNavPredicate(key);
    if (!predicate) return null;

    return direction === 'forward'
      ? this.findNext(predicate)
      : this.findPrev(predicate);
  }
}

/**
 * Returns a predicate function for the given quick nav key.
 */
function quickNavPredicate(key: string): ((node: AXNode) => boolean) | null {
  switch (key) {
    case 'h': return (n) => n.role === 'heading';
    case '1': return (n) => n.role === 'heading' && n.level === 1;
    case '2': return (n) => n.role === 'heading' && n.level === 2;
    case '3': return (n) => n.role === 'heading' && n.level === 3;
    case '4': return (n) => n.role === 'heading' && n.level === 4;
    case '5': return (n) => n.role === 'heading' && n.level === 5;
    case '6': return (n) => n.role === 'heading' && n.level === 6;
    case 'r': return (n) => isLandmarkRole(n.role);
    case 'q': return (n) => n.role === 'main';
    case 'f': return (n) => isFormFieldRole(n.role);
    case 'e': return (n) => n.role === 'textbox';
    case 'b': return (n) => n.role === 'button';
    case 'c': return (n) => n.role === 'combobox';
    case 'a': return (n) => n.role === 'radio';
    case 'x': return (n) => n.role === 'checkbox';
    case 't': return (n) => n.role === 'table';
    case 'u': return (n) => n.role === 'link';
    case 'v': return (n) => n.role === 'link'; // Visited vs unvisited -- treat the same
    case 'l': return (n) => n.role === 'list';
    case 'i': return (n) => n.role === 'listitem';
    case 'g': return (n) => n.role === 'img';
    case 'n': return (n) => n.role === 'text' || n.role === 'paragraph';
    case 'p': return (n) => n.role === 'paragraph';
    case 'd': return null; // "different type" -- not easily simulated
    default: return null;
  }
}

function isLandmarkRole(role: string): boolean {
  return ['navigation', 'main', 'banner', 'contentinfo', 'complementary', 'search', 'form', 'region'].includes(role);
}

function isFormFieldRole(role: string): boolean {
  return ['textbox', 'checkbox', 'radio', 'combobox', 'button', 'slider'].includes(role);
}


// =============================================================================
// Command Executor
// =============================================================================

/**
 * Executes a NavigationCommand against the virtual navigator and Playwright page.
 * Returns a CommandResult describing what happened.
 */
async function executeCommand(
  cmd: NavigationCommand,
  navigator: VirtualNavigator,
  page: Page,
  display: ReturnType<typeof createDisplay>,
  modeState: ReturnType<typeof createModeState>,
): Promise<CommandResult> {
  const announcements: string[] = [];
  const liveRegionUpdates: string[] = [];
  let elementReached: ElementInfo | null = null;
  let success = true;
  let error: string | undefined;

  // Validate command against current mode
  const validation = isCommandValid(cmd, modeState.currentMode);
  if (!validation.valid) {
    return {
      command: cmd,
      brailleView: getCurrentView(display, 'text', '', modeState.currentMode),
      elementReached: null,
      modeAfter: modeState.currentMode,
      announcements: [validation.reason ?? 'Invalid command for current mode'],
      liveRegionUpdates: [],
      success: false,
      error: validation.reason,
    };
  }

  let resultNode: AXNode | null = null;

  switch (cmd.type) {
    case 'quickNav': {
      resultNode = navigator.quickNav(cmd.key, cmd.direction);
      if (!resultNode) {
        success = false;
        error = `No more elements for quick nav key "${cmd.key}"`;
        announcements.push('Wrapping to top' /* JAWS beep simulation */);
      }
      break;
    }

    case 'elementList': {
      // Collect matching elements and report them as an announcement.
      // In a real screen reader this opens a dialog -- we simulate by
      // collecting and announcing the list.
      const predicate = elementListPredicate(cmd.listType);
      const items = predicate ? navigator.collectAll(predicate) : [];
      announcements.push(`${cmd.listType} list: ${items.length} items`);
      for (const item of items.slice(0, 20)) {
        const label = item.name || '(unlabeled)';
        const level = item.level ? ` level ${item.level}` : '';
        announcements.push(`  ${item.role}${level}: ${label}`);
      }
      if (items.length > 20) {
        announcements.push(`  ... and ${items.length - 20} more`);
      }
      // Move cursor to first item if there are any
      if (items.length > 0) {
        resultNode = items[0];
      }
      break;
    }

    case 'read': {
      resultNode = navigator.currentNode();
      if (resultNode) {
        announcements.push(`Read ${cmd.unit}: ${resultNode.name || resultNode.role}`);
      }
      break;
    }

    case 'move': {
      if (cmd.direction === 'down') {
        resultNode = navigator.moveDown();
      } else if (cmd.direction === 'up') {
        resultNode = navigator.moveUp();
      }
      if (!resultNode) {
        success = false;
        error = 'End of document';
        announcements.push('Bottom of page');
      }
      break;
    }

    case 'pan': {
      const currentNode = navigator.currentNode();
      const elementType = currentNode ? mapRoleToControlType(currentNode.role) : 'text';
      const elementName = currentNode?.name ?? '';
      const panResult = pan(cmd.direction, display, elementType, elementName, modeState.currentMode);
      if (panResult) {
        return {
          command: cmd,
          brailleView: panResult,
          elementReached: currentNode ? axNodeToElementInfo(currentNode, navigator.getCursorIndex()) : null,
          modeAfter: modeState.currentMode,
          announcements,
          liveRegionUpdates,
          success: true,
        };
      } else {
        success = false;
        error = `Cannot pan ${cmd.direction} -- at ${cmd.direction === 'left' ? 'start' : 'end'}`;
      }
      break;
    }

    case 'activate': {
      // Activate the current element. First try to click it via locator,
      // then fall back to pressing Enter.
      try {
        const currentNode = navigator.currentNode();
        let activated = false;

        if (currentNode && currentNode.role === 'button' && currentNode.name) {
          // For buttons, use role-based locator for reliable activation
          const btn = page.getByRole('button', { name: currentNode.name });
          if (await btn.count() > 0) {
            await btn.first().click({ timeout: 5000 });
            activated = true;
          }
        } else if (currentNode && currentNode.role === 'link' && currentNode.name) {
          const lnk = page.getByRole('link', { name: currentNode.name });
          if (await lnk.count() > 0) {
            await lnk.first().click({ timeout: 5000 });
            activated = true;
          }
        }

        if (!activated) {
          await page.keyboard.press('Enter');
        }

        await page.waitForTimeout(1000);
        // Refresh the tree after activation (page may have changed)
        await navigator.refresh(page);
        resultNode = navigator.currentNode();
        announcements.push('Activated');
      } catch (e: any) {
        success = false;
        error = `Activate failed: ${e.message}`;
      }
      break;
    }

    case 'toggle': {
      try {
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        await navigator.refresh(page);
        resultNode = navigator.currentNode();
        announcements.push('Toggled');
      } catch (e: any) {
        success = false;
        error = `Toggle failed: ${e.message}`;
      }
      break;
    }

    case 'escape': {
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        // Also exit forms mode if we're in it
        const modeAnnouncement = exitFormsMode(modeState);
        if (modeAnnouncement) announcements.push(modeAnnouncement);
        await navigator.refresh(page);
        resultNode = navigator.currentNode();
      } catch (e: any) {
        success = false;
        error = `Escape failed: ${e.message}`;
      }
      break;
    }

    case 'tab': {
      try {
        if (cmd.direction === 'forward') {
          await page.keyboard.press('Tab');
        } else {
          await page.keyboard.press('Shift+Tab');
        }
        await page.waitForTimeout(300);
        await navigator.refresh(page);

        // Sync virtual cursor with actual browser focus.
        // Tab moves real focus, so find the focused element in the refreshed tree.
        const focusedNode = navigator.allNodes().find(n => n.focused === true);
        if (focusedNode) {
          const focusedIndex = navigator.allNodes().indexOf(focusedNode);
          if (focusedIndex >= 0) {
            // Move virtual cursor to match browser focus
            while (navigator.getCursorIndex() < focusedIndex) navigator.moveDown();
            while (navigator.getCursorIndex() > focusedIndex) navigator.moveUp();
          }
        }

        resultNode = navigator.currentNode();
        announcements.push(`Tabbed ${cmd.direction}`);
      } catch (e: any) {
        success = false;
        error = `Tab failed: ${e.message}`;
      }
      break;
    }

    case 'enterFormsMode': {
      const modeAnnouncement = enterFormsMode(modeState);
      if (modeAnnouncement) announcements.push(modeAnnouncement);
      resultNode = navigator.currentNode();
      // Forms mode is a virtual state — Tab already handles real browser focus.
      // No click needed; the browser focus was set by the preceding Tab command.
      await page.waitForTimeout(100);
      break;
    }

    case 'exitFormsMode': {
      const modeAnnouncement = exitFormsMode(modeState);
      if (modeAnnouncement) announcements.push(modeAnnouncement);
      resultNode = navigator.currentNode();
      break;
    }

    case 'refreshBuffer': {
      await navigator.refresh(page);
      resultNode = navigator.currentNode();
      announcements.push('Buffer refreshed');
      break;
    }

    case 'find': {
      // Simple text search through the nodes
      const searchText = cmd.text.toLowerCase();
      const found = navigator.findNext((n) =>
        (n.name || '').toLowerCase().includes(searchText)
      );
      if (found) {
        resultNode = found;
        announcements.push(`Found "${cmd.text}"`);
      } else {
        success = false;
        error = `Text "${cmd.text}" not found`;
        announcements.push(`Search text not found: "${cmd.text}"`);
      }
      break;
    }

    case 'typeText': {
      try {
        await page.keyboard.type(cmd.text, { delay: 50 });
        await page.waitForTimeout(200);
        announcements.push(cmd.masked ? 'Typed password' : `Typed "${cmd.text}"`);
        resultNode = navigator.currentNode();
      } catch (e: any) {
        success = false;
        error = `Type failed: ${e.message}`;
      }
      break;
    }
  }

  // Build braille view from whatever element we landed on
  let brailleView: BrailleView;
  if (resultNode) {
    const elementType = mapRoleToControlType(resultNode.role);
    // For headings, include the level in the braille abbreviation key
    const brailleType = resultNode.role === 'heading' && resultNode.level
      ? `heading${resultNode.level}`
      : elementType;
    const elementName = resultNode.name || resultNode.value || '';
    brailleView = renderForBraille(elementName, brailleType, modeState.currentMode, display);
    elementReached = axNodeToElementInfo(resultNode, navigator.getCursorIndex());

    // Check for auto-switch to forms mode
    if (cmd.type === 'activate' && shouldAutoSwitch(elementType)) {
      const modeAnnouncement = enterFormsMode(modeState);
      if (modeAnnouncement) announcements.push(modeAnnouncement);
    }
  } else {
    brailleView = getCurrentView(display, 'text', '', modeState.currentMode);
  }

  return {
    command: cmd,
    brailleView,
    elementReached,
    modeAfter: modeState.currentMode,
    announcements,
    liveRegionUpdates,
    success,
    error,
  };
}

/**
 * Returns a predicate for element list collection by list type.
 */
function elementListPredicate(listType: string): ((node: AXNode) => boolean) | null {
  switch (listType) {
    case 'headings': return (n) => n.role === 'heading';
    case 'links': return (n) => n.role === 'link';
    case 'formFields': return (n) => isFormFieldRole(n.role);
    case 'tables': return (n) => n.role === 'table';
    case 'buttons': return (n) => n.role === 'button';
    case 'graphics': return (n) => n.role === 'img';
    case 'landmarks': return (n) => isLandmarkRole(n.role);
    case 'all': return () => true;
    default: return null;
  }
}


// =============================================================================
// Page Model Builder
// =============================================================================

/**
 * Builds a PageModel by scanning the accessibility tree.
 * This represents the agent's mental model of the page after orientation.
 */
function buildPageModel(
  navigator: VirtualNavigator,
  url: string,
  title: string,
  display: ReturnType<typeof createDisplay>,
  modeState: ReturnType<typeof createModeState>,
): PageModel {
  const nodes = navigator.allNodes();

  const headings: HeadingNode[] = [];
  const landmarks: LandmarkNode[] = [];
  const links: LinkNode[] = [];
  const formFields: FormFieldNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.role === 'heading') {
      headings.push({
        level: node.level ?? 0,
        text: node.name || '',
        automationId: `ax-${i}`,
        characterCount: (node.name || '').length,
        discovered: true,
      });
    }

    if (isLandmarkRole(node.role)) {
      landmarks.push({
        type: node.role,
        label: node.name || '',
        automationId: `ax-${i}`,
        discovered: true,
      });
    }

    if (node.role === 'link') {
      links.push({
        text: node.name || '',
        automationId: `ax-${i}`,
        visited: false,
        discovered: true,
      });
    }

    if (isFormFieldRole(node.role) && node.role !== 'button') {
      formFields.push({
        type: node.role,
        label: node.name || '',
        automationId: `ax-${i}`,
        required: node.required ?? false,
        hasError: node.invalid === 'true',
        discovered: true,
      });
    }
  }

  const currentNode = navigator.currentNode();
  const cursorElementType = currentNode ? mapRoleToControlType(currentNode.role) : '';
  const brailleView = getCurrentView(display, cursorElementType, currentNode?.name ?? '', modeState.currentMode);

  return {
    url,
    title,
    loadedAt: new Date(),
    headings,
    landmarks,
    links,
    formFields,
    tables: [], // Populated during deeper navigation if needed
    cursor: {
      elementId: `ax-${navigator.getCursorIndex()}`,
      elementType: cursorElementType,
      elementName: currentNode?.name ?? '',
      lineIndex: navigator.getCursorIndex(),
      characterOffset: 0,
    },
    mode: modeState.currentMode,
    brailleDisplay: brailleView,
    visitedElements: [],
    discoveryPercentage: 0,
    findings: [],
  };
}


// =============================================================================
// Step Executor
// =============================================================================

/**
 * Executes a sequence of NavigationSteps, logging each to the SessionLogger.
 * Handles repeatUntil by repeating a step up to a max count.
 */
async function executeSteps(
  steps: NavigationStep[],
  strategyName: string,
  navigator: VirtualNavigator,
  page: Page,
  display: ReturnType<typeof createDisplay>,
  modeState: ReturnType<typeof createModeState>,
  logger: SessionLogger,
): Promise<void> {
  const MAX_REPEATS = 30; // Safety limit for repeatUntil loops

  for (const step of steps) {
    if (!step.command) {
      // Null command -- orchestrator should provide dynamically.
      // Log as a skip for now.
      stderr(`  [skip] ${step.action}: ${step.description ?? 'no command provided'}`);
      continue;
    }

    const isRepeating = !!step.repeatUntil;
    let repeatCount = 0;

    do {
      repeatCount++;
      stderr(`  [${strategyName}] ${step.action}: ${commandToDescription(step.command)}`);

      const result = await executeCommand(step.command, navigator, page, display, modeState);

      // Log the entry
      const brailleType = result.elementReached
        ? mapRoleToControlType(result.elementReached.role)
        : '';
      const abbreviation = BRAILLE_ABBREVIATIONS[brailleType] ?? '';

      logger.logEntry({
        brailleDisplay: {
          cells: result.brailleView.displayedText,
          fullLine: display.fullLine,
          panPosition: result.brailleView.panPosition,
          totalPans: result.brailleView.totalPans,
          structuredPrefix: abbreviation,
        },
        intent: {
          goal: step.description ?? step.action,
          strategy: strategyName,
          reasoning: step.description ?? `Execute ${step.action}`,
        },
        command: {
          type: step.command.type,
          detail: commandToDescription(step.command),
          jawsEquivalent: commandToKeystroke(step.command),
          modeRequired: step.command.type === 'typeText' ? 'forms' : 'browse',
          modeCurrent: modeState.currentMode,
        },
        result: {
          success: result.success,
          outcome: result.success
            ? (result.elementReached ? `Reached: ${result.elementReached.name || result.elementReached.role}` : 'OK')
            : (result.error ?? 'Failed'),
          newBrailleDisplay: result.brailleView.displayedText,
          modeAfter: result.modeAfter,
          announcements: result.announcements,
          liveRegionUpdates: result.liveRegionUpdates,
        },
      });

      stderr(`    -> [${result.brailleView.displayedText.trimEnd()}]`);

      // Check termination conditions for repeating steps
      if (isRepeating) {
        if (!result.success) break; // No more elements
        if (step.repeatUntil === 'noMoreElements' && !result.success) break;
        if (step.repeatUntil === 'endOfMainContent') {
          // Stop when we hit a landmark that's not main, or end of doc
          if (!result.success) break;
          if (result.elementReached && isLandmarkRole(result.elementReached.role) && result.elementReached.role !== 'main') {
            break;
          }
        }
        if (repeatCount >= MAX_REPEATS) {
          stderr(`    [max repeats reached for ${step.action}]`);
          break;
        }
      }
    } while (isRepeating);
  }
}


// =============================================================================
// Output Helpers
// =============================================================================

function stderr(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}


// =============================================================================
// Main Orchestrator
// =============================================================================

async function main(): Promise<void> {
  const { url, task, auth } = parseArgs();
  const taskSlug = slugify(task);

  let domain: string;
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  stderr(`=== BrailleAgent ===`);
  stderr(`URL:  ${url}`);
  stderr(`Task: ${task}`);
  stderr(`Domain: ${domain}`);
  stderr('');

  // ---------------------------------------------------------------------------
  // 1. Launch browser
  // ---------------------------------------------------------------------------
  stderr('[1/7] Launching browser...');
  // NOTE: This tool requires `npx tsx` (not bun) because bun's Playwright
  // browser launching hangs on Windows due to child process pipe issues.
  const browser: Browser = await chromium.launch({
    headless: true,
    args: [
      '--force-renderer-accessibility',
    ],
  });
  const contextOptions: Record<string, unknown> = {
    reducedMotion: 'reduce',
    colorScheme: 'no-preference',
  };
  if (auth) {
    stderr(`  Loading auth state from: ${auth}`);
    contextOptions.storageState = auth;
  }
  const context: BrowserContext = await browser.newContext(contextOptions);
  const page: Page = await context.newPage();

  // ---------------------------------------------------------------------------
  // 2. Initialize components
  // ---------------------------------------------------------------------------
  stderr('[2/7] Initializing components...');
  const display = createDisplay(40);
  const modeState = createModeState();
  const navigator = new VirtualNavigator();
  const assessmentEngine = createDefaultEngine();
  const logger = new SessionLogger({
    url,
    task,
    taskSlug,
    displaySize: 40,
    strategy: 'orientation',
    maxCommands: 200,
  });

  // ---------------------------------------------------------------------------
  // 3. Navigate to URL
  // ---------------------------------------------------------------------------
  stderr('[3/7] Navigating to URL...');

  let targetUrl = url;
  const needsAuth = requiresAuth(domain);
  const credentials = needsAuth ? getCredentials(domain) : null;

  // If auth is needed and there's a dedicated login URL, go there first
  if (credentials && credentials.loginUrl) {
    targetUrl = credentials.loginUrl;
    stderr(`  Auth required -- navigating to login page: ${targetUrl}`);
  }

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Allow dynamic content to settle
  } catch (e: any) {
    stderr(`  Warning: Navigation issue -- ${e.message}`);
    // Continue anyway -- the page may be partially loaded
  }

  // Get page title
  const pageTitle = await page.title();
  stderr(`  Page title: "${pageTitle}"`);

  // Load the accessibility tree
  await navigator.refresh(page);
  stderr(`  Accessibility tree: ${navigator.allNodes().length} nodes`);

  // Log initial page load
  const initialNode = navigator.currentNode();
  const initialView = renderForBraille(
    pageTitle || 'Untitled',
    'text',
    modeState.currentMode,
    display,
  );
  logger.logEntry({
    brailleDisplay: {
      cells: initialView.displayedText,
      fullLine: display.fullLine,
      panPosition: 0,
      totalPans: initialView.totalPans,
      structuredPrefix: '',
    },
    intent: {
      goal: 'Page loaded -- read title',
      strategy: 'initialization',
      reasoning: 'First thing a braille user perceives is the page title announcement',
    },
    command: {
      type: 'pageLoad',
      detail: `Navigate to ${targetUrl}`,
      jawsEquivalent: 'Browser navigation',
      modeRequired: 'browse',
      modeCurrent: 'browse',
    },
    result: {
      success: true,
      outcome: `Page loaded: "${pageTitle}"`,
      newBrailleDisplay: initialView.displayedText,
      modeAfter: 'browse',
      announcements: [`Page has ${navigator.allNodes().length} elements`, `Title: ${pageTitle}`],
      liveRegionUpdates: [],
    },
  });

  stderr(`  Initial display: [${initialView.displayedText.trimEnd()}]`);

  // ---------------------------------------------------------------------------
  // 4. Authentication flow (if needed)
  // ---------------------------------------------------------------------------
  if (credentials) {
    stderr('[4/7] Executing authentication flow...');

    // Use Playwright locators directly for auth — Tab-based navigation won't work
    // reliably when login fields aren't the first focusable elements on the page.
    const preLoginUrl = page.url();

    try {
      let filled = false;

      // Strategy: find login fields by common selectors
      const usernameSelectors = [
        'input[name="username"]', 'input[name="user"]', 'input[name="email"]',
        'input[type="email"]', '#username', '#email',
        'input[type="text"][name*="user"]', 'input[type="text"][name*="login"]',
        'input[type="text"]:not([name*="search"]):not([name*="q"])',
      ];
      const passwordSelectors = [
        'input[type="password"]', '#password', 'input[name="password"]',
      ];

      for (const sel of usernameSelectors) {
        const field = page.locator(sel);
        if (await field.count() > 0) {
          await field.first().click({ timeout: 3000 });
          await field.first().fill(credentials.username, { timeout: 3000 });
          stderr(`  Filled username via: ${sel}`);
          filled = true;
          break;
        }
      }

      for (const sel of passwordSelectors) {
        const field = page.locator(sel);
        if (await field.count() > 0) {
          await field.first().click({ timeout: 3000 });
          await field.first().fill(credentials.password, { timeout: 3000 });
          stderr(`  Filled password via: ${sel}`);
          break;
        }
      }

      if (filled) {
        const submitSelectors = [
          'button[type="submit"]', 'input[type="submit"]',
          'button:has-text("Log in")', 'button:has-text("Sign in")',
          'button:has-text("Login")', 'button:has-text("Submit")',
        ];
        for (const sel of submitSelectors) {
          const btn = page.locator(sel);
          if (await btn.count() > 0) {
            await btn.first().click({ timeout: 5000 });
            stderr(`  Clicked submit via: ${sel}`);
            break;
          }
        }
      }

      // Log auth as a session entry
      logger.logEntry({
        brailleDisplay: { cells: 'edt [auth credentials]                  '.slice(0, 40), fullLine: 'edt [auth]', panPosition: 0, totalPans: 1, structuredPrefix: 'edt' },
        intent: { goal: 'Authenticate with test credentials', strategy: 'form-completion', reasoning: 'Direct fill — login fields not first focusable' },
        command: { type: 'typeText', detail: 'Fill username + password, submit', jawsEquivalent: 'Tab, type, Enter', modeRequired: 'forms', modeCurrent: 'browse' },
        result: { success: filled, outcome: filled ? 'Credentials submitted' : 'Login fields not found', newBrailleDisplay: '', modeAfter: 'browse', announcements: [], liveRegionUpdates: [] },
      });
    } catch (e: any) {
      stderr(`  Auth error: ${e.message}`);
    }

    // Wait for navigation after login
    stderr('  Waiting for post-login navigation...');
    try {
      await page.waitForURL((url) => url.toString() !== preLoginUrl, { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2000);
    } catch {}
    const postLoginUrl = page.url();
    stderr(`  Post-login URL: ${postLoginUrl} (was: ${preLoginUrl})`);
    stderr(`  Login ${postLoginUrl !== preLoginUrl ? 'succeeded (URL changed)' : 'may have failed (URL unchanged)'}`);

    // If we were sent to a login page but the target was different, navigate there now
    if (credentials.loginUrl && credentials.loginUrl !== url) {
      stderr(`  Navigating to target URL after auth: ${url}`);
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
      } catch (e: any) {
        stderr(`  Warning: Post-auth navigation issue -- ${e.message}`);
      }
    }

    // Refresh tree after auth
    await navigator.refresh(page);
    const postAuthTitle = await page.title();
    stderr(`  Post-auth page: "${postAuthTitle}" (${navigator.allNodes().length} nodes)`);
  } else {
    stderr('[4/7] No authentication required -- skipping.');
  }

  // ---------------------------------------------------------------------------
  // 5. Orientation strategy
  // ---------------------------------------------------------------------------
  stderr('[5/7] Running orientation strategy...');

  // Refresh tree before orientation (page may have changed)
  await navigator.refresh(page);

  const orientationSteps = createOrientationSteps();
  await executeSteps(orientationSteps, 'orientation', navigator, page, display, modeState, logger);

  // ---------------------------------------------------------------------------
  // 6. Build page model and run assessment
  // ---------------------------------------------------------------------------
  stderr('[6/7] Building page model and running assessment...');

  const currentTitle = await page.title();
  const pageModel = buildPageModel(navigator, page.url(), currentTitle, display, modeState);

  stderr(`  Headings: ${pageModel.headings.length}`);
  stderr(`  Landmarks: ${pageModel.landmarks.length}`);
  stderr(`  Links: ${pageModel.links.length}`);
  stderr(`  Form fields: ${pageModel.formFields.length}`);

  // Run assessment engine
  const findings = assessmentEngine.evaluate({
    pageModel,
    navigationLog: [],
    sessionEntries: logger.getSession().entries,
  });

  stderr(`  Findings: ${findings.length}`);

  for (const finding of findings) {
    logger.addFinding(finding);
    stderr(`    [${finding.severity.toUpperCase()}] ${finding.title}`);
  }

  // ---------------------------------------------------------------------------
  // 7. Save session
  // ---------------------------------------------------------------------------
  stderr('[7/7] Saving session...');

  // Complete the session
  const taskCompleted = true; // Orientation scan is always "completed"
  const notes = findings.length === 0
    ? 'Orientation scan completed -- no accessibility issues detected from braille perspective'
    : `Orientation scan completed -- ${findings.length} finding(s) from braille perspective`;

  logger.complete(taskCompleted, notes);

  // Build output directory: braille-tests/{YYYY-MM}/{domain}/sessions/
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const outputDir = join('C:', 'projects', 'accessibility-audits', 'braille-tests', yearMonth, domain, 'sessions');

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Save JSON session
  const sessionPath = logger.save(outputDir);
  stderr(`  Session JSON: ${sessionPath}`);

  // Save Markdown transcript alongside
  const session = logger.getSession();
  const markdown = renderSession(session);
  const mdPath = sessionPath.replace(/\.json$/, '.md');
  writeFileSync(mdPath, markdown, 'utf-8');
  stderr(`  Transcript MD: ${mdPath}`);

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  await browser.close();

  // Print the session file path to stdout (for scripting)
  console.log(sessionPath);

  stderr('');
  stderr('=== Session Complete ===');
  stderr(`  Commands: ${session.summary.totalCommands}`);
  stderr(`  Pan operations: ${session.summary.totalPanOperations}`);
  stderr(`  Mode changes: ${session.summary.totalModeChanges}`);
  stderr(`  Est. user time: ~${session.summary.estimatedUserTimeSeconds}s`);
  stderr(`  Confusion points: ${session.summary.confusionPoints}`);
  stderr(`  Findings: ${session.summary.findingsGenerated}`);
}


// =============================================================================
// Entry Point
// =============================================================================

main().catch((err) => {
  console.error('BrailleAgent fatal error:', err);
  process.exit(1);
});
