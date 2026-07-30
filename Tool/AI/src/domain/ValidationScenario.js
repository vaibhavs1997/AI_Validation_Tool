/**
 * ValidationScenario
 *
 * Domain model for a validation scenario.
 * Supports manual entry and AI generation from approved requirements.
 * No AI extraction logic — pure deterministic CRUD.
 */

const VALID_STATUSES = Object.freeze(['draft', 'needs-review', 'ready', 'approved', 'rejected']);
const VALID_PRIORITIES = Object.freeze(['low', 'medium', 'high', 'critical']);

/**
 * @param {{
 *   id?: string,
 *   projectId: string,
 *   requirementId: string,
 *   title?: string,
 *   description?: string,
 *   priority?: string,
 *   confidence?: number,
 *   status?: string,
 *   source?: 'manual' | 'ai-generated',
 *   createdAt?: Date|string,
 *   updatedAt?: Date|string,
 * }} input
 * @returns {{
 *   id: string,
 *   projectId: string,
 *   requirementId: string,
 *   title: string,
 *   description: string,
 *   priority: string,
 *   confidence: number,
 *   status: string,
 *   source: string,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }}
 */
function createValidationScenario(input = {}) {
  if (!input || typeof input.projectId !== 'string' || input.projectId.trim().length === 0) {
    throw new Error('ValidationScenario projectId must be a non-empty string.');
  }

  if (!input || typeof input.requirementId !== 'string' || input.requirementId.trim().length === 0) {
    throw new Error('ValidationScenario requirementId must be a non-empty string.');
  }

  const id = input.id || `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const status = String(input.status || 'draft').toLowerCase();
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`ValidationScenario status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const priority = String(input.priority || 'medium').toLowerCase();
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new Error(`ValidationScenario priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  const source = String(input.source || 'manual').toLowerCase();
  if (!['manual', 'ai-generated'].includes(source)) {
    throw new Error('ValidationScenario source must be one of: manual, ai-generated');
  }

  const confidence = Number(input.confidence);
  const safeConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5;

  return {
    id,
    projectId: input.projectId.trim(),
    requirementId: input.requirementId.trim(),
    title: input.title ? String(input.title).trim() : 'Untitled Scenario',
    description: input.description ? String(input.description).trim() : '',
    priority,
    confidence: safeConfidence,
    status,
    source,
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt instanceof Date ? new Date(input.updatedAt) : now,
  };
}

/**
 * Validate that a scenario has all required fields for "ready" status.
 * Deterministic validation only — no AI.
 * @param {object} scenario
 * @returns {{ valid: boolean, checks: Array<{ field: string, passed: boolean, message: string }> }}
 */
function validateScenarioReadiness(scenario) {
  if (!scenario) {
    return {
      valid: false,
      checks: [
        { field: 'description', passed: false, message: 'Description is required.' },
        { field: 'priority', passed: false, message: 'Priority must be set.' },
      ],
    };
  }

  const checks = [
    {
      field: 'description',
      passed: Boolean(scenario.description && scenario.description.trim().length > 0),
      message: 'Description is required.',
    },
    {
      field: 'priority',
      passed: Boolean(scenario.priority) && VALID_PRIORITIES.includes(scenario.priority),
      message: 'Priority must be set to low, medium, high, or critical.',
    },
  ];

  const allPassed = checks.every((c) => c.passed);
  const somePassed = checks.some((c) => c.passed);

  return {
    valid: allPassed,
    checks,
    overall: allPassed ? 'ready' : somePassed ? 'ready-with-warnings' : 'not-ready',
  };
}

module.exports = {
  createValidationScenario,
  validateScenarioReadiness,
  VALID_STATUSES,
  VALID_PRIORITIES,
};