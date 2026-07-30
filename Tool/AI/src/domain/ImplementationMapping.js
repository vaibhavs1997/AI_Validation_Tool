/**
 * ImplementationMapping
 *
 * Domain model for mapping validation scenarios to API implementations.
 */

const VALID_STATUSES = Object.freeze(['draft', 'needs-review', 'ready', 'approved', 'rejected']);
const VALID_EXECUTION_ORDERS = Object.freeze(['sequential', 'parallel']);

/**
 * @param {{
 *   id?: string,
 *   projectId: string,
 *   scenarioId: string,
 *   requirementId?: string,
 *   title?: string,
 *   description?: string,
 *   candidateApis?: Array<{ serviceId?: string; operationId?: string; method?: string; path?: string }>,
 *   executionOrder?: string,
 *   authenticationRequired?: boolean,
 *   authenticationDetails?: string,
 *   requestDependencies?: string[],
 *   variablesRequired?: string[],
 *   executionFlow?: Array<{ step: number; description: string; operationRef?: { serviceId?: string; operationId?: string } }>,
 *   confidence?: number,
 *   reasoning?: string,
 *   status?: string,
 *   source?: 'manual' | 'ai-generated',
 *   createdAt?: Date|string,
 *   updatedAt?: Date|string,
 * }} input
 * @returns {object}
 */
function createImplementationMapping(input = {}) {
  if (!input || typeof input.projectId !== 'string' || input.projectId.trim().length === 0) {
    throw new Error('ImplementationMapping projectId must be a non-empty string.');
  }

  if (!input || typeof input.scenarioId !== 'string' || input.scenarioId.trim().length === 0) {
    throw new Error('ImplementationMapping scenarioId must be a non-empty string.');
  }

  const id = input.id || `mapping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();

  const status = String(input.status || 'draft').toLowerCase();
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`ImplementationMapping status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const executionOrder = String(input.executionOrder || 'sequential').toLowerCase();
  if (!VALID_EXECUTION_ORDERS.includes(executionOrder)) {
    throw new Error(`ImplementationMapping executionOrder must be one of: ${VALID_EXECUTION_ORDERS.join(', ')}`);
  }

  const confidence = Number(input.confidence);
  const safeConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5;

  return {
    id,
    projectId: input.projectId.trim(),
    scenarioId: input.scenarioId.trim(),
    requirementId: input.requirementId ? String(input.requirementId).trim() : null,
    title: input.title ? String(input.title).trim() : 'Untitled Mapping',
    description: input.description ? String(input.description).trim() : '',
    candidateApis: Array.isArray(input.candidateApis) ? input.candidateApis.map((api) => ({
      serviceId: api.serviceId ? String(api.serviceId).trim() : undefined,
      operationId: api.operationId ? String(api.operationId).trim() : undefined,
      method: api.method ? String(api.method).trim().toUpperCase() : undefined,
      path: api.path ? String(api.path).trim() : undefined,
    })) : [],
    executionOrder,
    authenticationRequired: Boolean(input.authenticationRequired),
    authenticationDetails: input.authenticationDetails ? String(input.authenticationDetails).trim() : '',
    requestDependencies: Array.isArray(input.requestDependencies) ? input.requestDependencies.map(String) : [],
    variablesRequired: Array.isArray(input.variablesRequired) ? input.variablesRequired.map(String) : [],
    executionFlow: Array.isArray(input.executionFlow) ? input.executionFlow.map((step) => ({
      step: Number(step.step) || 0,
      description: String(step.description || '').trim(),
      operationRef: step.operationRef ? {
        serviceId: step.operationRef.serviceId ? String(step.operationRef.serviceId).trim() : undefined,
        operationId: step.operationRef.operationId ? String(step.operationRef.operationId).trim() : undefined,
      } : undefined,
    })) : [],
    confidence: safeConfidence,
    reasoning: input.reasoning ? String(input.reasoning).trim() : '',
    status,
    source: input.source ? String(input.source).toLowerCase() : 'manual',
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt instanceof Date ? new Date(input.updatedAt) : now,
  };
}

function validateMappingReadiness(mapping) {
  if (!mapping) {
    return {
      valid: false,
      checks: [
        { field: 'description', passed: false, message: 'Description is required.' },
        { field: 'candidateApis', passed: false, message: 'At least one candidate API is required.' },
        { field: 'executionFlow', passed: false, message: 'Execution flow is required.' },
      ],
    };
  }

  const checks = [
    {
      field: 'description',
      passed: Boolean(mapping.description && mapping.description.trim().length > 0),
      message: 'Description is required.',
    },
    {
      field: 'candidateApis',
      passed: Array.isArray(mapping.candidateApis) && mapping.candidateApis.length > 0,
      message: 'At least one candidate API is required.',
    },
    {
      field: 'executionFlow',
      passed: Array.isArray(mapping.executionFlow) && mapping.executionFlow.length > 0,
      message: 'Execution flow is required.',
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
  createImplementationMapping,
  validateMappingReadiness,
  VALID_STATUSES,
  VALID_EXECUTION_ORDERS,
};