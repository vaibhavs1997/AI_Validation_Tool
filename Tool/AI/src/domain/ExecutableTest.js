/**
 * ExecutableTest
 *
 * Domain model for executable API test cases generated from approved implementation mappings.
 */

const VALID_STATUSES = Object.freeze(['draft', 'needs-review', 'ready', 'approved', 'rejected']);
const VALID_PRIORITIES = Object.freeze(['low', 'medium', 'high', 'critical']);

/**
 * @param {{
 *   id?: string,
 *   projectId: string,
 *   mappingId?: string,
 *   scenarioId?: string,
 *   requirementId?: string,
 *   title?: string,
 *   description?: string,
 *   scenario?: string,
 *   mappedApis?: Array<{ serviceId?: string; operationId?: string; method?: string; path?: string }>,
 *   executionSteps?: Array<{ step: number; description: string; operationRef?: { serviceId?: string; operationId?: string }; headers?: Record<string, string>; body?: any }>,
 *   headers?: Record<string, string>,
 *   variables?: Record<string, string>,
 *   requestBody?: any,
 *   assertions?: Array<{ type: string; field?: string; expected?: any; operator?: string }>,
 *   expectedStatusCode?: number,
 *   expectedResponse?: any,
 *   dependencies?: string[],
 *   priority?: string,
 *   confidence?: number,
 *   status?: string,
 *   source?: 'manual' | 'ai-generated',
 *   createdAt?: Date|string,
 *   updatedAt?: Date|string,
 * }} input
 * @returns {object}
 */
function createExecutableTest(input = {}) {
  if (!input || typeof input.projectId !== 'string' || input.projectId.trim().length === 0) {
    throw new Error('ExecutableTest projectId must be a non-empty string.');
  }

  const id = input.id || `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const status = String(input.status || 'draft').toLowerCase();
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`ExecutableTest status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const priority = String(input.priority || 'medium').toLowerCase();
  if (!VALID_PRIORITIES.includes(priority)) {
    throw new Error(`ExecutableTest priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  const confidence = Number(input.confidence);
  const safeConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5;

  const expectedStatusCode = Number(input.expectedStatusCode);
  const safeStatusCode = Number.isFinite(expectedStatusCode) ? expectedStatusCode : 200;

  return {
    id,
    projectId: input.projectId.trim(),
    mappingId: input.mappingId ? String(input.mappingId).trim() : null,
    scenarioId: input.scenarioId ? String(input.scenarioId).trim() : null,
    requirementId: input.requirementId ? String(input.requirementId).trim() : null,
    title: input.title ? String(input.title).trim() : 'Untitled Test',
    description: input.description ? String(input.description).trim() : '',
    scenario: input.scenario ? String(input.scenario).trim() : '',
    mappedApis: Array.isArray(input.mappedApis) ? input.mappedApis.map((api) => ({
      serviceId: api.serviceId ? String(api.serviceId).trim() : undefined,
      operationId: api.operationId ? String(api.operationId).trim() : undefined,
      method: api.method ? String(api.method).trim().toUpperCase() : undefined,
      path: api.path ? String(api.path).trim() : undefined,
    })) : [],
    executionSteps: Array.isArray(input.executionSteps) ? input.executionSteps.map((step) => ({
      step: Number(step.step) || 0,
      description: String(step.description || '').trim(),
      operationRef: step.operationRef ? {
        serviceId: step.operationRef.serviceId ? String(step.operationRef.serviceId).trim() : undefined,
        operationId: step.operationRef.operationId ? String(step.operationRef.operationId).trim() : undefined,
      } : undefined,
      headers: step.headers && typeof step.headers === 'object' ? step.headers : {},
      body: step.body !== undefined ? step.body : null,
    })) : [],
    headers: input.headers && typeof input.headers === 'object' ? input.headers : {},
    variables: input.variables && typeof input.variables === 'object' ? input.variables : {},
    requestBody: input.requestBody !== undefined ? input.requestBody : null,
    assertions: Array.isArray(input.assertions) ? input.assertions.map((a) => ({
      type: String(a.type || 'status').trim(),
      field: a.field ? String(a.field).trim() : undefined,
      expected: a.expected !== undefined ? a.expected : undefined,
      operator: a.operator ? String(a.operator).trim() : undefined,
    })) : [],
    expectedStatusCode: safeStatusCode,
    expectedResponse: input.expectedResponse !== undefined ? input.expectedResponse : null,
    dependencies: Array.isArray(input.dependencies) ? input.dependencies.map(String) : [],
    priority,
    confidence: safeConfidence,
    status,
    source: input.source ? String(input.source).toLowerCase() : 'manual',
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt instanceof Date ? new Date(input.updatedAt) : now,
  };
}

function validateTestReadiness(test) {
  if (!test) {
    return {
      valid: false,
      checks: [
        { field: 'description', passed: false, message: 'Description is required.' },
        { field: 'executionSteps', passed: false, message: 'Execution steps are required.' },
        { field: 'assertions', passed: false, message: 'Assertions are required.' },
      ],
    };
  }

  const checks = [
    {
      field: 'description',
      passed: Boolean(test.description && test.description.trim().length > 0),
      message: 'Description is required.',
    },
    {
      field: 'executionSteps',
      passed: Array.isArray(test.executionSteps) && test.executionSteps.length > 0,
      message: 'Execution steps are required.',
    },
    {
      field: 'assertions',
      passed: Array.isArray(test.assertions) && test.assertions.length > 0,
      message: 'Assertions are required.',
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
  createExecutableTest,
  validateTestReadiness,
  VALID_STATUSES,
  VALID_PRIORITIES,
};