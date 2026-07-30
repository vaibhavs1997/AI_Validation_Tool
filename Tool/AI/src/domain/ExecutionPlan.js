/**
 * ExecutionPlan
 *
 * Domain model for an execution plan.
 * Contains ordered steps, dependencies, and execution metadata.
 */

const VALID_EXECUTION_ORDERS = Object.freeze(['sequential', 'parallel']);
const { createExecutionStep } = require('./ExecutionStep');

/**
 * @param {{
 *   id?: string,
 *   runId?: string,
 *   steps?: Array<object>,
 *   executionOrder?: string,
 *   warnings?: string[],
 *   variables?: Record<string, object>,
 *   authentication?: object,
 *   environment?: object,
 *   estimatedDuration?: number,
 * }} input
 * @returns {{
 *   id: string,
 *   runId: string|null,
 *   steps: Array<object>,
 *   totalSteps: number,
 *   executionOrder: string,
 *   warnings: string[],
 *   variables: Record<string, object>,
 *   authentication: object,
 *   environment: object,
 *   estimatedDuration: number,
 *   createdAt: Date,
 *   updatedAt: Date,
 * }}
 */
function createExecutionPlan(input = {}) {
  if (!input || typeof input.steps !== 'undefined' && !Array.isArray(input.steps)) {
    throw new Error('ExecutionPlan steps must be an array if provided.');
  }

  const id = input.id || `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const executionOrder = String(input.executionOrder || 'sequential').toLowerCase();
  if (!VALID_EXECUTION_ORDERS.includes(executionOrder)) {
    throw new Error(`ExecutionPlan executionOrder must be one of: ${VALID_EXECUTION_ORDERS.join(', ')}`);
  }

  const steps = Array.isArray(input.steps) ? input.steps.map(createExecutionStep) : [];
  const totalSteps = steps.length;

  // Calculate estimated duration based on step estimates
  let estimatedDuration = typeof input.estimatedDuration === 'number' ? input.estimatedDuration : 0;
  if (estimatedDuration === 0 && steps.length > 0) {
    estimatedDuration = steps.reduce((acc, step) => {
      return acc + (typeof step.estimatedDuration === 'number' ? step.estimatedDuration : 0);
    }, 0);
  }

  return {
    id,
    runId: input.runId || null,
    steps,
    totalSteps,
    executionOrder,
    warnings: Array.isArray(input.warnings) ? input.warnings.map(String) : [],
    variables: input.variables && typeof input.variables === 'object' ? { ...input.variables } : {},
    authentication: input.authentication && typeof input.authentication === 'object' ? { ...input.authentication } : {},
    environment: input.environment && typeof input.environment === 'object' ? { ...input.environment } : {},
    estimatedDuration,
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt instanceof Date ? new Date(input.updatedAt) : now,
  };
}

/**
 * Validate that a plan has all required fields for execution.
 * @param {object} plan
 * @returns {{ valid: boolean, checks: Array<{ field: string, passed: boolean, message: string }> }}
 */
function validatePlanReadiness(plan) {
  if (!plan) {
    return {
      valid: false,
      checks: [
        { field: 'steps', passed: false, message: 'Plan must have at least one step.' },
        { field: 'executionOrder', passed: false, message: 'Execution order must be specified.' },
      ],
    };
  }

  const checks = [
    {
      field: 'steps',
      passed: Array.isArray(plan.steps) && plan.steps.length > 0,
      message: 'Plan must have at least one step.',
    },
    {
      field: 'executionOrder',
      passed: VALID_EXECUTION_ORDERS.includes(plan.executionOrder),
      message: 'Execution order must be sequential or parallel.',
    },
    {
      field: 'variables',
      passed: typeof plan.variables === 'object' && plan.variables !== null,
      message: 'Variables must be an object.',
    },
    {
      field: 'environment',
      passed: typeof plan.environment === 'object' && plan.environment !== null,
      message: 'Environment must be an object.',
    },
    {
      field: 'totalSteps',
      passed: typeof plan.totalSteps === 'number' && plan.totalSteps > 0,
      message: 'Total steps must be a positive number.',
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
  createExecutionPlan,
  validatePlanReadiness,
  VALID_EXECUTION_ORDERS,
};