/**
 * TargetIntentExtractor
 *
 * Extracts a structured TargetIntent from a test case by analyzing:
 *   - Title text
 *   - Description
 *   - Assertions
 *   - Mutations (field paths)
 *   - Source acceptance criteria
 *   - Requirement IDs
 *   - Category/type
 *   - Preconditions
 *
 * All extraction is deterministic and domain-agnostic.
 * No business entities, field names, or resource terms are hardcoded.
 * Everything is derived dynamically from the text patterns present in the test case.
 */

// ─── Protocol-level: HTTP methods are universal, not domain-specific ─────
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

const ACTION_TO_METHOD = {
  create: "POST", add: "POST", post: "POST", submit: "POST", insert: "POST", register: "POST",
  get: "GET", fetch: "GET", retrieve: "GET", list: "GET", search: "GET", find: "GET",
  update: "PUT", edit: "PUT", modify: "PUT", change: "PUT", patch: "PATCH",
  delete: "DELETE", remove: "DELETE", cancel: "DELETE", deactivate: "DELETE", archive: "DELETE",
  login: "POST", authenticate: "POST", authorize: "POST",
  upload: "POST", download: "GET",
};

const AUTH_KEYWORDS = ["auth", "token", "login", "password", "credential", "authentication", "session", "bearer", "oauth", "apikey", "api_key"];

// ─── Text utilities ──────────────────────────────────────────────────────

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function extractActionTerms(text) {
  const tokens = tokenize(text);
  return tokens.filter((t) => ACTION_VERBS.includes(t));
}

function extractMethodHints(text) {
  const lower = text.toLowerCase();
  const hints = [];
  // Detect explicit HTTP methods
  if (/\bPOST\b/i.test(text)) hints.push("POST");
  if (/\bGET\b/i.test(text)) hints.push("GET");
  if (/\bPUT\b/i.test(text)) hints.push("PUT");
  if (/\bPATCH\b/i.test(text)) hints.push("PATCH");
  if (/\bDELETE\b/i.test(text)) hints.push("DELETE");
  if (hints.length > 0) return { hints, explicit: true };

  // Infer from action verbs
  const actions = extractActionTerms(text);
  for (const action of actions) {
    const method = ACTION_TO_METHOD[action];
    if (method && !hints.includes(method)) hints.push(method);
  }
  return { hints, explicit: false };
}

function isResourceTerm(word) {
  // A resource term is any noun-like word that's not a stop word or action verb
  // We keep all terms longer than 2 characters that aren't action verbs
  return !ACTION_VERBS.includes(word) && word.length > 2;
}

/**
 * Normalize path for comparison.
 */
function canonicalizePath(path) {
  if (!path) return null;
  return path
    .replace(/\/+$/, "") // Remove trailing slash
    .replace(/\{[^}]*\}/g, "{param}") // Normalize all {param} variants
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{param}"); // Normalize :param to {param}
}

/**
 * Detect field names from a mutation or assertion text.
 * Returns discovered field names with locations.
 */
function detectTargetFields(text) {
  const fields = [];
  const lower = text.toLowerCase();

  // Detect body/field references
  const bodyFieldMatches = lower.match(/\bfield\s+['"]?(\w+)['"]?\b/g);
  if (bodyFieldMatches) {
    for (const m of bodyFieldMatches) {
      const name = m.replace(/^field\s+['"]?/, "").replace(/['"]?$/, "");
      if (name && name.length > 1) {
        fields.push({ name, location: "BODY", confidence: 0.5 });
      }
    }
  }

  // Detect quoted strings that look like field names (often used in titles)
  const quotedFields = text.match(/['"](\w+)['"]/g);
  if (quotedFields) {
    for (const qf of quotedFields) {
      const name = qf.replace(/['"]/g, "");
      if (name && name.length > 1 && !/[A-Z]/.test(name[0])) {
        fields.push({ name, location: "BODY", confidence: 0.4 });
      }
    }
  }

  // Auth-specific field detection
  if (/auth|token/i.test(lower)) {
    fields.push({ name: "auth", location: "AUTH", confidence: 0.8 });
  }

  return fields;
}

/**
 * Detect auth intent from test type and text.
 */
function detectAuthIntent(tc) {
  if (tc.type === "auth") {
    const lower = (tc.title + " " + (tc.sourceAc || "")).toLowerCase();
    let authTestType = "EXPLICIT";
    if (/missing|without|no\s+(auth|token)/i.test(lower)) authTestType = "MISSING";
    else if (/invalid|expired|wrong|bad/i.test(lower)) authTestType = "INVALID";
    else if (/insufficient|denied|forbidden/i.test(lower)) authTestType = "INSUFFICIENT";

    const keywords = AUTH_KEYWORDS.filter((kw) => lower.includes(kw));
    return { isAuthTest: true, authTestType, authKeywords: keywords };
  }
  return { isAuthTest: false, authTestType: null, authKeywords: [] };
}

/**
 * Extract SourceEvidence from test case fields.
 */
function extractSourceEvidence(tc) {
  const evidence = [
    { source: "TITLE", text: tc.title || "", confidence: 0.7 },
    { source: "DESCRIPTION", text: tc.description || "", confidence: 0.4 },
  ];
  if (tc.sourceAc) {
    evidence.push({ source: "AC", text: tc.sourceAc, confidence: 0.8 });
  }
  for (const a of (tc.assertions || [])) {
    evidence.push({ source: "ASSERTION", text: a, confidence: 0.5 });
  }
  for (const m of (tc.mutations || [])) {
    if (m.field) {
      evidence.push({ source: "MUTATION", text: `field=${m.field} op=${m.operation}`, confidence: 0.6 });
    }
  }
  if (tc.precondition) {
    evidence.push({ source: "DESCRIPTION", text: tc.precondition, confidence: 0.5 });
  }
  return evidence;
}

/**
 * Extract fields from mutations.
 */
function extractFieldsFromMutations(mutations) {
  return (mutations || [])
    .filter((m) => m.field)
    .map((m) => ({
      name: m.field,
      jsonPath: m.field.startsWith("$.") ? m.field : `$.${m.field}`,
      possibleLocation: m.field === "auth" ? "AUTH" : m.field === "body" ? "BODY" : "BODY",
      constraintType: deriveConstraintType(m),
      confidence: 0.7,
    }));
}

function deriveConstraintType(mutation) {
  switch (mutation.operation) {
    case "remove": return "REQUIRED";
    case "replace": return "OTHER";
    case "boundaryMin":
    case "boundaryMax": return "RANGE";
    case "invalidType": return "TYPE";
    case "invalidFormat": return "FORMAT";
    case "maxLengthExceeded": return "LENGTH";
    default: return "OTHER";
  }
}

/**
 * Main entry: extract TargetIntent from a test case.
 *
 * @param {Object} tc — a test case from scenarioGenerator (has id, title, type, sourceAc, description, assertions, mutations, expectedMethod, pathHint)
 * @param {Array} [requirements] — optional requirement objects for enrichment
 * @returns {Object} TargetIntent-compatible object
 */
function extractIntent(tc, requirements = []) {
  // Use full traceability context if available (sourceText from summary/description)
  const sourceText = tc.traceability?.sourceText || tc.description || "";
  const combinedText = [tc.title, tc.sourceAc, sourceText, ...(tc.assertions || [])].filter(Boolean).join(" ");
  const { hints: methodHints, explicit: hasExplicitMethod } = extractMethodHints(combinedText);

  // Add explicit method from tc.expectedMethod if available (strong signal for matching)
  if (tc.expectedMethod && !methodHints.includes(tc.expectedMethod)) {
    methodHints.unshift(tc.expectedMethod);
  }

  const actionTerms = extractActionTerms(combinedText);
  const allTokens = tokenize(combinedText);
  const resourceTerms = [...new Set(allTokens.filter(isResourceTerm))].slice(0, 10);

  // Context terms from source AC and traceability source text
  const contextTerms = [];
  if (tc.sourceAc) {
    contextTerms.push(...tokenize(tc.sourceAc).filter(isResourceTerm));
  }
  // Use sourceText as additional context (the requirement summary)
  if (sourceText) {
    contextTerms.push(...tokenize(sourceText).filter(isResourceTerm));
  }

  const targetFields = [
    ...extractFieldsFromMutations(tc.mutations || []),
    ...detectTargetFields(combinedText),
  ];

  // Detect parameter hints
  const paramHints = { query: [], path: [], header: [] };
  const lower = combinedText.toLowerCase();
  if (/\bquery\s+param/i.test(lower)) paramHints.query.push("detected");
  if (/\bpath\s+param/i.test(lower)) paramHints.path.push("detected");
  if (/\bheader\s+(param|name)/i.test(lower)) paramHints.header.push("detected");

  // Include explicit path hint if available (STEP 9L.2C)
  const pathHint = tc.pathHint || null;
  const canonicalPathHint = pathHint ? canonicalizePath(pathHint) : null;

  return {
    testCaseId: tc.id,
    category: tc.type === "positive" ? "POSITIVE" : tc.type === "auth" ? "SECURITY" : tc.type === "negative" ? "NEGATIVE" : "EDGE",
    operationIntent: {
      actionTerms: [...new Set(actionTerms)],
      resourceTerms: [...new Set(resourceTerms)],
      contextTerms: [...new Set(contextTerms)],
      methodHints: [...new Set(methodHints)],
      hasExplicitMethod,
      // STEP 9L.2C: Include path hints for exact matching
      pathHint,
      canonicalPathHint,
    },
    targetFields,
    parameterHints: paramHints,
    authIntent: detectAuthIntent(tc),
    sourceEvidence: extractSourceEvidence(tc),
  };
}

module.exports = {
  extractIntent,
  extractActionTerms,
  extractMethodHints,
  extractSourceEvidence,
};