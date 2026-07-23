/**
 * TestSpecification Bridge
 *
 * STEP 5.5E — Minimal bridge from confirmed TestCase/API mappings
 * to the EXISTING TestSpecification + ExecutionPlan architecture.
 */

const { createTestSpecification } = require("../domain/TestSpecification");
const { getProjectKnowledge } = require("../domain/ProjectKnowledgeRepository");
const { listServices, getApiModel } = require("../domain/ServiceRepository");
const { buildExecutionPlan, validatePlan } = require("../domain/ExecutionPlan");

function convertTestCaseToSpec(testCase, mapping) {
  const requirementRefs = (testCase.requirementRefs || []).map((ref) => ({
    acIndex: ref.acIndex ?? -1,
    acText: ref.acText || undefined,
  }));

  const operationRefs = [
    {
      serviceId: mapping.serviceId,
      operationId: mapping.operationId,
      method: mapping.method,
      path: mapping.path,
    },
  ];

  return createTestSpecification({
    id: testCase.id,
    title: testCase.title,
    description: testCase.description,
    requirementRefs,
    operationRefs,
    testData: {
      pathParams: testCase.testData?.pathParams || {},
      queryParams: testCase.testData?.queryParams || {},
      headers: testCase.testData?.headers || {},
      body: testCase.testData?.body || {},
    },
    expectedBehavior: {
      status: testCase.expectedBehavior?.status ?? 200,
      responseAssertions: testCase.expectedBehavior?.responseAssertions || testCase.assertions || [],
    },
    assertions: testCase.assertions || [],
    method: mapping.method,
    path: mapping.path,
    type: testCase.type,
  });
}

function findOperationInApis(serviceId, operationId, apiModels) {
  for (const model of apiModels) {
    const modelServiceId = model.service?.id || model.title;
    if (modelServiceId !== serviceId) continue;
    for (const op of model.operations || []) {
      if (op.id === operationId || op.operationName === operationId) {
        return { serviceId, operation: op };
      }
    }
  }
  return null;
}

function prepareTestSpecifications({ projectId, testCases = [], mappings = [] }) {
  const warnings = [];
  const diagnostics = {
    included: testCases.length,
    prepared: 0,
    unresolved: 0,
    plansBuilt: 0,
  };

  const mappingById = new Map();
  for (const m of mappings) {
    mappingById.set(m.testCaseId, m);
  }

  const services = listServices(projectId);
  const apiModels = services.map((s) => getApiModel(projectId, s.id)).filter(Boolean);
  const projectKnowledge = getProjectKnowledge(projectId);
  const confirmedRelationships = (projectKnowledge?.relationships || []).filter((rel) => rel.status === "confirmed");

  const testSpecifications = [];
  const plans = {};
  const unresolvedTestCases = [];

  for (const tc of testCases) {
    const mapping = mappingById.get(tc.id);
    if (!mapping) {
      unresolvedTestCases.push({
        testCaseId: tc.id,
        reason: "No confirmed API mapping",
      });
      diagnostics.unresolved++;
      continue;
    }

    const spec = convertTestCaseToSpec(tc, mapping);
    testSpecifications.push(spec);
    diagnostics.prepared++;

    const found = findOperationInApis(mapping.serviceId, mapping.operationId, apiModels);
    if (!found) {
      unresolvedTestCases.push({
        testCaseId: tc.id,
        reason: `Mapped operation not found: ${mapping.serviceId}::${mapping.operationId}`,
      });
      diagnostics.prepared--;
      diagnostics.unresolved++;
      continue;
    }

    const plan = buildExecutionPlan({
      targetServiceId: mapping.serviceId,
      targetOperationId: mapping.operationId,
      services,
      apiModels,
      relationships: confirmedRelationships,
    });

    // Executable only if plan exists, is valid, and has at least one step.
    const hasValidPlan = plan && validatePlan(plan) && Array.isArray(plan.steps) && plan.steps.length > 0;
    if (hasValidPlan) {
      plans[spec.id] = plan;
      if (plan.steps.length > 1) {
        diagnostics.plansBuilt++;
      }
    } else {
      const reason = !plan
        ? 'No execution plan returned'
        : !validatePlan(plan)
          ? `Invalid execution plan: ${plan.errors?.length ? plan.errors[0] : 'validation failed'}`
          : 'Execution plan has no executable steps';
      unresolvedTestCases.push({
        testCaseId: tc.id,
        reason,
      });
      diagnostics.prepared--;
      diagnostics.unresolved++;
    }
  }

  return {
    projectId,
    testSpecifications,
    plans,
    unresolvedTestCases,
    diagnostics,
    warnings,
  };
}

module.exports = {
  prepareTestSpecifications,
  convertTestCaseToSpec,
};