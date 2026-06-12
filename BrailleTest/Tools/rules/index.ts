/**
 * Rule index - exports all assessment rules and the ALL_RULES collection.
 */

export { headingStructureRule } from './heading-structure.js';
export { landmarkPresenceRule } from './landmark-presence.js';
export { formLabelsRule } from './form-labels.js';
export { linkPurposeRule } from './link-purpose.js';
export { navigationCostRule } from './navigation-cost.js';

import { headingStructureRule } from './heading-structure.js';
import { landmarkPresenceRule } from './landmark-presence.js';
import { formLabelsRule } from './form-labels.js';
import { linkPurposeRule } from './link-purpose.js';
import { navigationCostRule } from './navigation-cost.js';
import type { AssessmentRule } from '../types/index.js';

export const ALL_RULES: AssessmentRule[] = [
  headingStructureRule,
  landmarkPresenceRule,
  formLabelsRule,
  linkPurposeRule,
  navigationCostRule,
];
