/**
 * MatchingSignals
 *
 * 14 independent signal functions used to score candidate endpoint matches.
 * Each signal operates on (TargetIntent, Endpoint) and returns a MatchingSignal.
 *
 * Signals 1-14 as specified:
 *   1. HTTP METHOD MATCH
 *   2. REQUEST NAME MATCH
 *   3. FOLDER CONTEXT MATCH
 *   4. NORMALIZED PATH MATCH
 *   5. RESOURCE / ENTITY SEMANTIC MATCH
 *   6. ACTION MATCH
 *   7. REQUEST FIELD OVERLAP
 *   8. QUERY PARAMETER MATCH
 *   9. PATH PARAMETER MATCH
 *  10. HEADER MATCH
 *  11. AUTHENTICATION MATCH
 *  12. CONTENT TYPE / BODY MODE MATCH
 *  13. BUSINESS CONTEXT MATCH
 *  14. SCHEMA SHAPE MATCH
 *
 * All signals are domain-agnostic — no business entities, field names,
 * or resource terms are hardcoded.
 */

const { SIGNAL_WEIGHTS } = require("./types");

// ─── Text utilities ───────────────────────────────────────────────────────

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function jaccardSimilarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function overlapScore(intentTerms, endpointTerms) {
  if (intentTerms.length === 0 || endpointTerms.length === 0) return 0;
  const matched = intentTerms.filter((t) => endpointTerms.includes(t));
  return matched.length / Math.max(intentTerms.length, endpointTerms.length);
}

// ─── Signal 1: HTTP METHOD MATCH ─────────────────────────────────────────

function signalMethod(intent, ep) {
  const epMethod = (ep.method || "").toUpperCase();
  const methodHints = intent.operationIntent?.methodHints || [];
  const hasExplicit = intent.operationIntent?.hasExplicitMethod;

  if (!epMethod || methodHints.length === 0) {
    return { name: "method", score: 0.5, weight: SIGNAL_WEIGHTS.METHOD_MATCH.weight, strength: "HARD_CONSTRAINT" };
  }

  const matches = methodHints.includes(epMethod);
  if (hasExplicit && !matches) {
    return { name: "method", score: 0, weight: SIGNAL_WEIGHTS.METHOD_MATCH.weight, strength: "HARD_CONSTRAINT", isConflict: true, explanation: `Explicit method in test (${methodHints.join("/")}) conflicts with endpoint method (${epMethod})` };
  }
  if (!hasExplicit && !matches) {
    return { name: "method", score: 0.1, weight: SIGNAL_WEIGHTS.METHOD_MATCH.weight, strength: "WEAK", explanation: `Inferred method (${methodHints.join("/")}) differs from endpoint (${epMethod})` };
  }
  return { name: "method", score: 1.0, weight: SIGNAL_WEIGHTS.METHOD_MATCH.weight, strength: "HARD_CONSTRAINT", explanation: `Method matches: ${epMethod}` };
}

// ─── Signal 2: REQUEST NAME MATCH ────────────────────────────────────────

function signalRequestName(intent, ep) {
  const tcText = intent.sourceEvidence?.filter((s) => s.source === "TITLE" || s.source === "AC").map((s) => s.text).join(" ") || "";
  const epName = `${ep.operationId || ""} ${ep.summary || ""}`.trim();
  if (!epName) return { name: "request_name", score: 0, weight: SIGNAL_WEIGHTS.OPERATION_NAME_MATCH.weight, strength: "WEAK" };

  const sim = jaccardSimilarity(tcText, epName);
  return {
    name: "request_name",
    score: sim,
    weight: SIGNAL_WEIGHTS.OPERATION_NAME_MATCH.weight,
    strength: "MEDIUM",
    explanation: `Name similarity: ${(sim * 100).toFixed(0)}%`,
  };
}

// ─── Signal 3: FOLDER CONTEXT MATCH ──────────────────────────────────────

function signalFolderContext(intent, ep, folderMap = new Map()) {
  const folder = folderMap.get(ep.id);
  if (!folder) return { name: "folder_context", score: 0, weight: SIGNAL_WEIGHTS.FOLDER_CONTEXT_MATCH.weight, strength: "WEAK" };

  const folderLower = folder.toLowerCase();
  const resourceTerms = intent.operationIntent?.resourceTerms || [];
  const contextTerms = intent.operationIntent?.contextTerms || [];
  const allTerms = [...resourceTerms, ...contextTerms];
  if (allTerms.length === 0) return { name: "folder_context", score: 0.3, weight: SIGNAL_WEIGHTS.FOLDER_CONTEXT_MATCH.weight, strength: "WEAK" };

  const matched = allTerms.filter((t) => folderLower.includes(t));
  const score = matched.length > 0 ? Math.min(matched.length / 3, 1) : 0;
  return {
    name: "folder_context",
    score,
    weight: SIGNAL_WEIGHTS.FOLDER_CONTEXT_MATCH.weight,
    strength: "MEDIUM",
    explanation: score > 0 ? `Folder "${folder}" matches terms: ${matched.join(", ")}` : undefined,
  };
}

// ─── Signal 4: NORMALIZED PATH MATCH ─────────────────────────────────────

function signalPath(intent, ep) {
  const epPath = (ep.path || "").toLowerCase();
  const epTokens = epPath.split("/").filter(Boolean).map((s) => s.replace(/[{}]/g, ""));
  const resourceTerms = intent.operationIntent?.resourceTerms || [];
  const contextTerms = intent.operationIntent?.contextTerms || [];
  const allTerms = [...resourceTerms, ...contextTerms];

  if (!epPath || allTerms.length === 0) return { name: "path", score: 0, weight: SIGNAL_WEIGHTS.PATH_MATCH.weight, strength: "WEAK" };

  const matchCount = allTerms.filter((t) => epTokens.includes(t)).length;
  const partialMatches = allTerms.filter((t) => epTokens.some((tok) => tok.includes(t) || t.includes(tok))).length;
  const totalPossible = Math.max(allTerms.length, 1);
  const score = Math.min((matchCount * 1.5 + partialMatches * 0.5) / totalPossible, 1);

  return {
    name: "path",
    score,
    weight: SIGNAL_WEIGHTS.PATH_MATCH.weight,
    strength: "STRONG",
    explanation: score > 0 ? `Path "${epPath}" matches ${matchCount} exact + ${partialMatches - matchCount} partial` : undefined,
  };
}

// ─── Signal 5: RESOURCE SEMANTIC MATCH ────────────────────────────────────

function signalResourceSemantic(intent, ep) {
  const epText = [ep.path, ep.summary, ep.operationId, ep.description, ...(ep.tags || [])].filter(Boolean).join(" ").toLowerCase();
  const resourceTerms = intent.operationIntent?.resourceTerms || [];
  if (resourceTerms.length === 0) return { name: "resource_semantic", score: 0, weight: 0.06, strength: "WEAK" };

  const score = overlapScore(resourceTerms, tokenize(epText));
  return {
    name: "resource_semantic",
    score,
    weight: 0.06,
    strength: "MEDIUM",
    explanation: score > 0 ? `Resource semantic match: ${(score * 100).toFixed(0)}%` : undefined,
  };
}

// ─── Signal 6: ACTION MATCH ──────────────────────────────────────────────

function signalAction(intent, ep) {
  const epText = [ep.operationId, ep.summary, ep.description].filter(Boolean).join(" ").toLowerCase();
  const actionTerms = intent.operationIntent?.actionTerms || [];
  if (actionTerms.length === 0) return { name: "action", score: 0, weight: SIGNAL_WEIGHTS.ACTION_MATCH.weight, strength: "WEAK" };

  const score = overlapScore(actionTerms, tokenize(epText));
  return {
    name: "action",
    score,
    weight: SIGNAL_WEIGHTS.ACTION_MATCH.weight,
    strength: "MEDIUM",
    explanation: score > 0 ? `Action match: ${(score * 100).toFixed(0)}%` : undefined,
  };
}

// ─── Signal 7: REQUEST FIELD OVERLAP ─────────────────────────────────────

function signalFieldOverlap(intent, ep, fieldIndex) {
  const targetFields = intent.targetFields || [];
  if (targetFields.length === 0) return { name: "field_overlap", score: 0.5, weight: SIGNAL_WEIGHTS.FIELD_OVERLAP.weight, strength: "WEAK" };

  // Check how many target fields exist in this endpoint's schema
  const epFields = fieldIndex?.byFieldName || new Map();
  let matchCount = 0;
  const matchedFields = [];

  for (const tf of targetFields) {
    const candidates = epFields.get(tf.name);
    if (candidates && candidates.includes(ep.id)) {
      matchCount++;
      matchedFields.push(tf.name);
    }
  }

  const score = matchCount / Math.max(targetFields.length, 1);
  return {
    name: "field_overlap",
    score,
    weight: SIGNAL_WEIGHTS.FIELD_OVERLAP.weight,
    strength: "STRONG",
    explanation: matchCount > 0 ? `Fields matched: ${matchedFields.join(", ")} (${matchCount}/${targetFields.length})` : "No target fields found in schema",
  };
}

// ─── Signal 8: QUERY PARAMETER MATCH ─────────────────────────────────────

function signalQueryParam(intent, ep) {
  const queryHints = intent.parameterHints?.query || [];
  const epParams = (ep.parameters || []).filter((p) => (p.in || "").toLowerCase() === "query").map((p) => p.name.toLowerCase());

  if (queryHints.length === 0) return { name: "query_param", score: 0.5, weight: SIGNAL_WEIGHTS.QUERY_PARAM_MATCH.weight, strength: "WEAK" };
  if (epParams.length === 0) return { name: "query_param", score: 0.1, weight: SIGNAL_WEIGHTS.QUERY_PARAM_MATCH.weight, strength: "WEAK", explanation: "Test references query params but endpoint has none" };

  const score = overlapScore(queryHints, epParams);
  return { name: "query_param", score, weight: SIGNAL_WEIGHTS.QUERY_PARAM_MATCH.weight, strength: "MEDIUM" };
}

// ─── Signal 9: PATH PARAMETER MATCH ──────────────────────────────────────

function signalPathParam(intent, ep) {
  const pathHints = intent.parameterHints?.path || [];
  const epPathParams = (ep.parameters || []).filter((p) => (p.in || "").toLowerCase() === "path").map((p) => p.name.toLowerCase());
  const pathParamNames = (ep.path || "").match(/\{(\w+)\}/g)?.map((m) => m.replace(/[{}]/g, "").toLowerCase()) || [];

  if (pathHints.length === 0) return { name: "path_param", score: 0.5, weight: SIGNAL_WEIGHTS.PATH_PARAM_MATCH.weight, strength: "WEAK" };
  const allEpParams = [...epPathParams, ...pathParamNames];
  if (allEpParams.length === 0) return { name: "path_param", score: 0.1, weight: SIGNAL_WEIGHTS.PATH_PARAM_MATCH.weight, strength: "WEAK" };

  const score = overlapScore(pathHints, allEpParams);
  return { name: "path_param", score, weight: SIGNAL_WEIGHTS.PATH_PARAM_MATCH.weight, strength: "MEDIUM" };
}

// ─── Signal 10: HEADER MATCH ─────────────────────────────────────────────

function signalHeader(intent, ep) {
  const headerHints = intent.parameterHints?.header || [];
  const epHeaders = (ep.parameters || []).filter((p) => (p.in || "").toLowerCase() === "header").map((p) => p.name.toLowerCase());

  if (headerHints.length === 0) return { name: "header", score: 0.5, weight: SIGNAL_WEIGHTS.HEADER_MATCH.weight, strength: "WEAK" };
  if (epHeaders.length === 0) return { name: "header", score: 0.1, weight: SIGNAL_WEIGHTS.HEADER_MATCH.weight, strength: "WEAK" };

  const score = overlapScore(headerHints, epHeaders);
  return { name: "header", score, weight: SIGNAL_WEIGHTS.HEADER_MATCH.weight, strength: "MEDIUM" };
}

// ─── Signal 11: AUTHENTICATION MATCH ─────────────────────────────────────

function signalAuth(intent, ep) {
  const authIntent = intent.authIntent || {};
  if (!authIntent.isAuthTest) return { name: "auth", score: 0.5, weight: SIGNAL_WEIGHTS.AUTH_MATCH.weight, strength: "WEAK" };

  // Check if endpoint has security definitions (OpenAPI)
  const hasSecurity = ep.security?.length > 0 || ep.parameters?.some((p) => (p.in || "").toLowerCase() === "header" && /auth|token|bearer|apikey|apikey/i.test(p.name));
  const epText = [ep.path, ep.summary, ep.description, ep.operationId].filter(Boolean).join(" ").toLowerCase();
  const hasAuthTerms = /auth|token|login|bearer|oauth/i.test(epText);

  if (hasSecurity || hasAuthTerms) {
    return { name: "auth", score: 1.0, weight: SIGNAL_WEIGHTS.AUTH_MATCH.weight, strength: "STRONG", explanation: "Test is auth-related and endpoint has auth indicators" };
  }
  return { name: "auth", score: 0.3, weight: SIGNAL_WEIGHTS.AUTH_MATCH.weight, strength: "MEDIUM", explanation: "Test is auth-related but endpoint has no explicit auth metadata" };
}

// ─── Signal 12: CONTENT TYPE MATCH ───────────────────────────────────────

function signalContentType(intent, ep) {
  const hasBody = intent.targetFields?.some((f) => f.possibleLocation === "BODY") || false;
  const epHasBody = ep.requestSchema != null;

  if (!hasBody) return { name: "content_type", score: 0.5, weight: SIGNAL_WEIGHTS.CONTENT_TYPE_MATCH.weight, strength: "WEAK" };
  if (hasBody && epHasBody) return { name: "content_type", score: 1.0, weight: SIGNAL_WEIGHTS.CONTENT_TYPE_MATCH.weight, strength: "WEAK", explanation: "Test targets body fields and endpoint accepts body" };
  return { name: "content_type", score: 0.1, weight: SIGNAL_WEIGHTS.CONTENT_TYPE_MATCH.weight, strength: "WEAK", explanation: "Test targets body fields but endpoint has no request body" };
}

// ─── Signal 13: BUSINESS CONTEXT MATCH ───────────────────────────────────

function signalBusinessContext(intent, ep) {
  const epText = [ep.path, ep.summary, ep.description, ep.operationId, ...(ep.tags || [])].filter(Boolean).join(" ").toLowerCase();
  const contextTerms = intent.operationIntent?.contextTerms || [];
  const combined = [
    ...intent.sourceEvidence?.filter((s) => s.source === "AC" || s.source === "TITLE").map((s) => s.text) || [],
  ].join(" ").toLowerCase();

  if (!combined && contextTerms.length === 0) return { name: "business_context", score: 0, weight: SIGNAL_WEIGHTS.BUSINESS_CONTEXT_MATCH.weight, strength: "WEAK" };

  const textSim = jaccardSimilarity(combined, epText);
  const termOverlap = contextTerms.length > 0 ? overlapScore(contextTerms, tokenize(epText)) : 0;
  const score = Math.max(textSim, termOverlap);

  return {
    name: "business_context",
    score,
    weight: SIGNAL_WEIGHTS.BUSINESS_CONTEXT_MATCH.weight,
    strength: "MEDIUM",
    explanation: score > 0 ? `Context similarity: ${(score * 100).toFixed(0)}%` : undefined,
  };
}

// ─── Signal 14: SCHEMA SHAPE MATCH ───────────────────────────────────────

function signalSchemaShape(intent, ep, fieldIndex) {
  const targetFields = intent.targetFields || [];
  if (targetFields.length < 2) return { name: "schema_shape", score: 0.3, weight: SIGNAL_WEIGHTS.SCHEMA_SHAPE_MATCH.weight, strength: "WEAK" };

  // Count how many endpoint field names overlap with target fields
  const epFieldNames = fieldIndex?.byFieldName ? new Map() : new Map();
  // We'll use the index more efficiently — check which fields exist
  const idx = fieldIndex?.byFieldName;
  let exactMatches = 0;
  let nestedMatches = 0;

  for (const tf of targetFields) {
    if (!idx) continue;
    const eps = idx.get(tf.name);
    if (eps && eps.includes(ep.id)) {
      exactMatches++;
      // Check if it might be a nested field (has dot in name or jsonPath)
      if (tf.jsonPath && tf.jsonPath.includes(".")) nestedMatches++;
    }
  }

  const baseScore = targetFields.length > 0 ? exactMatches / targetFields.length : 0;
  const nestedBonus = targetFields.length > 0 ? nestedMatches / targetFields.length * 0.5 : 0;
  const score = Math.min(baseScore + nestedBonus, 1);

  return {
    name: "schema_shape",
    score,
    weight: SIGNAL_WEIGHTS.SCHEMA_SHAPE_MATCH.weight,
    strength: "STRONG",
    explanation: score > 0 ? `Schema shape: ${exactMatches} fields match (${nestedMatches} nested)` : undefined,
  };
}

// ─── Compute all signals ─────────────────────────────────────────────────

/**
 * Compute all 14 signals for a candidate endpoint.
 *
 * @param {Object} intent — TargetIntent
 * @param {Object} ep — normalized endpoint
 * @param {Object} fieldIndex — FieldIndex
 * @param {Map} [folderMap] — endpointId → folder path
 * @returns {MatchingSignal[]}
 */
function computeAllSignals(intent, ep, fieldIndex, folderMap = new Map()) {
  return [
    signalMethod(intent, ep),
    signalRequestName(intent, ep),
    signalFolderContext(intent, ep, folderMap),
    signalPath(intent, ep),
    signalResourceSemantic(intent, ep),
    signalAction(intent, ep),
    signalFieldOverlap(intent, ep, fieldIndex),
    signalQueryParam(intent, ep),
    signalPathParam(intent, ep),
    signalHeader(intent, ep),
    signalAuth(intent, ep),
    signalContentType(intent, ep),
    signalBusinessContext(intent, ep),
    signalSchemaShape(intent, ep, fieldIndex),
  ];
}

module.exports = {
  computeAllSignals,
  signalMethod,
  signalRequestName,
  signalFolderContext,
  signalPath,
  signalResourceSemantic,
  signalAction,
  signalFieldOverlap,
  signalQueryParam,
  signalPathParam,
  signalHeader,
  signalAuth,
  signalContentType,
  signalBusinessContext,
  signalSchemaShape,
};
