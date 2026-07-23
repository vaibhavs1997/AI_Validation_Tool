/**
 * OperationIntent — Semantic Operation Resolution Model
 *
 * STEP 9L.2C: Represents the intent to perform an API operation,
 * derived from preserved BehaviorGroup semantics and test case context.
 *
 * Priority order for matching:
 *   1. Explicit method + explicit path (authoritative)
 *   2. Explicit path + inferred method
 *   3. Explicit method + resource/action evidence
 *   4. Semantic contract-assisted inference
 *   5. Ambiguous (remain unlinked)
 */

/**
 * Normalize path to canonical form for comparison.
 * /posts/{postId} → /posts/{param}
 * /users/:userId → /users/{param}
 */
function canonicalizePath(path) {
  if (!path) return null;
  return path
    .replace(/\/+$/, "") // Remove trailing slash
    .replace(/\/{2,}/g, "/") // Remove duplicate slashes
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{param}") // Normalize :param to {param}
    .replace(/\{[^}]*\}/g, "{param}"); // Normalize all {param} variants
}

/**
 * Detect action verbs from text (domain-agnostic).
 */
function detectActionVerbs(text) {
  const ACTION_VERBS = [
    "create", "add", "post", "submit", "insert", "register",
    "get", "fetch", "retrieve", "list", "search", "find",
    "update", "edit", "modify", "change", "patch",
    "delete", "remove", "cancel", "deactivate", "archive",
    "approve", "reject", "validate", "verify", "confirm",
  ];
  const tokens = String(text || "").toLowerCase().split(/\W+/).filter(w => w.length > 2);
  return tokens.filter(t => ACTION_VERBS.includes(t));
}

/**
 * Detect resource nouns from text (domain-agnostic).
 */
function detectResourceNouns(text) {
  const ACTION_VERBS = new Set([
    "create", "add", "post", "submit", "insert", "register",
    "get", "fetch", "retrieve", "list", "search", "find",
    "update", "edit", "modify", "change", "patch",
    "delete", "remove", "cancel", "deactivate", "archive",
    "approve", "reject", "validate", "verify", "confirm",
    "login", "logout", "authenticate", "authorize",
    "upload", "download", "export", "import",
  ]);
  const tokens = String(text || "").toLowerCase().split(/\W+/).filter(w => w.length > 2);
  return tokens.filter(t => !ACTION_VERBS.has(t)).slice(0, 5);
}

/**
 * Create an OperationIntent from a test case and optional requirement.
 */
function createOperationIntent(tc, requirement) {
  const sourceText = [
    tc.title || "",
    tc.sourceAc || "",
    tc.description || "",
    ...(tc.assertions || []),
  ].join(" ");

  const intent = {
    testCaseId: tc.id,
    behaviorGroupId: tc.behaviorGroupId || null,
    requirementId: tc.traceability?.requirementIds?.[0] || null,

    // Explicit context (highest priority)
    method: tc.expectedMethod || tc.request?.method || tc.methodHint || null,
    path: tc.pathHint || tc.request?.endpoint || null,

    // Canonical forms for comparison
    canonicalMethod: tc.expectedMethod || tc.request?.method || tc.methodHint || null,
    canonicalPath: canonicalizePath(tc.pathHint || tc.request?.endpoint) || null,

    // Semantic hints (fallback)
    actionTerms: detectActionVerbs(sourceText),
    resourceTerms: detectResourceNouns(sourceText),

    // Evidence tracking
    evidence: {
      explicitMethod: !!tc.expectedMethod,
      explicitPath: !!tc.pathHint,
      methodFromRequest: !!tc.request?.method,
      pathFromRequest: !!tc.request?.endpoint,
      source: "orchestrator",
    },

    // Context for matching
    contextTerms: extractContextTerms(sourceText),
    operationIdHints: extractOperationIdHints(sourceText),
    parameterHints: extractParameterHints(sourceText),

    // Traceability
    acIndex: tc.acIndex ?? -1,
    originalSource: tc.sourceAc || tc.title || "",
  };

  return intent;
}

/**
 * Extract context terms (non-action, non-resource terms).
 */
function extractContextTerms(text) {
  const STOP_WORDS = new Set([
    "the", "and", "for", "with", "that", "this", "from", "should",
    "when", "then", "user", "api", "able", "only", "will", "must",
    "into", "have", "has", "given", "and", "given", "valid", "existing",
    "successful", "success", "response", "request", "sent", "is", "to", "a", "an",
  ]);
  const tokens = String(text || "").toLowerCase().split(/\W+/).filter(w => w.length > 2);
  return tokens.filter(t => !STOP_WORDS.has(t));
}

/**
 * Extract potential operationId hints.
 */
function extractOperationIdHints(text) {
  const hints = [];
  const patterns = [
    /([a-z][a-z0-9]+(?:[A-Z][a-zA-Z0-9]*)*)/g, // camelCase
    /([a-z]+-[a-z]+(?:-[a-z]+)*)/g, // kebab-case
  ];
  for (const p of patterns) {
    const matches = String(text || "").match(p) || [];
    hints.push(...matches.map(m => m.toLowerCase()).filter(m => m.length > 4));
  }
  return [...new Set(hints)];
}

/**
 * Extract path parameter hints from text.
 */
function extractParameterHints(text) {
  const pathParams = [];
  const matches = String(text || "").match(/\b([a-zA-Z]+Id|[a-zA-Z]+Id|[a-zA-Z]*Id)\b/g) || [];
  const queryMatches = String(text || "").match(/\b(by|filter|search|sort)[A-Z][a-z]+/g) || [];

  for (const m of matches) {
    pathParams.push(m.toLowerCase());
  }

  return {
    path: [...new Set(pathParams)],
    query: [],
  };
}

module.exports = {
  canonicalizePath,
  detectActionVerbs,
  detectResourceNouns,
  createOperationIntent,
  extractContextTerms,
};