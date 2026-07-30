/**
 * ExecutionStep
 *
 * Domain model for a single step in an execution plan.
 * Represents one executable test with its execution context.
 */

const VALID_STEP_STATUSES = Object.freeze(['pending', 'running', 'passed', 'failed', 'blocked', 'skipped', 'cancelled']);

/**
 * @param {{
 *   id?: string,
 *   runId?: string,
 *   planId?: string,
 *   testId?: string,
 *   title?: string,
 *   description?: string,
 *   order?: number,
 *   operationRef?: { serviceId: string, operationId: string },
 *   dependencies?: string[],
 *   variablesRequired?: string[],
 *   variablesProduced?: string[],
 *   authenticationRequired?: boolean,
 *   authenticationDetails?: object,
 *   request?: object,
 *   assertions?: object[],
 *   status?: string,
 *   result?: object,
 *   startedAt?: Date|string,
 *   completedAt?: Date|string,
 *   durationMs?: number,
 * }} input
 * @returns {{
 *   id: string,
 *   runId: string|null,
 *   planId: string|null,
 *   testId: string,
 *   title: string,
 *   description: string,
 *   order: number,
 *   operationRef: { serviceId: string, operationId: string }|null,
 *   dependencies: string[],
 *   variablesRequired: string[],
 *   variablesProduced: string[],
 *   authenticationRequired: boolean,
 *   authenticationDetails: object,
 *   request: object,
 *   assertions: object[],
 *   status: string,
 *   result: object|null,
 *   startedAt: Date|null,
 *   completedAt: Date|null,
 *   durationMs: number|null,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }}
 */
function createExecutionStep(input = {}) {
  if (!input || typeof input.testId !== 'string' || input.testId.trim().length === 0) {
    throw new Error('ExecutionStep testId must be a non-empty string.');
  }

  const id = input.id || `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const status = String(input.status || 'pending').toLowerCase();
  if (!VALID_STEP_STATUSES.includes(status)) {
    throw new Error(`ExecutionStep status must be one of: ${VALID_STEP_STATUSES.join(', ')}`);
  }

  const order = typeof input.order === 'number' && input.order > 0 ? input.order : 0;

  const operationRef = input.operationRef && typeof input.operationRef === 'object' && input.operationRef.serviceId && input.operationRef.operationId
    ? { serviceId: String(input.operationRef.serviceId), operationId: String(input.operationRef.operationId) }
    : null;

  const dependencies = Array.isArray(input.dependencies) ? input.dependencies.map(String) : [];
  const variablesRequired = Array.isArray(input.variablesRequired) ? input.variablesRequired.map(String) : [];
  const variablesProduced = Array.isArray(input.variablesProduced) ? input.variablesProduced.map(String) : [];

  return {
    id,
    runId: input.runId || null,
    planId: input.planId || null,
    testId: input.testId.trim(),
    title: input.title ? String(input.title).trim() : 'Untitled Step',
    description: input.description ? String(input.description).trim() : '',
    order,
    operationRef,
    dependencies,
    variablesRequired,
    variablesProduced,
    authenticationRequired: typeof input.authenticationRequired === 'boolean' ? input.authenticationRequired : false,
    authenticationDetails: input.authenticationDetails && typeof input.authenticationDetails === 'object' ? { ...input.authenticationDetails } : {},
    request: input.request && typeof input.request === 'object' ? { ...input.request } : {},
    assertions: Array.isArray(input.assertions) ? input.assertions.map(a => ({ ...a })) : [],
    status,
    result: input.result && typeof input.result === 'object' ? { ...input.result } : null,
    startedAt: input.startedAt ? new Date(input.startedAt) : null,
    completedAt: input.completedAt ? new Date(input.completedAt) : null,
    durationMs: typeof input.durationMs === 'number' ? input.durationMs : null,
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt instanceof Date ? new Date(input.updatedAt) : now,
  };
}

/**
 * Validate that a step has all required fields for execution.
 * @param {object} step
 * @returns {{ valid: boolean, checks: Array<{ field: string, passed: boolean, message: string }> }}
 */
function validateStepReadiness(step) {
  if (!step) {
    return {
      valid: false,
      checks: [
        { field: 'testId', passed: false, message: 'Step must have a testId.' },
        { field: 'operationRef', passed: false, message: 'Step must have an operationRef.' },
        { field: 'request', passed: false, message: 'Step must have a request.' },
      ],
    };
  }

  const checks = [
    {
      field: 'testId',
      passed: Boolean(step.testId && step.testId.trim().length > 0),
      message: 'Step must have a non-empty testId.',
    },
    {
      field: 'operationRef',
      passed: step.operationRef && step.operationRef.serviceId && step.operationRef.operationId,
      message: 'Step must have a valid operationRef with serviceId and operationId.',
    },
    {
      field: 'request',
      passed: typeof step.request === 'object' && step.request !== null,
      message: 'Step must have a request object.',
    },
    {
      field: 'order',
      passed: typeof step.order === 'number' && step.order > 0,
      message: 'Step must have a valid order (positive number).',
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
  createExecutionStep,
  validateStepReadiness,
  VALID_STEP_STATUSES,
};