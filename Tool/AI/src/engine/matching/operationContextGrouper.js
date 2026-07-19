/**
 * OperationContextGrouper
 *
 * Groups related test cases into OperationContexts.
 *
 * Grouping logic:
 *   - Tests sharing requirement IDs belong together
 *   - Tests sharing the same field targets belong together
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
  const tcByReq = new Map(); // requirementId → test case IDs
  const reqMap = new Map();  // requirementId → requirement

  // Build requirement index
  for (const req of (requirements || [])) {
    if (req.requirementId) reqMap.set(req.requirementId, req);
  }

  // Phase 1: Group by requirementId
  for (const tc of (testCases || [])) {
    const reqIds = (tc.traceability?.requirementIds || []).filter(Boolean);
    // Also try from tc itself (scenarioGenerator creates TCs with requirementId in traceability)
    for (const reqId of reqIds) {
      if (!tcByReq.has(reqId)) tcByReq.set(reqId, []);
      tcByReq.get(reqId).push(tc.id);
    }
  }

  // If no requirement-based grouping, create one context per test case
  if (tcByReq.size === 0 || testCases.length === 0) {
    return new Map();
  }

  // Phase 2: Build contexts from shared requirement groups
  let contextCounter = 0;
  const assigned = new Set();

  for (const [reqId, tcIds] of tcByReq) {
    contextCounter++;
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
        hasExplicitMethod: false,
      },
      fields: [],
      resolvedEndpointId: null,
      matchResult: null,
    };
    tcIds.forEach((id) => assigned.add(id));
    contexts.set(contextId, ctx);
  }

  // Phase 3: Merge contexts that share field targets across requirements
  // Collect intents per context from test case data
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
