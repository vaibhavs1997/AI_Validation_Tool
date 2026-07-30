/**
 * ExecutionRun - Domain model for execution runs in the Execution Workspace.
 */

const { createExecutionPlan, VALID_PLAN_STATUSES } = require('./ExecutionPlan');
const VALID_STATUSES = Object.freeze(['draft', 'planned', 'running', 'passed', 'failed', 'cancelled', 'completed']);

/**
 * @param {{
 *   id?: string,
 *   projectId: string,
 *   name?: string,
 *   description?: string,
 *   status?: string,
 *   plan?: object,
 *   testIds?: string[],
 *   results?: Array<object>,
 *   warnings?: string[],
 *   variables?: Record<string, any>,
 *   authentication?: object,
 *   environment?: object,
 *   startedAt?: Date|string,
 *   completedAt?: Date|string,
 * }} input
 * @returns {{
 *   id: string,
 *   projectId: string,
 *   name: string,
 *   description: string,
 *   status: string,
 *   plan: ReturnType<typeof createExecutionPlan>|null,
 *   testIds: string[],
 *   results: Array<object>,
 *   warnings: string[],
 *   variables: Record<string, any>,
 *   authentication: object,
 *   environment: object,
 *   startedAt: Date|null,
 *   completedAt: Date|null,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }}
 */
function createExecutionRun(input = {}) {
  if (!input || typeof input.projectId !== 'string' || input.projectId.trim().length === 0) {
    throw new Error('ExecutionRun projectId must be a non-empty string.');
  }

  const id = input.id || `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const status = String(input.status || 'draft').toLowerCase();
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`ExecutionRun status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const plan = input.plan && typeof input.plan === 'object' ? createExecutionPlan(input.plan) : null;

  return {
    id,
    projectId: input.projectId.trim(),
    name: input.name ? String(input.name).trim() : `Run ${now.toLocaleString()}`,
    description: input.description ? String(input.description).trim() : '',
    status,
    plan,
    testIds: Array.isArray(input.testIds) ? input.testIds.map(String) : [],
    results: Array.isArray(input.results) ? input.results.map(r => ({ ...r })) : [],
    warnings: Array.isArray(input.warnings) ? input.warnings.map(String) : [],
    variables: input.variables && typeof input.variables === 'object' ? { ...input.variables } : {},
    authentication: input.authentication && typeof input.authentication === 'object' ? { ...input.authentication } : {},
    environment: input.environment && typeof input.environment === 'object' ? { ...input.environment } : {},
    startedAt: input.startedAt ? new Date(input.startedAt) : null,
    completedAt: input.completedAt ? new Date(input.completedAt) : null,
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt instanceof Date ? new Date(input.updatedAt) : now,
  };
}

module.exports = { createExecutionRun, VALID_STATUSES };
