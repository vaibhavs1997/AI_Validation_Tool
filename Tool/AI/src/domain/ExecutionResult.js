/**
 * ExecutionResult
 *
 * Domain model for the result of a single execution step.
 * Contains status, response data, assertions, and extracted variables.
 */

const VALID_RESULT_STATUSES = Object.freeze(['passed', 'failed', 'blocked', 'skipped', 'cancelled']);

/**
 * @param {{
 *   stepId?: string,
 *   runId?: string,
 *   statusCode?: number|null,
 *   responseBody?: any,
 *   headers?: Record<string, string>,
 *   assertions?: Array<object>,
 *   logs?: string[],
 *   error?: string|null,
 *   variablesExtracted?: Record<string, any>,
 *   startedAt?: Date|string,
 *   completedAt?: Date|string,
 *   durationMs?: number,
 * }} input
 * @returns {{
 *   stepId: string,
 *   runId: string|null,
 *   statusCode: number|null,
 *   responseBody: any,
 *   headers: Record<string, string>,
 *   assertions: Array<object>,
 *   logs: string[],
 *   error: string|null,
 *   variablesExtracted: Record<string, any>,
 *   startedAt: Date|null,
 *   completedAt: Date|null,
 *   durationMs: number|null,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }}
 */
function createExecutionResult(input = {}) {
  if (!input || typeof input.stepId !== 'string' || input.stepId.trim().length === 0) {
    throw new Error('ExecutionResult stepId must be a non-empty string.');
  }

  const id = input.id || `result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  return {
    id,
    stepId: input.stepId.trim(),
    runId: input.runId || null,
    statusCode: typeof input.statusCode === 'number' ? input.statusCode : null,
    responseBody: input.responseBody !== undefined ? input.responseBody : null,
    headers: input.headers && typeof input.headers === 'object' ? { ...input.headers } : {},
    assertions: Array.isArray(input.assertions) ? input.assertions.map(a => ({ ...a })) : [],
    logs: Array.isArray(input.logs) ? input.logs.map(String) : [],
    error: input.error ? String(input.error) : null,
    variablesExtracted: input.variablesExtracted && typeof input.variablesExtracted === 'object' ? { ...input.variablesExtracted } : {},
    startedAt: input.startedAt ? new Date(input.startedAt) : null,
    completedAt: input.completedAt ? new Date(input.completedAt) : null,
    durationMs: typeof input.durationMs === 'number' ? input.durationMs : null,
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt instanceof Date ? new Date(input.updatedAt) : now,
  };
}

/**
 * Create an assertion result.
 * @param {{
 *   type?: string,
 *   expected?: any,
 *   actual?: any,
 *   passed?: boolean,
 *   message?: string,
 * }} input
 * @returns {{
 *   type: string,
 *   expected: any,
 *   actual: any,
 *   passed: boolean,
 *   message: string,
 * }}
 */
function createAssertionResult(input = {}) {
  const type = String(input.type || 'status').toLowerCase();
  if (!['status', 'body', 'header', 'schema'].includes(type)) {
    throw new Error('Assertion type must be one of: status, body, header, schema');
  }

  return {
    type,
    expected: input.expected !== undefined ? input.expected : null,
    actual: input.actual !== undefined ? input.actual : null,
    passed: typeof input.passed === 'boolean' ? input.passed : false,
    message: input.message ? String(input.message) : '',
  };
}

/**
 * Validate that a result has all required fields.
 * @param {object} result
 * @returns {{ valid: boolean, checks: Array<{ field: string, passed: boolean, message: string }> }}
 */
function validateResult(result) {
  if (!result) {
    return {
      valid: false,
      checks: [
        { field: 'stepId', passed: false, message: 'Result must have a stepId.' },
        { field: 'statusCode', passed: false, message: 'Result must have a statusCode.' },
      ],
    };
  }

  const checks = [
    {
      field: 'stepId',
      passed: Boolean(result.stepId && result.stepId.trim().length > 0),
      message: 'Result must have a non-empty stepId.',
    },
    {
      field: 'statusCode',
      passed: typeof result.statusCode === 'number' && result.statusCode >= 200 && result.statusCode < 600,
      message: 'Result must have a valid HTTP status code.',
    },
    {
      field: 'durationMs',
      passed: typeof result.durationMs === 'number' && result.durationMs >= 0,
      message: 'Result must have a non-negative duration.',
    },
  ];

  const allPassed = checks.every((c) => c.passed);
  const somePassed = checks.some((c) => c.passed);

  return {
    valid: allPassed,
    checks,
    overall: allPassed ? 'valid' : somePassed ? 'partial' : 'invalid',
  };
}

module.exports = {
  createExecutionResult,
  createAssertionResult,
  validateResult,
  VALID_RESULT_STATUSES,
};