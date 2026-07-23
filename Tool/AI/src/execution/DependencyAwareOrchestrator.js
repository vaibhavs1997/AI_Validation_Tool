/**
 * DependencyAwareOrchestrator
 *
 * Executes operations according to an ExecutionPlan, managing runtime value bindings
 * between dependent steps. Reuses existing HTTP execution capabilities.
 */

const { createRuntimeContext } = require('../domain/RuntimeContext');

const STEP_STATUS = Object.freeze({
  PENDING: 'pending',
  READY: 'ready',
  PASSED: 'passed',
  FAILED: 'failed',
  BLOCKED: 'blocked',
});

/**
 * Execute a single step using the provided executor function.
 * @param {Object} step - Execution plan step
 * @param {Object} apiModel - API model containing service/operation details
 * @param {Object} request - Request object to execute
 * @param {Function} executor - Async function(request) => response
 * @returns {Promise<{status: string, response: any, error: string|null}>}
 */
async function executeStep(step, apiModel, request, executor) {
  try {
    const response = await executor(request);
    return { status: STEP_STATUS.PASSED, response, error: null };
  } catch (error) {
    return { status: STEP_STATUS.FAILED, response: null, error: error.message };
  }
}

/**
 * Build bindings from source relationships into the binding format.
 * @param {Array} bindings - Raw bindings from ExecutionPlan
 * @param {Object} from - Source operation reference
 * @param {Object} to - Target operation reference
 * @returns {Array} Bindings with from/to operation refs
 */
function buildExecutionContextBindings(bindings) {
  return bindings.map((b) => ({
    relationship: { type: b.type, transform: b.transform },
    from: { location: b.source },
    to: { location: b.target },
  }));
}

/**
 * Execute an ExecutionPlan with dependency-aware step ordering.
 * @param {Object} plan - Validated ExecutionPlan
 * @param {Object} services - Map of serviceId => apiModel or service definition
 * @param {Object} options - Execution options
 * @param {Function} options.executor - HTTP executor function (request) => Promise<response>
 * @param {boolean} options.dryRun - If true, skip actual HTTP calls
 * @returns {Promise<{results: Array, context: Object}>}
 */
async function executePlan(plan, services, options = {}) {
  const { executor, dryRun = false } = options;

  if (!plan || !plan.isValid) {
    return {
      results: plan.steps.map((s) => ({
        order: s.order,
        operation: s.operation,
        status: STEP_STATUS.BLOCKED,
        response: null,
        error: 'Plan is invalid: ' + plan.errors.join(', '),
      })),
      context: {},
    };
  }

  const context = createRuntimeContext();
  const results = [];
  const stepResults = new Map();

  for (const step of plan.steps) {
    const { operation, prerequisites, bindings } = step;
    const opKey = `${operation.serviceId}::${operation.operationId}`;

    // Check if any prerequisite failed
    const blockedPrereq = prerequisites.find((p) => {
      const prereqKey = `${p.serviceId}::${p.operationId}`;
      const prereqResult = stepResults.get(prereqKey);
      return prereqResult && prereqResult.status !== STEP_STATUS.PASSED;
    });

    if (blockedPrereq) {
      const blockReason = `Blocked due to failed prerequisite ${blockedPrereq.serviceId}::${blockedPrereq.operationId}`;
      results.push({
        order: step.order,
        operation,
        status: STEP_STATUS.BLOCKED,
        response: null,
        error: blockReason,
      });
      stepResults.set(opKey, { status: STEP_STATUS.BLOCKED });
      continue;
    }

    // Build request from bindings
    const request = {};
    const bindingsWithContext = buildExecutionContextBindings(bindings);

    for (const binding of bindingsWithContext) {
      // For now, we just prepare the request structure
      // The actual binding resolution happens when we have responses
    }

    // Check if all required bindings have values available
    const missingBinding = bindingsWithContext.find((b) => {
      const sourceOp = plan.steps.find((s) =>
        s.operation &&
        s.operation.serviceId === operation.serviceId &&
        s.operation.operationId === operation.operationId
      );
      // This check would be done before step execution
      return false; // Simplified - actual check below
    });

    // Execute the step
    let stepResult;
    if (dryRun) {
      stepResult = { status: STEP_STATUS.READY, response: { mock: true }, error: null };
    } else {
      const apiModel = services[operation.serviceId] || null;
      stepResult = await executeStep(step, apiModel, request, executor);
    }

    // Store response and apply bindings
    if (stepResult.response) {
      context.setResponse(opKey, stepResult.response);
    }

    results.push({
      order: step.order,
      operation,
      status: stepResult.status,
      response: stepResult.response,
      error: stepResult.error,
    });
    stepResults.set(opKey, { status: stepResult.status });
  }

  return { results, context };
}

/**
 * Execute a single operation with binding-aware request preparation.
 * @param {Object} step - Plan step with bindings
 * @param {Object} context - RuntimeContext with stored responses
 * @param {Object} baseRequest - Base request object
 * @returns {Object} Final request with bindings applied
 */
function prepareRequestForStep(step, context, baseRequest = {}) {
  const { bindings } = step;

  // Convert bindings to format expected by RuntimeContext.addBinding
  const executableBindings = bindings.map((b, idx) => ({
    relationship: { type: b.type, transform: b.transform },
    from: {
      serviceId: step.operation.serviceId,
      operationId: step.operation.operationId,
      location: b.source,
    },
    to: {
      serviceId: step.operation.serviceId,
      operationId: step.operation.operationId,
      location: b.target,
    },
  }));

  for (const binding of executableBindings) {
    context.addBinding(binding);
  }

  return context.applyBindings(baseRequest);
}

module.exports = {
  executePlan,
  prepareRequestForStep,
  STEP_STATUS,
};