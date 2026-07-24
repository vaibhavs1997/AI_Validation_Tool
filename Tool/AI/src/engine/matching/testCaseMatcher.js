/**
 * TestCaseMatcher
 *
 * STEP 5.5D — Adapter that bridges canonical TestCase objects to the
 * existing matching engine (src/engine/matching/matchingEngine.js).
 *
 * Responsibilities:
 *   1. Load registered services/API models for a project
 *   2. Convert canonical TestCases to the format expected by extractIntent
 *   3. Convert API model operations to endpoints (with unique IDs)
 *   4. Call matchTestCases from the existing engine
 *   5. Convert results to the STEP 5.5D response shape
 *
 * Architecture rules:
 *   - NEVER mutates canonical TestCase objects
 *   - NEVER deletes/drops a TestCase because no API matches
 *   - NEVER generates new TestCases
 *   - Does NOT call AI — uses deterministic matching only
 *   - Returns one match result for EVERY input TestCase
 */

const { matchTestCases } = require("./matchingEngine");
const { listServices, getApiModel } = require("../../domain/ServiceRepository");

/**
 * Convert a canonical TestCase to the shape expected by extractIntent.
 * Does NOT mutate the original TestCase — returns a new object.
 */
function adaptTestCase(tc) {
  // Derive sourceAc from the first requirement reference
  const sourceAc = (tc.requirementRefs && tc.requirementRefs[0] && tc.requirementRefs[0].acText)
    ? tc.requirementRefs[0].acText
    : "";

  // Derive mutations from testData.body fields (helps field-overlap signals)
  const mutations = [];
  if (tc.testData && tc.testData.body && typeof tc.testData.body === "object") {
    for (const key of Object.keys(tc.testData.body)) {
      mutations.push({ field: key, operation: "replace" });
    }
  }

  return {
    id: tc.id,
    title: tc.title || "",
    description: tc.description || "",
    type: tc.type || "functional",
    sourceAc,
    assertions: tc.assertions || [],
    traceability: {
      sourceText: tc.description || sourceAc || tc.title || "",
    },
    mutations,
    // expectedMethod is intentionally NOT set — let the engine infer from text
  };
}

/**
 * Convert API model operations to endpoints with unique IDs.
 * Each endpoint ID is prefixed with the service ID to avoid collisions.
 */
function buildEndpoints(services, apiModels) {
  const endpoints = [];
  const endpointMap = new Map(); // endpointId → { serviceId, operationId, method, path }

  for (const service of services) {
    const apiModel = apiModels.find((m) => m.serviceId === service.id || m.service?.id === service.id);
    if (!apiModel) continue;

    const serviceId = service.id;
    const operations = apiModel.operations || [];

    for (const op of operations) {
      const operationId = op.id || op.operationName || "";
      if (!operationId) continue;

      const endpointId = `${serviceId}:${operationId}`;

      const endpoint = {
        id: endpointId,
        serviceId,
        operationId,
        method: (op.method || "GET").toUpperCase(),
        path: op.path || "",
        summary: op.summary || "",
        description: op.description || "",
        parameters: op.parameters || [],
        requestSchema: op.requestSchema || {},
        responses: op.responses || {},
        tags: op.tags || [],
      };

      endpoints.push(endpoint);
      endpointMap.set(endpointId, {
        serviceId,
        operationId,
        method: endpoint.method,
        path: endpoint.path,
      });
    }
  }

  return { endpoints, endpointMap };
}

/**
 * Determine match status from the assignment.
 *   matched   — resolved endpoint, not ambiguous
 *   ambiguous — top candidates too close
 *   unmatched — no credible candidate
 */
function determineStatus(assignment) {
  if (assignment.ambiguous) return "ambiguous";
  if (assignment.endpointId) return "matched";
  return "unmatched";
}

/**
 * Convert a CandidateScore to the response candidate shape.
 */
function convertCandidate(candidate, endpointMap) {
  const info = endpointMap.get(candidate.endpointId) || {};
  const reasons = [];

  // Collect signal explanations
  if (candidate.signals && candidate.signals.length > 0) {
    for (const sig of candidate.signals) {
      if (sig.score > 0 && sig.explanation) {
        reasons.push(`${sig.name}: ${sig.explanation}`);
      }
    }
  }

  // Add conflict reasons
  if (candidate.hasHardConflict && candidate.conflictReasons && candidate.conflictReasons.length > 0) {
    reasons.push(...candidate.conflictReasons.map((r) => `Conflict: ${r}`));
  }

  return {
    serviceId: info.serviceId || null,
    operationId: info.operationId || candidate.endpointId,
    method: info.method || null,
    path: info.path || null,
    confidence: Math.round((candidate.totalScore || 0) * 100),
    reasons: reasons.slice(0, 10), // cap for readability
  };
}

/**
 * Main entry: match canonical TestCases against registered project APIs.
 *
 * @param {Object} options
 * @param {string} options.projectId
 * @param {Array} options.testCases — canonical TestCase objects
 * @returns {Object} { projectId, matches, diagnostics, warnings }
 */
function isPromise(value) {
  return Boolean(value && typeof value.then === "function");
}

function buildMatchResponse(projectId, testCases, services, apiModels) {
  const warnings = [];

  if (services.length === 0) {
    warnings.push("No registered services found for this project.");
  }

  // Build endpoints from API models
  const { endpoints, endpointMap } = buildEndpoints(services, apiModels);

  if (endpoints.length === 0) {
    warnings.push("No API operations found in registered services.");
  }

  // Adapt canonical TestCases to the format expected by the matching engine
  const adaptedTestCases = testCases.map(adaptTestCase);

  // Call the existing matching engine
  const { scenarioAssignments } = matchTestCases(adaptedTestCases, endpoints, {
    maxCandidates: 20,
  });

  // Convert results to the STEP 5.5D response shape
  const matches = [];
  let matched = 0;
  let ambiguous = 0;
  let unmatched = 0;

  for (const tc of testCases) {
    const assignment = scenarioAssignments.get(tc.id);

    if (!assignment) {
      // This should not happen — every test case should get an assignment
      matches.push({
        testCaseId: tc.id,
        status: "unmatched",
        selectedMatch: null,
        candidates: [],
      });
      unmatched++;
      continue;
    }

    const status = determineStatus(assignment);

    if (status === "matched") matched++;
    else if (status === "ambiguous") ambiguous++;
    else unmatched++;

    // Build selectedMatch from the resolved endpoint
    let selectedMatch = null;
    if (assignment.endpointId) {
      const info = endpointMap.get(assignment.endpointId);
      if (info) {
        selectedMatch = {
          serviceId: info.serviceId,
          operationId: info.operationId,
          method: info.method,
          path: info.path,
          confidence: Math.round((assignment.confidence || 0) * 100),
        };
      }
    }

    // Build candidates list from the match result
    const candidates = [];
    const matchResult = assignment.matchResult;
    if (matchResult && matchResult.candidates && matchResult.candidates.length > 0) {
      for (const cand of matchResult.candidates) {
        candidates.push(convertCandidate(cand, endpointMap));
      }
    }

    matches.push({
      testCaseId: tc.id,
      status,
      selectedMatch,
      candidates,
    });
  }

  return {
    projectId,
    matches,
    diagnostics: {
      total: testCases.length,
      matched,
      ambiguous,
      unmatched,
    },
    warnings,
  };
}

function matchTestCasesToApis({ projectId, testCases }) {
  const servicesMaybe = listServices(projectId);
  if (isPromise(servicesMaybe)) {
    return servicesMaybe
      .then((services) =>
        Promise.all(services.map((s) => getApiModel(projectId, s.id))).then((apiModels) =>
          buildMatchResponse(projectId, testCases, services, apiModels.filter(Boolean))
        )
      );
  }

  const services = servicesMaybe;
  const apiModels = services.map((s) => getApiModel(projectId, s.id)).filter(Boolean);
  return buildMatchResponse(projectId, testCases, services, apiModels);
}

module.exports = {
  matchTestCasesToApis,
  adaptTestCase,
  buildEndpoints,
  determineStatus,
  convertCandidate,
};
