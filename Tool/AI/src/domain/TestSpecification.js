/**
 * TestSpecification
 *
 * Canonical model representing what QA will test.
 * Contains both human-readable and technical information.
 * Designed to be convertible to dependency-aware execution later.
 */

/**
 * Create a TestSpecification from input.
 * @param {{
 *   id?: string,
 *   title?: string,
 *   description?: string,
 *   method?: string,
 *   path?: string,
 *   requirementRefs?: Array<{ acIndex?: number, acText?: string }>,
 *   operationRefs?: Array<{ serviceId?: string, operationId?: string, endpointId?: string, method?: string, path?: string }>,
 *   prerequisites?: Array<{ serviceId?: string, operationId?: string }>,
 *   testData?: { pathParams?: Object, queryParams?: Object, headers?: Object, body?: Object },
 *   expectedBehavior?: { status?: number, responseAssertions?: string[] },
 *   assertions?: string[]
 * }} input
 * @returns {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   method?: string,
 *   path?: string,
 *   requirementRefs: Array,
 *   operationRefs: Array,
 *   prerequisites: Array,
 *   testData: Object,
 *   expectedBehavior: Object,
 *   assertions: string[]
 * }}
 */
function createTestSpecification(input = {}) {
  // Generate deterministic ID if not provided
  const id = input.id 
    ? String(input.id).trim() 
    : `spec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Description: Use provided or generate deterministic fallback
  const description = input.description 
    ? String(input.description).trim() 
    : generateFallbackDescription(input);

  // Default title if not provided
  const title = input.title 
    ? String(input.title).trim() 
    : "Unlabeled Test";

  return {
    id,
    title,
    description,
    method: input.method ? String(input.method).toUpperCase() : undefined,
    path: input.path ? String(input.path).trim() : undefined,
    requirementRefs: normalizeRequirementRefs(input.requirementRefs),
    operationRefs: normalizeOperationRefs(input.operationRefs),
    prerequisites: normalizePrerequisites(input.prerequisites),
    testData: {
      pathParams: input.testData?.pathParams || {},
      queryParams: input.testData?.queryParams || {},
      headers: input.testData?.headers || {},
      body: input.testData?.body || {},
    },
    expectedBehavior: {
      status: input.expectedBehavior?.status ?? input.expectedStatus ?? 200,
      responseAssertions: input.expectedBehavior?.responseAssertions || input.assertions || [],
    },
    assertions: input.assertions || input.expectedBehavior?.responseAssertions || [],
  };
}

/**
 * Generate a deterministic fallback description based on available data.
 */
function generateFallbackDescription(input) {
  const { method, path, type } = input;
  const typeDesc = getTestTypeDescription(type);
  
  if (method && path) {
    return `${typeDesc} ${String(method).toUpperCase()} ${path}`;
  }
  
  if (path) {
    return `${typeDesc} the API endpoint ${path}`;
  }
  
  return typeDesc || "Verify API behavior as specified in requirements";
}

/**
 * Get human-readable description for test type.
 */
function getTestTypeDescription(type) {
  const map = {
    positive: "Verify successful behavior",
    negative: "Verify validation error handling",
    validation: "Verify constraint violation is rejected",
    edge: "Verify boundary value handling",
    security: "Verify authorization requirement",
    functional: "Verify functional behavior",
  };
  return map[type] || "Verify";
}

/**
 * Normalize requirement references.
 */
function normalizeRequirementRefs(refs) {
  if (!Array.isArray(refs)) return [];
  return refs.map((ref) => ({
    acIndex: ref.acIndex ?? -1,
    acText: ref.acText ? String(ref.acText) : undefined,
  })).filter((ref) => ref.acIndex >= 0 || ref.acText);
}

/**
 * Normalize operation references.
 */
function normalizeOperationRefs(refs) {
  if (!Array.isArray(refs)) return [];
  return refs.map((ref) => ({
    serviceId: ref.serviceId ? String(ref.serviceId).trim() : undefined,
    operationId: ref.operationId ? String(ref.operationId).trim() : undefined,
    endpointId: ref.endpointId ? String(ref.endpointId).trim() : undefined,
    method: ref.method ? String(ref.method).toUpperCase() : undefined,
    path: ref.path ? String(ref.path).trim() : undefined,
  }));
}

/**
 * Normalize prerequisites.
 */
function normalizePrerequisites(prereqs) {
  if (!Array.isArray(prereqs)) return [];
  return prereqs.map((prereq) => ({
    serviceId: prereq.serviceId ? String(prereq.serviceId).trim() : undefined,
    operationId: prereq.operationId ? String(prereq.operationId).trim() : undefined,
  }));
}

module.exports = {
  createTestSpecification,
};