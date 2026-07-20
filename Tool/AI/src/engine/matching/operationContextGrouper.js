/**
 * OperationContextGrouper
 *
 * Groups related test cases into OperationContexts.
 *
 * Grouping logic:
 *   - Tests sharing requirement IDs belong together
 *   - Tests with same expectedMethod are grouped (same operation)
 *   - Tests covering positive/negative/boundary for the same field
 *
 * This ensures we resolve one context→endpoint instead of N tests→endpoint,
 * dramatically reducing cost and improving consistency.
 */

/**
 * Group test cases into operation contexts.
 *
 * @param {Array} testCases — test case objects
 * @param {Array} [requirements] — optional requirement objects for enrichment
 * @returns {Map<string, Object>} — contextId → OperationContext
 */
function groupByOperationContext(testCases, requirements = []) {
  const contexts = new Map();
  const tcByReqAndMethod = new Map(); // "reqId:method" → test case IDs
  const reqMap = new Map();  // requirementId → requirement

  // Build requirement index
  for (const req of (requirements || [])) {
    if (req.requirementId) reqMap.set(req.requirementId, req);
  }

  // Phase 1: Group by requirementId AND expectedMethod
  // This ensures tests with different methods (e.g., POST vs GET vs DELETE)
  // are matched separately
  for (const tc of (testCases || [])) {
    const reqIds = (tc.traceability?.requirementIds || []).filter(Boolean);
    const expMethod = tc.expectedMethod || null;
    
    for (const reqId of reqIds) {
      // Create a compound key: reqId + expectedMethod
      // If no expectedMethod, just use reqId
      const key = expMethod ? `${reqId}:${expMethod}` : reqId;
      if (!tcByReqAndMethod.has(key)) tcByReqAndMethod.set(key, []);
      tcByReqAndMethod.get(key).push(tc.id);
    }
  }

  // If no requirement-based grouping, create one context per test case
  if (tcByReqAndMethod.size === 0 || testCases.length === 0) {
    return new Map();
  }

  // Phase 2: Build contexts from grouped test cases
  let contextCounter = 0;
  for (const [key, tcIds] of tcByReqAndMethod) {
    contextCounter++;
    const parts = key.split(":");
    const reqId = parts[0];
    const expMethod = parts[1] || null;
    
    const contextId = `CTX-${String(contextCounter).padStart(3, "0")}`;
    const ctx = {
      contextId,
      requirementIds: [reqId],
      testCaseIds: [...new Set(tcIds)],
      intent: {
        actionTerms: [],
        resourceTerms: [],
        contextTerms: [],
        methodHints: [],
        hasExplicitMethod: !!expMethod,
      },
      fields: [],
      resolvedEndpointId: null,
      matchResult: null,
      expectedMethod: expMethod,  // Store for matching hints
    };
    
    // Pre-populate method hints if we have an explicit expectedMethod
    if (expMethod) {
      ctx.intent.methodHints = [expMethod];
    }
    
    contexts.set(contextId, ctx);
  }

  // Phase 3: Collect intents per context from test case data
  for (const ctx of contexts.values()) {
    for (const tcId of ctx.testCaseIds) {
      const tc = testCases.find((t) => t.id === tcId);
      if (!tc) continue;
      if (tc.title) {
        ctx.intent.contextTerms.push(...tokenize(tc.title));
      }
    }
    // Deduplicate
    ctx.intent.actionTerms = [...new Set(ctx.intent.actionTerms)];
    ctx.intent.resourceTerms = [...new Set(ctx.intent.resourceTerms)];
    ctx.intent.contextTerms = [...new Set(ctx.intent.contextTerms)];
    ctx.intent.methodHints = [...new Set(ctx.intent.methodHints)];
  }

  return contexts;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

module.exports = {
  groupByOperationContext,
};
