/**
 * Assessment Engine
 *
 * Runs registered assessment rules against a page model and navigation context
 * to produce accessibility findings from the braille user's perspective.
 */

import type {
  AssessmentRule,
  AssessmentContext,
  AccessibilityFinding,
} from './types/index.js';
import { ALL_RULES } from './rules/index.js';

export class AssessmentEngine {
  private rules: AssessmentRule[] = [];

  /** Register a single assessment rule */
  registerRule(rule: AssessmentRule): void {
    this.rules.push(rule);
  }

  /** Register multiple assessment rules at once */
  registerRules(rules: AssessmentRule[]): void {
    for (const rule of rules) {
      this.rules.push(rule);
    }
  }

  /** Run all registered rules against the context and return combined findings */
  evaluate(context: AssessmentContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];

    for (const rule of this.rules) {
      const ruleFindings = rule.evaluate(context);
      findings.push(...ruleFindings);
    }

    return findings;
  }

  /** Run a specific rule by ID and return its findings */
  evaluateRule(
    ruleId: string,
    context: AssessmentContext,
  ): AccessibilityFinding[] {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) {
      throw new Error(
        `Rule "${ruleId}" not found. Registered rules: ${this.getRuleIds().join(', ')}`,
      );
    }
    return rule.evaluate(context);
  }

  /** Get all registered rule IDs */
  getRuleIds(): string[] {
    return this.rules.map((r) => r.id);
  }
}

/** Create an engine with all default rules pre-registered */
export function createDefaultEngine(): AssessmentEngine {
  const engine = new AssessmentEngine();
  engine.registerRules(ALL_RULES);
  return engine;
}
