/**
 * V2 Scenario Adapter
 * 
 * STEP 10.4: Maps grounded V2 test cases to production Scenario model.
 */

function createGenerationId() {
  return `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mapV2ToScenario(tc, contract) {
  const grounding = tc.grounding || {};
  const proposed = tc.proposedOperation || {};
  
  // Find contract endpoint
  const contractEndpoint = grounding.contractEndpointId 
    ? (contract.endpoints || []).find(e => e.id === grounding.contractEndpointId)
    : null;

  // Determine executability
  const isRunnable = 
    grounding.mappingStatus === "LINKED" && 
    tc.dataReadiness === "READY";

  return {
    id: `scn-${createGenerationId()}-${Math.random().toString(36).slice(2, 6)}`,
    title: tc.title || "Untitled",
    description: tc.description || "",
    type: mapTypeToCategory(tc.type),
    endpointId: grounding.contractEndpointId || null,
    method: grounding.method || proposed.method || "GET",
    path: contractEndpoint?.path || proposed.path || "/",
    pathParams: tc.testData?.pathParams || {},
    queryParams: tc.testData?.queryParams || {},
    headers: tc.testData?.headers || {},
    basePayload: tc.testData?.body || {},
    expectedStatus: tc.expected?.status || 200,
    assertions: tc.expected?.responseAssertions || [],
    acIndex: tc.sourceAcIndex ?? -1,
    risk: tc.confidence === "HIGH" ? "low" : tc.confidence === "MEDIUM" ? "medium" : "high",
    generationSource: "ai_v2",
    generationMode: "ai_v2",
    generationRunId: tc.generationRunId || createGenerationId(),
    testOrigin: tc.testOrigin || "AI_INFERENCE",
    confidence: tc.confidence || "MEDIUM",
    evidence: tc.evidence || [],
    grounding: grounding,
    dataReadiness: tc.dataReadiness || "READY",
    unlinked: grounding.mappingStatus !== "LINKED",
    validationStatus: isRunnable ? "VALID" : "VALID_WITH_WARNINGS",
    warning: tc.missingData ? `Missing: ${tc.missingData.join(", ")}` : undefined,
  };
}

function mapTypeToCategory(type) {
  const map = {
    POSITIVE: "functional",
    NEGATIVE: "validation",
    BOUNDARY: "edge",
    NOT_FOUND: "negative",
    AUTHORIZATION: "security",
    EDGE: "edge",
  };
  return map[type] || "functional";
}

function adaptV2TestsToScenarios(groundedTests, contract) {
  return groundedTests.map((tc) => mapV2ToScenario(tc, contract));
}

module.exports = {
  adaptV2TestsToScenarios,
  createGenerationId,
};