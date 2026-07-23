/**
 * TestCase
 *
 * Canonical model representing a generated test case before API matching.
 * Contains what QA should test — not where it will execute.
 *
 * Rule: TestCase must NOT contain:
 *   - serviceId
 *   - operationId
 *   - endpointId
 *   - method
 *   - path
 *   - ExecutionPlan
 *   - proposedOperation
 */

function createTestCase(input = {}) {
  const id = input.id
    ? String(input.id).trim()
    : `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const title = input.title
    ? String(input.title).trim()
    : "Untitled Test";

  const description = input.description
    ? String(input.description).trim()
    : "";

  const type = input.type || "functional";

  const requirementRefs = normalizeRequirementRefs(input.requirementRefs);

  const testData = {
    pathParams: input.testData?.pathParams || {},
    queryParams: input.testData?.queryParams || {},
    headers: input.testData?.headers || {},
    body: input.testData?.body || {},
  };

  const expectedBehavior = {
    status: input.expectedBehavior?.status ?? input.expectedStatus ?? 200,
    responseAssertions:
      input.expectedBehavior?.responseAssertions || input.assertions || [],
  };

  const assertions = input.assertions || input.expectedBehavior?.responseAssertions || [];

  return {
    id,
    title,
    description,
    type,
    requirementRefs,
    testData,
    expectedBehavior,
    assertions,
  };
}

function normalizeRequirementRefs(refs) {
  if (!Array.isArray(refs)) return [];
  return refs
    .map((ref) => ({
      acIndex: ref.acIndex ?? -1,
      acText: ref.acText ? String(ref.acText).trim() : undefined,
    }))
    .filter((ref) => ref.acIndex >= 0 || ref.acText);
}

module.exports = {
  createTestCase,
};
