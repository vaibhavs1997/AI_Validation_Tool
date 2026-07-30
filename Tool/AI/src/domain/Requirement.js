/**
 * Requirement
 *
 * Domain model for a project requirement.
 * Supports manual entry, user story paste, and document upload.
 * No AI extraction logic — pure deterministic CRUD.
 */

const VALID_STATUSES = Object.freeze(['draft', 'needs-review', 'ready']);
const VALID_PRIORITIES = Object.freeze(['low', 'medium', 'high', 'critical']);

/**
 * @param {{
 *   id?: string,
 *   projectId: string,
 *   title?: string,
 *   description?: string,
 *   acceptanceCriteria?: string[],
 *   businessRules?: string[],
 *   priority?: string,
 *   notes?: string,
 *   status?: string,
 *   source?: 'manual' | 'paste' | 'upload',
 *   fileName?: string,
 *   createdAt?: Date|string,
 *   updatedAt?: Date|string,
 * }} input
 * @returns {{
 *   id: string,
 *   projectId: string,
 *   title: string,
 *   description: string,
 *   acceptanceCriteria: string[],
 *   businessRules: string[],
 *   priority: string,
 *   notes: string,
 *   status: string,
 *   source: string,
 *   fileName: string|null,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }}
 */
function createRequirement(input = {}) {
  if (!input || typeof input.projectId !== 'string' || input.projectId.trim().length === 0) {
    throw new Error('Requirement projectId must be a non-empty string.');
  }

  const id = input.id || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const status = String(input.status || 'draft').toLowerCase();
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Requirement status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const priority = String(input.priority || 'medium').toLowerCase();
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new Error(`Requirement priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  const source = String(input.source || 'manual').toLowerCase();
  if (!['manual', 'paste', 'upload'].includes(source)) {
    throw new Error('Requirement source must be one of: manual, paste, upload');
  }

  return {
    id,
    projectId: input.projectId.trim(),
    title: input.title ? String(input.title).trim() : 'Untitled Requirement',
    description: input.description ? String(input.description).trim() : '',
    acceptanceCriteria: Array.isArray(input.acceptanceCriteria)
      ? input.acceptanceCriteria.map(String)
      : [],
    businessRules: Array.isArray(input.businessRules)
      ? input.businessRules.map(String)
      : [],
    priority,
    notes: input.notes ? String(input.notes).trim() : '',
    status,
    source,
    fileName: input.fileName ? String(input.fileName).trim() : null,
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt instanceof Date ? new Date(input.updatedAt) : now,
  };
}

/**
 * Validate that a requirement has all required fields for "ready" status.
 * Deterministic validation only — no AI.
 * @param {object} requirement
 * @returns {{ valid: boolean, checks: Array<{ field: string, passed: boolean, message: string }> }}
 */
function validateRequirementReadiness(requirement) {
  if (!requirement) {
    return {
      valid: false,
      checks: [
        { field: 'description', passed: false, message: 'Description is required.' },
        { field: 'acceptanceCriteria', passed: false, message: 'Acceptance criteria are required.' },
        { field: 'businessRules', passed: false, message: 'Business rules are required.' },
        { field: 'priority', passed: false, message: 'Priority must be set.' },
      ],
    };
  }

  const checks = [
    {
      field: 'description',
      passed: Boolean(requirement.description && requirement.description.trim().length > 0),
      message: 'Description is required.',
    },
    {
      field: 'acceptanceCriteria',
      passed: Array.isArray(requirement.acceptanceCriteria) && requirement.acceptanceCriteria.length > 0,
      message: 'At least one acceptance criterion is required.',
    },
    {
      field: 'businessRules',
      passed: Array.isArray(requirement.businessRules) && requirement.businessRules.length > 0,
      message: 'At least one business rule is required.',
    },
    {
      field: 'priority',
      passed: Boolean(requirement.priority) && VALID_PRIORITIES.includes(requirement.priority),
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
  createRequirement,
  validateRequirementReadiness,
  VALID_STATUSES,
  VALID_PRIORITIES,
};