/**
 * RequirementWorkflow
 *
 * Domain model for the Requirement Workflow object.
 * This object becomes the handoff between modules in the TestForge pipeline.
 *
 * Tracks the entire lifecycle of a requirement through:
 * 1. Requirement Input
 * 2. AI Analysis
 * 3. Test Case Generation
 * 4. API Matching
 * 5. Draft Validation Scenario Generation
 *
 * Maintains full traceability from requirement → acceptance criteria → test → API → scenario
 */

const VALID_STATUSES = Object.freeze([
  'in-progress',
  'ready-for-validation',
  'completed',
]);

const VALID_STEPS = Object.freeze([1, 2, 3, 4, 5]);

/**
 * Create a new RequirementWorkflow
 * @param {object} input
 * @param {string} input.workflowId
 * @param {string} input.projectId
 * @param {string} input.requirementId
 * @returns {object} workflow
 */
function createWorkflow(input = {}) {
  if (!input || typeof input.projectId !== 'string' || !input.projectId.trim()) {
    throw new Error('RequirementWorkflow projectId must be a non-empty string.');
  }
  if (!input || typeof input.requirementId !== 'string' || !input.requirementId.trim()) {
    throw new Error('RequirementWorkflow requirementId must be a non-empty string.');
  }

  const now = new Date().toISOString();
  const workflowId = input.workflowId || `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    workflowId,
    projectId: input.projectId.trim(),
    requirementId: input.requirementId.trim(),

    // Step 1: Requirement Input
    requirement: {
      title: input.requirement?.title || '',
      description: input.requirement?.description || '',
      acceptanceCriteria: Array.isArray(input.requirement?.acceptanceCriteria)
        ? input.requirement.acceptanceCriteria.map(String)
        : [],
      businessRules: Array.isArray(input.requirement?.businessRules)
        ? input.requirement.businessRules.map(String)
        : [],
      priority: ['low', 'medium', 'high', 'critical'].includes(input.requirement?.priority)
        ? input.requirement.priority
        : 'medium',
      labels: Array.isArray(input.requirement?.labels)
        ? input.requirement.labels.map(String)
        : [],
      epic: input.requirement?.epic || '',
      story: input.requirement?.story || '',
      dependencies: Array.isArray(input.requirement?.dependencies)
        ? input.requirement.dependencies.map(String)
        : [],
      risk: ['low', 'medium', 'high', 'critical'].includes(input.requirement?.risk)
        ? input.requirement.risk
        : 'medium',
      status: ['draft', 'needs-review', 'ready'].includes(input.requirement?.status)
        ? input.requirement.status
        : 'draft',
      source: ['manual', 'paste', 'upload', 'jira'].includes(input.requirement?.source)
        ? input.requirement.source
        : 'manual',
      fileName: input.requirement?.fileName || null,
    },

    // Step 2: AI Analysis
    analysis: {
      completed: Boolean(input.analysis?.completed),
      acceptanceCriteria: Array.isArray(input.analysis?.acceptanceCriteria)
        ? input.analysis.acceptanceCriteria.map(String)
        : [],
      businessRules: Array.isArray(input.analysis?.businessRules)
        ? input.analysis.businessRules.map(String)
        : [],
      positivePaths: Array.isArray(input.analysis?.positivePaths)
        ? input.analysis.positivePaths.map(String)
        : [],
      negativePaths: Array.isArray(input.analysis?.negativePaths)
        ? input.analysis.negativePaths.map(String)
        : [],
      edgeCases: Array.isArray(input.analysis?.edgeCases)
        ? input.analysis.edgeCases.map(String)
        : [],
      preconditions: Array.isArray(input.analysis?.preconditions)
        ? input.analysis.preconditions.map(String)
        : [],
      postconditions: Array.isArray(input.analysis?.postconditions)
        ? input.analysis.postconditions.map(String)
        : [],
      dependencies: Array.isArray(input.analysis?.dependencies)
        ? input.analysis.dependencies.map(String)
        : [],
      assumptions: Array.isArray(input.analysis?.assumptions)
        ? input.analysis.assumptions.map(String)
        : [],
      missingInformation: Array.isArray(input.analysis?.missingInformation)
        ? input.analysis.missingInformation.map(String)
        : [],
      ambiguities: Array.isArray(input.analysis?.ambiguities)
        ? input.analysis.ambiguities.map(String)
        : [],
      analyzedAt: input.analysis?.analyzedAt || null,
    },

    // Step 3: Generated Test Cases
    generatedTests: {
      completed: Boolean(input.generatedTests?.completed),
      testCases: Array.isArray(input.generatedTests?.testCases)
        ? input.generatedTests.testCases.map(normalizeTestCase)
        : [],
      generatedAt: input.generatedTests?.generatedAt || null,
    },

    // Step 3: User Selection
    selectedTests: {
      testCaseIds: Array.isArray(input.selectedTests?.testCaseIds)
        ? input.selectedTests.testCaseIds.map(String)
        : [],
      selectedAt: input.selectedTests?.selectedAt || null,
    },

    // Step 4: API Matching
    apiMatches: {
      completed: Boolean(input.apiMatches?.completed),
      matches: Array.isArray(input.apiMatches?.matches)
        ? input.apiMatches.matches.map(normalizeApiMatch)
        : [],
      matchedAt: input.apiMatches?.matchedAt || null,
    },

    // Step 4: Approved API Mappings
    approvedMappings: {
      completed: Boolean(input.approvedMappings?.completed),
      mappings: Array.isArray(input.approvedMappings?.mappings)
        ? input.approvedMappings.mappings.map(String)
        : [],
      approvedAt: input.approvedMappings?.approvedAt || null,
    },

    // Step 5: Draft Validation Scenarios
    draftValidationScenarioIds: Array.isArray(input.draftValidationScenarioIds)
      ? input.draftValidationScenarioIds.map(String)
      : [],
    scenariosGeneratedAt: input.scenariosGeneratedAt || null,

    // Workflow metadata
    status: VALID_STATUSES.includes(input.status) ? input.status : 'in-progress',
    currentStep: VALID_STEPS.includes(input.currentStep) ? input.currentStep : 1,
    startedAt: input.startedAt || now,
    updatedAt: now,
    completedAt: input.completedAt || null,

    // Audit trail
    auditHistory: Array.isArray(input.auditHistory)
      ? input.auditHistory.map(normalizeAuditEntry)
      : [],
  };
}

function normalizeTestCase(tc) {
  if (!tc || typeof tc !== 'object') return null;
  return {
    id: tc.id || `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: String(tc.title || ''),
    description: String(tc.description || ''),
    type: ['positive', 'negative'].includes(tc.type) ? tc.type : 'positive',
    priority: ['low', 'medium', 'high', 'critical'].includes(tc.priority) ? tc.priority : 'medium',
    acceptanceCriteriaRef: Array.isArray(tc.acceptanceCriteriaRef)
      ? tc.acceptanceCriteriaRef.map(String)
      : [],
    expectedResult: String(tc.expectedResult || ''),
    expectedStatusCode: tc.expectedStatusCode || null,
    tags: Array.isArray(tc.tags) ? tc.tags.map(String) : [],
    risk: ['low', 'medium', 'high'].includes(tc.risk) ? tc.risk : 'medium',
    confidenceScore: typeof tc.confidenceScore === 'number' ? Math.max(0, Math.min(1, tc.confidenceScore)) : null,
    approved: Boolean(tc.approved),
  };
}

function normalizeApiMatch(match) {
  if (!match || typeof match !== 'object') return null;
  return {
    testCaseId: String(match.testCaseId || ''),
    testCaseTitle: String(match.testCaseTitle || ''),
    matchedApi: match.matchedApi ? {
      serviceId: String(match.matchedApi.serviceId || ''),
      serviceName: String(match.matchedApi.serviceName || ''),
      operationId: String(match.matchedApi.operationId || ''),
      operationName: String(match.matchedApi.operationName || ''),
      method: String(match.matchedApi.method || ''),
      path: String(match.matchedApi.path || ''),
      authentication: String(match.matchedApi.authentication || ''),
      confidence: typeof match.matchedApi.confidence === 'number' ? match.matchedApi.confidence : 0,
    } : null,
    suggestedApi: match.suggestedApi ? {
      serviceId: String(match.suggestedApi.serviceId || ''),
      serviceName: String(match.suggestedApi.serviceName || ''),
      operationId: String(match.suggestedApi.operationId || ''),
      operationName: String(match.suggestedApi.operationName || ''),
      method: String(match.suggestedApi.method || ''),
      path: String(match.suggestedApi.path || ''),
      authentication: String(match.suggestedApi.authentication || ''),
      confidence: typeof match.suggestedApi.confidence === 'number' ? match.suggestedApi.confidence : 0,
    } : null,
    status: ['matched', 'review-required', 'unmatched'].includes(match.status) ? match.status : 'unmatched',
    authentication: String(match.authentication || ''),
    dependencies: Array.isArray(match.dependencies) ? match.dependencies.map(String) : [],
  };
}

function normalizeAuditEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return {
    action: String(entry.action || ''),
    timestamp: entry.timestamp || new Date().toISOString(),
    userId: String(entry.userId || 'system'),
    details: entry.details || {},
  };
}

/**
 * Add an audit entry to the workflow
 */
function addAuditEntry(workflow, action, details = {}) {
  if (!workflow) throw new Error('Workflow is required.');
  const entry = {
    action: String(action),
    timestamp: new Date().toISOString(),
    userId: 'system',
    details,
  };
  return {
    ...workflow,
    auditHistory: [...(workflow.auditHistory || []), entry],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update workflow to a specific step
 */
function advanceToStep(workflow, step) {
  if (!VALID_STEPS.includes(step)) {
    throw new Error(`Invalid step: ${step}. Must be one of: ${VALID_STEPS.join(', ')}`);
  }
  return addAuditEntry(workflow, 'step-advance', { from: workflow.currentStep, to: step });
}

/**
 * Mark workflow as ready for validation scenario generation
 */
function markReadyForValidation(workflow) {
  return addAuditEntry(
    {
      ...workflow,
      status: 'ready-for-validation',
      currentStep: 5,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    'ready-for-validation',
    { draftScenarioCount: (workflow.draftValidationScenarioIds || []).length }
  );
}

/**
 * Calculate readiness percentage for the workflow
 */
function calculateReadiness(workflow) {
  if (!workflow) return 0;

  const weights = {
    requirement: 20,
    analysis: 20,
    generatedTests: 20,
    apiMatches: 20,
    scenarios: 20,
  };

  let score = 0;

  // Requirement completeness
  const req = workflow.requirement || {};
  if (req.title && req.description) score += weights.requirement * 0.5;
  if (Array.isArray(req.acceptanceCriteria) && req.acceptanceCriteria.length > 0) score += weights.requirement * 0.5;

  // Analysis
  const analysis = workflow.analysis || {};
  if (analysis.completed) score += weights.analysis;

  // Generated Tests
  const tests = workflow.generatedTests || {};
  if (tests.completed && Array.isArray(tests.testCases) && tests.testCases.length > 0) score += weights.generatedTests;

  // API Matches
  const api = workflow.apiMatches || {};
  if (api.completed) score += weights.apiMatches;

  // Scenarios
  const scenarioIds = workflow.draftValidationScenarioIds || [];
  if (scenarioIds.length > 0) score += weights.scenarios;

  return score;
}

/**
 * Get coverage summary
 */
function getCoverageSummary(workflow) {
  if (!workflow) return {};

  const acCount = (workflow.analysis?.acceptanceCriteria || []).length;
  const testCount = (workflow.generatedTests?.testCases || []).length;
  const approvedCount = (workflow.generatedTests?.testCases || []).filter(t => t.approved).length;
  const matchedCount = (workflow.apiMatches?.matches || []).filter(m => m.status === 'matched').length;
  const totalMatches = (workflow.apiMatches?.matches || []).length;

  return {
    acceptanceCriteriaCount: acCount,
    generatedTestCount: testCount,
    approvedTestCount: approvedCount,
    matchedApiCount: matchedCount,
    totalApiMatches: totalMatches,
    readiness: calculateReadiness(workflow),
    confidence: workflow.analysis?.completed ? 0.85 : 0,
    status: workflow.status,
    currentStep: workflow.currentStep,
  };
}

module.exports = {
  createWorkflow,
  addAuditEntry,
  advanceToStep,
  markReadyForValidation,
  calculateReadiness,
  getCoverageSummary,
  VALID_STATUSES,
  VALID_STEPS,
};