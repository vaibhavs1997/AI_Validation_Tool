/**
 * Dependency-Aware Executor
 *
 * Executes TestSpecifications with ExecutionPlan support.
 * Uses shared HTTP executor for production-hardened request handling.
 */

const { 
  executeHttpRequest, 
  validateRequiredBindings,
  extractValueFromLocation,
  redactHeaders,
  redactSecretsFromObject 
} = require('./httpExecutor');
const { executePlan, STEP_STATUS } = require('./DependencyAwareOrchestrator');
const { createRuntimeContext, injectValue } = require('../domain/RuntimeContext');
const { validatePlan } = require('../domain/ExecutionPlan');

/**
 * Build HTTP request from TestSpecification and ExecutionPlan step.
 */
function buildHttpRequest(spec, step, apiModels, context) {
  const request = {
    method: null,
    path: null,
    baseUrl: null,
    headers: { ...spec.testData.headers },
    queryParams: { ...spec.testData.queryParams },
    body: spec.testData.body ? { ...spec.testData.body } : null,
    pathParams: { ...spec.testData.pathParams },
  };

  // Resolve operation details from step
  const op = step.operation;
  request.method = op.method || spec.method || 'GET';
  request.path = op.path || spec.path || '/';

  // Find baseUrl from apiModels
  const apiModel = apiModels.find((m) => m.service?.id === op.serviceId);
  if (apiModel) {
    request.baseUrl = apiModel.baseUrl || 'http://localhost';
  }

  // Build full URL
  let url = request.baseUrl || 'http://localhost';
  for (const [key, value] of Object.entries(request.pathParams || {})) {
    url = url.replace(`{${key}}`, value);
  }
  url = url.replace(/{[^}]+}/g, '');
  if (request.path) {
    url = url.replace(/\/$/, '') + request.path;
  }

  // Add query params
  if (request.queryParams && Object.keys(request.queryParams).length > 0) {
    const qs = new URLSearchParams(request.queryParams).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }

  request.url = url;
  return request;
}

/**
 * Execute a single TestSpecification with its ExecutionPlan.
 */
async function executeTestSpecification(spec, plan, apiModels, options = {}) {
  const { executor, dryRun = false, environment = {} } = options;

  if (!plan || !validatePlan(plan)) {
    return {
      specId: spec.id,
      spec: { title: spec.title, description: spec.description },
      results: [],
      errors: plan?.errors || ['No valid execution plan'],
      success: false,
    };
  }

  const context = createRuntimeContext();
  const results = [];

  // Execute each step in plan order
  for (const step of plan.steps) {
    const op = step.operation;
    const opKey = `${op.serviceId}::${op.operationId}`;

    // Check prerequisites
    const failedPrereq = step.prerequisites?.find((p) => {
      const result = results.find((r) => 
        r.operation?.serviceId === p.serviceId && 
        r.operation?.operationId === p.operationId &&
        r.status !== 'passed'
      );
      return result;
    });

    if (failedPrereq) {
      results.push({
        step: step.order,
        operation: op,
        status: 'blocked',
        error: `Blocked due to failed prerequisite: ${failedPrereq.serviceId}/${failedPrereq.operationId}`,
      });
      continue;
    }

    // Validate required bindings exist before proceeding
    const bindingCheck = validateRequiredBindings(step.bindings || [], context.responses);
    if (bindingCheck) {
      results.push({
        step: step.order,
        operation: op,
        status: 'blocked',
        error: `Missing required dependency values: ${bindingCheck.join(', ')}`,
      });
      continue;
    }

    // Apply bindings to build request
    for (const binding of step.bindings || []) {
      const sourceResponse = context.responses.get(`${binding.from?.serviceId}::${binding.from?.operationId}`);
      if (sourceResponse) {
        const value = extractValueFromLocation(sourceResponse, binding.source?.location || binding.from?.location);
        if (value !== undefined) {
          const transformed = binding.relationship?.transform?.replace(/\{\{value\}\}/gi, String(value)) || String(value);
          // Store binding for context
          context.addBinding({
            relationship: binding.relationship,
            from: binding.source || binding.from,
            to: binding.target || binding.to,
          });
        }
      }
    }

    // Build request
    const request = buildHttpRequest(spec, step, apiModels, context);

    // Execute using shared HTTP executor
    const stepResult = await executeHttpRequest(request, {
      dryRun,
      variables: environment.variables,
      endpoint: op,
      scenario: { expectedStatus: spec.expectedBehavior?.status },
    });

    // Store response for downstream steps
    if (stepResult.response) {
      context.setResponse(opKey, stepResult.response);
    }

    results.push({
      step: step.order,
      operation: op,
      status: stepResult.status,
      response: stepResult.response,
      error: stepResult.error,
      request: stepResult.request,
      validation: stepResult.validation,
    });
  }

  return {
    specId: spec.id,
    spec: { title: spec.title, description: spec.description },
    results,
    errors: results.filter((r) => r.status !== 'passed').map((r) => r.error).filter(Boolean),
    success: results.every((r) => r.status === 'passed'),
  };
}

/**
 * Execute multiple TestSpecifications with their plans.
 */
async function executePlannedTests(specs, plans, apiModels, options = {}) {
  const results = [];

  for (const spec of specs) {
    const plan = plans[spec.id];
    
    // If no plan, create one from spec's method/path
    if (!plan) {
      const operation = {
        serviceId: 'default-service',
        operationId: `${spec.method} ${spec.path}`,
        method: spec.method,
        path: spec.path
      };
      const result = await executeTestSpecification(spec, { 
        steps: [{ order: 0, operation, prerequisites: [] }], 
        isValid: true,
        errors: [] 
      }, apiModels, options);
      results.push(result);
      continue;
    }

    const specResult = await executeTestSpecification(spec, plan, apiModels, options);
    results.push(specResult);
  }

  return {
    results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    },
  };
}

module.exports = {
  executeTestSpecification,
  executePlannedTests,
  buildHttpRequest,
  STEP_STATUS,
};