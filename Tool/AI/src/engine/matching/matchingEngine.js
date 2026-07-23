/**
 * MatchingEngine
 *
 * Full orchestration for test-case-to-API-endpoint matching.
 *
 * Pipeline:
 *   1. Build endpoint index from API catalog
 *   2. Group test cases into OperationContexts
 *   3. Extract TargetIntent per context
 *   4. Retrieve candidate endpoints via inverted index
 *   5. Apply hard constraint filtering
 *   6. Score candidates with 14 signals
 *   7. Analyze confidence + ambiguity
 *   8. Return results with human-review flags
 *
 * Supports individual test case matching OR context-grouped matching.
 */

const { buildIndex, retrieveCandidates } = require("./endpointIndex");
const { extractIntent, extractActionTerms } = require("./targetIntentExtractor");
const { groupByOperationContext } = require("./operationContextGrouper");
const { computeAllSignals } = require("./matchingSignals");
const { analyzeConfidence, computeWeightedScore } = require("./confidenceAnalyzer");

// Protocol-level: HTTP methods are universal, not domain-specific
const ACTION_VERBS = [
  "create", "add", "post", "submit", "insert", "register",
  "get", "fetch", "retrieve", "list", "search", "find",
  "update", "edit", "modify", "change", "patch",
  "delete", "remove", "cancel", "deactivate", "archive",
  "approve", "reject", "validate", "verify", "confirm",
  "process", "execute", "run", "trigger",
  "login", "logout", "authenticate", "authorize",
  "upload", "download", "export", "import",
  "enable", "disable", "activate", "deactivate",
];

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Match test cases against an API catalog.
 */
function matchTestCases(testCases, endpoints, options = {}) {
  const { requirements = [], folderMap = new Map(), maxCandidates = 20 } = options;

  // Build endpoint ID → endpoint map
  const epMap = new Map();
  for (const ep of endpoints || []) {
    if (ep.id) epMap.set(ep.id, ep);
  }

  // Step 1: Build inverted index
  const fieldIndex = buildIndex(endpoints, folderMap);

  // Step 2: Group test cases by operation context
  const contexts = groupByOperationContext(testCases, requirements);

  // Step 3-8: For each context, run matching
  const results = [];
  const scenarioAssignments = new Map();

  // Also handle ungrouped test cases (those not in any context)
  const groupedTcIds = new Set();
  for (const ctx of contexts.values()) {
    ctx.testCaseIds.forEach((id) => groupedTcIds.add(id));
  }

  // Track which endpoint was assigned to each context for inheritance
  const contextAssignments = new Map();

  // Process grouped contexts
  for (const ctx of contexts.values()) {
    // Build aggregated intent from test cases
    const memberTcs = testCases.filter((tc) => ctx.testCaseIds.includes(tc.id));
    const aggregatedIntent = buildAggregatedIntent(ctx, memberTcs);

    // Run matching pipeline
    const result = matchIntentToEndpoint(
      ctx.contextId,
      ctx.testCaseIds,
      aggregatedIntent,
      endpoints,
      epMap,
      fieldIndex,
      folderMap,
      maxCandidates
    );

    result.testCaseIds = ctx.testCaseIds;
    ctx.matchResult = result;
    ctx.resolvedEndpointId = result.resolvedEndpointId;
    contextAssignments.set(ctx.contextId, result);

    // Assign to all member test cases
    for (const tcId of ctx.testCaseIds) {
      scenarioAssignments.set(tcId, {
        contextId: ctx.contextId,
        endpointId: result.resolvedEndpointId,
        endpoint: result.resolvedEndpointId ? epMap.get(result.resolvedEndpointId) : null,
        confidence: result.confidence,
        confidenceLevel: result.confidenceLevel,
        ambiguous: result.ambiguous,
        needsHumanReview: result.needsHumanReview,
        reviewReasons: result.reviewReasons,
        inheritedFromContext: true,
        matchResult: result,
      });
    }

    results.push(result);
  }

  // Process ungrouped test cases individually
  for (const tc of testCases) {
    if (groupedTcIds.has(tc.id)) continue;

    const intent = extractIntent(tc, requirements);
    const ctxId = `CTX-INDIVIDUAL-${tc.id}`;

    const result = matchIntentToEndpoint(
      ctxId,
      [tc.id],
      intent,
      endpoints,
      epMap,
      fieldIndex,
      folderMap,
      maxCandidates
    );

    scenarioAssignments.set(tc.id, {
      contextId: ctxId,
      endpointId: result.resolvedEndpointId,
      endpoint: result.resolvedEndpointId ? epMap.get(result.resolvedEndpointId) : null,
      confidence: result.confidence,
      confidenceLevel: result.confidenceLevel,
      ambiguous: result.ambiguous,
      needsHumanReview: result.needsHumanReview,
      reviewReasons: result.reviewReasons,
      inheritedFromContext: false,
      matchResult: result,
    });

    results.push(result);
  }

  return { results, scenarioAssignments };
}

/**
 * Match a single intent to the best endpoint.
 * Note: aggregatedIntent has { methodHints, actionTerms, resourceTerms, contextTerms, hasExplicitMethod } at top level
 */
function matchIntentToEndpoint(contextId, testCaseIds, intent, endpoints, epMap, fieldIndex, folderMap, maxCandidates) {
  // Step 3-4: Retrieve candidates via inverted index
  // The aggregated intent has these at the top level (not nested in operationIntent)
  const methodHints = intent?.methodHints || [];
  const actionTerms = intent?.actionTerms || [];
  const resourceTerms = intent?.resourceTerms || [];
  const contextTerms = intent?.contextTerms || [];
  
  let candidateIds = retrieveCandidates({ methodHints, actionTerms, resourceTerms, contextTerms }, fieldIndex, { maxCandidates });

  // If no candidates from index, use all endpoints
  if (candidateIds.length === 0) {
    candidateIds = endpoints.map((ep) => ep.id).filter(Boolean).slice(0, maxCandidates);
  }

  // Step 5-6: Score each candidate with 14 signals
  const scoredCandidates = [];
  for (const epId of candidateIds) {
    const ep = epMap.get(epId);
    if (!ep) continue;

    // Build a minimal intent object for signal functions
    // Signals expect operationIntent to be nested
    const signalIntent = {
      testCaseId: testCaseIds[0] || "unknown",
      operationIntent: {
        actionTerms: actionTerms,
        resourceTerms: resourceTerms,
        contextTerms: contextTerms,
        methodHints: methodHints,
        hasExplicitMethod: intent?.hasExplicitMethod || false,
      },
      targetFields: intent?.targetFields || [],
      parameterHints: intent?.parameterHints || { query: [], path: [], header: [] },
      authIntent: intent?.authIntent || { isAuthTest: false },
      sourceEvidence: intent?.sourceEvidence || [],
    };

    const signals = computeAllSignals(signalIntent, ep, fieldIndex, folderMap);
    const { totalScore, hasHardConflict, conflictReasons } = computeWeightedScore(signals);

    scoredCandidates.push({
      endpointId: epId,
      totalScore: Math.round(totalScore * 1000) / 1000,
      signals,
      hasHardConflict,
      conflictReasons,
    });
  }

  // Sort by totalScore descending
  scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

  // Step 7: Analyze confidence
  const result = analyzeConfidence(contextId, testCaseIds, scoredCandidates, intent);

  // Fill in resolved endpoint metadata
  if (result.resolvedEndpointId) {
    const ep = epMap.get(result.resolvedEndpointId);
    if (ep) {
      result.resolvedEndpointMethod = ep.method;
      result.resolvedEndpointPath = ep.path;
    }
  }

  return result;
}

/**
 * Build aggregated intent from context's member test cases.
 * Returns intent with actionTerms, resourceTerms, contextTerms, methodHints at top level
 * (to match what retrieveCandidates expects).
 */
function buildAggregatedIntent(ctx, memberTcs) {
  const aggregated = {
    actionTerms: [...new Set(ctx.intent?.actionTerms || [])],
    resourceTerms: [...new Set(ctx.intent?.resourceTerms || [])],
    contextTerms: [...new Set(ctx.intent?.contextTerms || [])],
    methodHints: [...new Set(ctx.intent?.methodHints || [])],
    hasExplicitMethod: ctx.intent?.hasExplicitMethod || false,
  };

  // Also collect sourceText from all test cases for additional context
  const sourceTexts = [];
  for (const tc of memberTcs) {
    if (tc.traceability?.sourceText) {
      sourceTexts.push(tc.traceability.sourceText);
    }
  }

  for (const tc of memberTcs) {
    const intent = extractIntent(tc);
    if (intent.operationIntent) {
      aggregated.actionTerms.push(...intent.operationIntent.actionTerms);
      aggregated.resourceTerms.push(...intent.operationIntent.resourceTerms);
      aggregated.contextTerms.push(...intent.operationIntent.contextTerms);
      aggregated.methodHints.push(...intent.operationIntent.methodHints);
      if (intent.operationIntent.hasExplicitMethod) aggregated.hasExplicitMethod = true;
    }
  }

  // Also extract action/resource terms from source texts for better matching
  for (const sourceText of sourceTexts) {
    const actions = extractActionTerms(sourceText);
    aggregated.actionTerms.push(...actions);
    const resources = tokenize(sourceText).filter(isResourceTerm);
    aggregated.resourceTerms.push(...resources);
  }

  // Deduplicate
  aggregated.actionTerms = [...new Set(aggregated.actionTerms)];
  aggregated.resourceTerms = [...new Set(aggregated.resourceTerms)];
  aggregated.contextTerms = [...new Set(aggregated.contextTerms)];
  aggregated.methodHints = [...new Set(aggregated.methodHints)];

  return aggregated;
}

// Helper for resource term detection (used in buildAggregatedIntent)
function isResourceTerm(word) {
  return !ACTION_VERBS.includes(word) && word.length > 2;
}

module.exports = {
  matchTestCases,
};