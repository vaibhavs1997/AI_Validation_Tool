/**
 * DeduplicationEngine
 *
 * Two-phase deduplication:
 *   Phase 1: Exact match (hash of key fields)
 *   Phase 2: Fuzzy match (same requirement + same equivalence partition + same field)
 *
 * Returns deduplicated test cases with stats.
 */

function deduplicate(testCases) {
  const before = testCases.length;
  const exactHashes = new Set();
  const unique = [];

  // Phase 1: Exact dedup
  for (const tc of testCases) {
    const sig = buildExactSignature(tc);
    if (exactHashes.has(sig)) continue;
    exactHashes.add(sig);
    unique.push(tc);
  }

  // Phase 2: Fuzzy dedup among remaining
  // Same requirement + same field + same partition = duplicate
  const fuzzyKeys = new Set();
  const final = [];

  for (const tc of unique) {
    const fk = buildFuzzyKey(tc);
    if (fuzzyKeys.has(fk)) continue;
    fuzzyKeys.add(fk);
    final.push(tc);
  }

  return {
    testCases: final,
    stats: {
      generatedBeforeDedup: before,
      duplicatesRemoved: before - final.length,
      finalCount: final.length,
    },
  };
}

function buildExactSignature(tc) {
  const parts = [
    tc.classification.category,
    tc.classification.technique,
    tc.classification.origin,
    ...(tc.traceability.requirementIds || []).sort(),
    tc.request && tc.request.mutation ? `${tc.request.mutation.operation}:${tc.request.mutation.path}:${JSON.stringify(tc.request.mutation.value)}` : "no-mutation",
    tc.classification.confidence,
  ];
  return parts.join("||");
}

function buildFuzzyKey(tc) {
  const reqId = (tc.traceability.requirementIds || []).sort().join(",");
  const cat = tc.classification.category;
  const tech = tc.classification.technique;
  const origin = tc.classification.origin;
  const mutationOp = tc.request && tc.request.mutation ? tc.request.mutation.operation : "none";
  return `${reqId}|${cat}|${tech}|${origin}|${mutationOp}`;
}

module.exports = { deduplicate };
