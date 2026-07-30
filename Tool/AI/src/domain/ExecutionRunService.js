/**
 * ExecutionRunService
 *
 * Application service that coordinates execution.
 * Manages execution run lifecycle, validation, and persistence.
 */

const { createExecutionRun } = require('./ExecutionRun');
const { createExecutionPlan } = require('./ExecutionPlan');
const { executePipeline } = require('./ExecutionPipeline');
const { executeRun, cancelExecution } = require('./ExecutionOrchestrator');
const { validatePlan, detectCircularDependencies } = require('./PlanValidator');
const { resolveExecutionOrder } = require('./DependencyResolver');

/**
 * Create a new ExecutionRunService.
 * @param {object} options
 * @param {Array<object>} options.availableOperations - Available API operations
 * @returns {object}
 */
function createExecutionRunService(options = {}) {
  const availableOperations = options.availableOperations || [];
  const runs = new Map();
  const service = { runs, availableOperations };

  return {
    createRun: (params) => createRun(service, params),
    executeRun: (runId, context, options) => executeRunFn(service, runId, context, options),
    dryRun: (runId, context) => dryRun(service, runId, context),
    rebuildPlan: (runId, steps, executionOrder) => rebuildPlan(service, runId, steps, executionOrder),
    cancelRun: (runId) => cancelRunFn(service, runId),
    getRun: (runId) => getRun(service, runId),
    listRuns: (projectId) => listRuns(service, projectId),
  };
}

/**
 * Create a new execution run.
 * @param {object} service - ExecutionRunService instance
 * @param {object} params
 * @param {string} params.projectId - Project ID
 * @param {string} params.name - Run name
 * @param {string} params.description - Run description
 * @param {object} params.plan - ExecutionPlan
 * @returns {object} Created run
 */
function createRun(service, params) {
  const { projectId, name, description, plan } = params;

  if (!projectId) {
    throw new Error('projectId is required');
  }

  const run = createExecutionRun({
    projectId,
    name: name || `Run ${new Date().toLocaleString()}`,
    description: description || '',
    plan: plan || createExecutionPlan({ steps: [], executionOrder: 'sequential' }),
  });

  service.runs.set(run.id, run);
  return run;
}

/**
 * Execute an execution run.
 * @param {object} service - ExecutionRunService instance
 * @param {string} runId - Run ID
 * @param {object} context - ExecutionContext
 * @param {object} options - Execution options
 * @returns {object} Execution result
 */
async function executeRunFn(service, runId, context, options = {}) {
  const run = service.runs.get(runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  // Update run status
  run.status = 'running';
  run.startedAt = new Date();

  try {
    // Execute the run
    const result = await executeRun(run, context, service.availableOperations, options);

    // Update run with results
    run.status = result.success ? 'completed' : 'failed';
    run.completedAt = new Date();
    run.results = result.collector.results;
    run.warnings = result.tracker.events.filter(e => e.severity === 'warning').map(e => e.message);

    return result;
  } catch (error) {
    run.status = 'failed';
    run.completedAt = new Date();
    run.warnings = [error.message];
    throw error;
  }
}

/**
 * Execute a dry run.
 * @param {object} service - ExecutionRunService instance
 * @param {string} runId - Run ID
 * @param {object} context - ExecutionContext
 * @returns {object} Dry run result
 */
async function dryRun(service, runId, context) {
  const run = service.runs.get(runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  return executeRunFn(service, runId, context, { dryRun: true });
}

/**
 * Rebuild execution plan.
 * @param {object} service - ExecutionRunService instance
 * @param {string} runId - Run ID
 * @param {Array<object>} steps - New plan steps
 * @param {string} executionOrder - Execution order
 * @returns {object} Updated run
 */
function rebuildPlan(service, runId, steps, executionOrder = 'sequential') {
  const run = service.runs.get(runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  // Validate new plan
  const newPlan = createExecutionPlan({ steps, executionOrder });
  const validation = validatePlan(newPlan, service.availableOperations);

  if (!validation.valid) {
    throw new Error(`Invalid plan: ${validation.errors.map(e => e.message).join(', ')}`);
  }

  // Check for circular dependencies
  const cycleCheck = detectCircularDependencies(steps);
  if (cycleCheck.hasCycle) {
    throw new Error(`Circular dependency detected: ${cycleCheck.cycles.map(c => c.join(' → ')).join('; ')}`);
  }

  // Update run
  run.plan = newPlan;
  run.updatedAt = new Date();

  return run;
}

/**
 * Cancel an execution run.
 * @param {object} service - ExecutionRunService instance
 * @param {string} runId - Run ID
 * @returns {object} Updated run
 */
function cancelRunFn(service, runId) {
  const run = service.runs.get(runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  run.status = 'cancelled';
  run.completedAt = new Date();
  run.updatedAt = new Date();

  return run;
}

/**
 * Get an execution run by ID.
 * @param {object} service - ExecutionRunService instance
 * @param {string} runId - Run ID
 * @returns {object|undefined} Run or undefined
 */
function getRun(service, runId) {
  return service.runs.get(runId);
}

/**
 * List all execution runs.
 * @param {object} service - ExecutionRunService instance
 * @param {string} projectId - Optional project ID filter
 * @returns {Array<object>} List of runs
 */
function listRuns(service, projectId) {
  const runs = Array.from(service.runs.values());
  if (projectId) {
    return runs.filter(r => r.projectId === projectId);
  }
  return runs.sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = {
  createExecutionRunService,
};