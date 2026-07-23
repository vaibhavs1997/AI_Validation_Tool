/**
 * OperationContextGrouper
 *
 * Groups related test cases into OperationContexts.
 *
 * Grouping logic:
 *   - Tests sharing requirement ID are grouped together
 *   - Tests with same expectedMethod are grouped
 *   - Auth tests are separated from non-auth tests (different intent requirements)
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
  const tcByReqAndMethodAndType = new Map(); // "reqId:method:type" → test case IDs
  const reqMap = new Map();  // requirementId → requirement

  // Build requirement index
  for (const req of (requirements || [])) {
    if (req.requirementId) reqMap.set(req.requirementId, req);
  }

  // Phase 1: Group by requirementId AND expectedMethod AND test type
  // This separates auth tests from other tests to ensure proper endpoint matching
  for (const tc of (testCases || [])) {
    const reqIds = (tc.traceability?.requirementIds || []).filter(Boolean);
    const expMethod = tc.expectedMethod || null;
    // Auth tests need separate grouping - they should only match endpoints with auth indicators
    const isAuthTest = tc.type === "auth";
    const testType = isAuthTest ? "auth" : "normal";
    
    for (const reqId of reqIds) {
      // Create a compound key that separates auth tests from normal tests
      // Format: "reqId:method:auth" or "reqId:auth" (if no method)
      const groupKey = expMethod 
        ? `${reqId}:${expMethod}:${testType}` 
        : `${reqId}:${testType}`;
      
      if (!tcByReqAndMethodAndType.has(groupKey)) tcByReqAndMethodAndType.set(groupKey, []);
      tcByReqAndMethodAndType.get(groupKey).push(tc.id);
    }
  }

  // If no requirement-based grouping, create one context per test case
  if (tcByReqAndMethodAndType.size === 0 || testCases.length === 0) {
    return new Map();
  }

  // Phase 2: Build contexts from grouped test cases
  let contextCounter = 0;
  for (const [groupKey, tcIds] of tcByReqAndMethodAndType) {
    contextCounter++;
    const parts = groupKey.split(":");
    let reqId, expMethod, isAuth = false;

    // Parse the key: "reqId:method:type", "reqId:type" (if no method)
    if (parts.length === 3) {
      reqId = parts[0];
      expMethod = parts[1];
      isAuth = parts[2] === "auth";
    } else if (parts.length === 2) {
      reqId = parts[0];
      isAuth = parts[1] === "auth";
    } else {
      reqId = parts[0];
    }

    const contextId = `CTX-${String(contextCounter).padStart(3, "0")}`;
    const ctx = {
      contextId,
      requirementIds: [reqId],
      testCaseIds: [...new Set(tcIds)],
      intent: {
        actionTerms: [],
        resourceTerms: [],
        contextTerms: [],
        methodHints: expMethod ? [expMethod] : [],
        hasExplicitMethod: !!expMethod,
        // For auth contexts, mark as auth test
        ...(isAuth ? { authIntent: { isAuthTest: true } } : {}),
      },
      fields: [],
      resolvedEndpointId: null,
      matchResult: null,
      expectedMethod: expMethod,
    };

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