const { createSampleValue, parseContract } = require("../contracts/contractParser");
const { enhanceScenarios } = require("../integrations/llmClient");

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "should",
  "when", "then", "user", "api", "able", "only", "will", "must",
  "into", "have", "has",
]);

// Map CRUD/action words to HTTP methods
const ACTION_TO_METHOD = {
  create: "POST", add: "POST", post: "POST", submit: "POST", insert: "POST",
  get: "GET", fetch: "GET", retrieve: "GET", list: "GET", search: "GET",
  update: "PUT", edit: "PUT", modify: "PUT", change: "PUT",
  delete: "DELETE", remove: "DELETE", cancel: "DELETE", deactivate: "DELETE",
};

function words(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9/{}_-]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Extract all significant keywords from text for matching.
 */
function keywords(text) {
  return new Set(words(text));
}

/**
 * Score how well an endpoint matches a test case.
 * Returns { score, reasons } where score > 0 means a match.
 */
function scoreEndpointForTestCase(tc, endpoint) {
  const tcText = [tc.title, tc.sourceAc, tc.description, ...(tc.assertions || [])].join(" ").toLowerCase();
  const tcWords = keywords(tcText);
  const tcMethod = detectMethod(tc);
  const epPath = (endpoint.path || "").toLowerCase();
  const epMethod = (endpoint.method || "").toUpperCase();
  const epWords = keywords([endpoint.path, endpoint.summary, endpoint.description, endpoint.operationId, ...(endpoint.tags || [])].join(" "));
  const reasons = [];
  let score = 0;

  // 1. HTTP method match (most important)
  if (tcMethod && tcMethod === epMethod) {
    score += 10;
    reasons.push(`method:${epMethod}`);
  } else if (tcMethod && tcMethod !== epMethod) {
    // Strong mismatch — heavily penalize unless path is very relevant
    score -= 5;
  }

  // 2. Path segment matching (e.g. "refund" in path ↔ "refund" in AC)
  const pathSegments = epPath.split("/").filter(Boolean);
  for (const segment of pathSegments) {
    const cleanSeg = segment.replace(/[{}]/g, "");
    if (tcWords.has(cleanSeg)) {
      score += 8;
      reasons.push(`path:${cleanSeg}`);
    }
    // Check partial matches like "payment" matching "payments"
    for (const tw of tcWords) {
      if (cleanSeg.includes(tw) || tw.includes(cleanSeg)) {
        score += 4;
        reasons.push(`partial:${cleanSeg}`);
        break;
      }
    }
  }

  // 3. OperationId / summary matching
  const opWords = keywords([endpoint.operationId, endpoint.summary].filter(Boolean).join(" "));
  for (const ow of opWords) {
    if (tcWords.has(ow)) {
      score += 5;
      reasons.push(`op:${ow}`);
    }
  }

  // 4. Tag matching
  for (const tag of (endpoint.tags || [])) {
    const tagWords = keywords(tag);
    for (const tw of tagWords) {
      if (tcWords.has(tw)) {
        score += 3;
        reasons.push(`tag:${tw}`);
      }
    }
  }

  // 5. Description/notes matching
  const descWords = keywords(endpoint.description || "");
  for (const dw of descWords) {
    if (tcWords.has(dw)) {
      score += 2;
    }
  }

  return { score, reasons };
}

/**
 * Detect expected HTTP method from a test case title.
 */
function detectMethod(tc) {
  const title = tc.title.toLowerCase();
  for (const [action, method] of Object.entries(ACTION_TO_METHOD)) {
    if (title.includes(action)) return method;
  }
  // Check type-based defaults
  if (tc.type === "auth") return "POST";
  return null;
}

function positiveStatus(endpoint) {
  const statuses = Object.keys(endpoint.responses || {});
  return statuses.find((s) => ["200", "201", "202", "204"].includes(s)) || statuses.find((s) => /^2/.test(s)) || 200;
}

function negativeStatus(endpoint) {
  const statuses = Object.keys(endpoint.responses || {});
  return statuses.find((s) => ["400", "422", "409"].includes(s)) || 400;
}

function authStatus(endpoint) {
  const statuses = Object.keys(endpoint.responses || {});
  return statuses.find((s) => ["401", "403"].includes(s)) || 401;
}

function firstField(schema) {
  const properties = schema?.properties || {};
  return Object.keys(properties)[0] || "";
}

function numericFields(schema, prefix = "") {
  const out = [];
  for (const [key, child] of Object.entries(schema?.properties || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    const type = Array.isArray(child.type) ? child.type[0] : child.type;
    if (["number", "integer"].includes(type) || /amount|price|total|count|quantity/i.test(key)) out.push({ path, schema: child });
    if (child.properties) out.push(...numericFields(child, path));
  }
  return out;
}

function buildScenario(endpoint, index, overrides) {
  return {
    id: `${endpoint.operationId || endpoint.id}-TC-${String(index).padStart(3, "0")}`.replace(/[^a-zA-Z0-9_-]/g, "-"),
    endpointId: endpoint.id,
    method: endpoint.method,
    path: endpoint.path,
    basePayload: endpoint.requestSchema ? createSampleValue(endpoint.requestSchema, "payload") : {},
    mutations: [],
    assertions: [],
    risk: "medium",
    sourceAc: "API contract",
    ...overrides,
  };
}

function businessRuleMutation(rule, endpoint) {
  const schema = endpoint?.requestSchema;
  const nums = numericFields(schema);
  const field = nums[0]?.path || firstField(schema) || "value";

  if (/greater|exceed|more than|maximum|max/i.test(rule)) {
    return [{ field, operation: "boundaryMax", value: 999999999 }];
  }
  if (/less|minimum|min|negative/i.test(rule)) {
    return [{ field, operation: "boundaryMin", value: -1 }];
  }
  if (/required|mandatory|must provide/i.test(rule)) {
    return [{ field, operation: "remove" }];
  }
  if (/invalid|not allowed|cannot|should not/i.test(rule)) {
    return [{ field, operation: "invalidType" }];
  }
  if (/duplicate|already exists|unique/i.test(rule)) {
    return [{ field, operation: "duplicate" }];
  }
  if (/length|character|char|min|max/i.test(rule)) {
    return [{ field, operation: "boundary", value: "edge-case-value" }];
  }
  if (/format|pattern|valid/i.test(rule)) {
    return [{ field, operation: "invalidFormat" }];
  }
  return field ? [{ field, operation: "replace", value: "rule-violation-value" }] : [];
}

/**
 * Detect what field names the AC is likely about (email, password, username, role, etc.)
 */
function detectAcField(rule) {
  const lower = rule.toLowerCase();
  if (/email/i.test(lower)) return "email";
  if (/password/i.test(lower)) return "password";
  if (/username|user/i.test(lower)) return "username";
  if (/role/i.test(lower)) return "role";
  if (/name/i.test(lower)) return "name";
  return "field";
}

function createTestCasesFromTicket(ticket) {
  const cases = [];
  let counter = 1;
  const titleBase = ticket?.summary || "API validation";
  const acceptance = ticket?.acceptanceCriteria || [];
  const description = ticket?.description || "";

  // Dedup tracker: key = "type|field|operation|assertionHash"
  const added = new Set();
  let lastDetectedField = "field";

  function dedupKey(type, mutations, assertions) {
    const mutSig = (mutations || []).map(m => `${m.operation}:${m.field}:${JSON.stringify(m.value)}`).sort().join(",");
    const asrtSig = (assertions || []).slice(0, 2).join("|");
    return `${type}|${mutSig}|${asrtSig}`;
  }

  function tryAdd(title, type, sourceAc, assertions, mutations, risk, expectedMethod) {
    const key = dedupKey(type, mutations, assertions);
    if (added.has(key)) return; // skip duplicate
    added.add(key);
    cases.push({
      id: `TC-${String(counter++).padStart(3, "0")}`,
      title: title.length > 120 ? title.slice(0, 120) : title,
      type,
      sourceAc: sourceAc || "",
      description,
      assertions: assertions || [],
      mutations: mutations || [],
      risk: risk || "medium",
      expectedMethod: expectedMethod || null,
    });
  }

  // Determine overall method from ticket summary
  const summaryLower = titleBase.toLowerCase();
  let defaultMethod = null;
  if (/create|add|submit|register/i.test(summaryLower)) defaultMethod = "POST";
  else if (/get|fetch|retrieve|list|search/i.test(summaryLower)) defaultMethod = "GET";
  else if (/update|edit|change|modify/i.test(summaryLower)) defaultMethod = "PUT";
  else if (/delete|remove|cancel/i.test(summaryLower)) defaultMethod = "DELETE";

  // 1. POSITIVE: One happy path using valid data (no mutations)
  tryAdd(
    `${titleBase} - successful execution with valid data`,
    "positive",
    ticket?.summary || "Happy path",
    ["Returns success status (2xx)", "Response contains expected resource data"],
    [],
    "low",
    defaultMethod
  );

// 2. For each acceptance criterion, generate SMART test scenarios
  for (const ac of acceptance.slice(0, 10)) { // Limit to top 10 ACs for quality
    const acField = detectAcField(ac);
    const lower = ac.toLowerCase();
    lastDetectedField = acField;

    // Determine expected method based on AC content
    let method = null;
    if (/create|add|submit|register/i.test(lower)) method = "POST";
    else if (/get|fetch|retrieve|list|search/i.test(lower)) method = "GET";
    else if (/update|edit|change|modify/i.test(lower)) method = "PUT";
    else if (/delete|remove|cancel/i.test(lower)) method = "DELETE";
    else if (/login|auth|token/i.test(lower)) method = "POST";

    // Detect the nature of this AC: is it a POSITIVE assertion or a CONSTRAINT?
    const isConstraint = /invalid|error|fail|reject|not|cannot|missing|duplicate|already|mandatory|required|only\s*for|must\s*(be|not)|cannot\s*exceed/i.test(lower);
    const isBoundary = /greater than|less than|minimum|maximum|exceed|greater than zero/i.test(lower);
    const isRequired = /required|mandatory|missing/i.test(lower);
    const isUnique = /unique|already exists|duplicate/i.test(lower);

    // POSITIVE scenario: only if this AC is NOT a constraint
    if (!isConstraint) {
      tryAdd(
        `${titleBase} - [Positive] ${ac.length > 80 ? ac.slice(0, 80) : ac}`,
        "positive",
        ac,
        [`Verify: ${ac}`],
        [],
        "low",
        method
      );
    }

    // NEGATIVE: Required/Missing field validation
    if (isRequired) {
      tryAdd(
        `${titleBase} - [Negative] Missing ${acField} must be rejected`,
        "negative",
        ac,
        ["API returns 400/422 validation error", "Error message indicates missing required field"],
        [{ field: acField, operation: "remove" }],
        "medium",
        method
      );
      tryAdd(
        `${titleBase} - [Negative] Empty ${acField} field must be rejected`,
        "negative",
        ac,
        ["API returns validation error for empty field"],
        [{ field: acField, operation: "replace", value: "" }],
        "medium",
        method
      );
    }

    // NEGATIVE: Uniqueness constraint
    if (isUnique) {
      tryAdd(
        `${titleBase} - [Negative] Duplicate request must be rejected with 409`,
        "negative",
        ac,
        ["API returns 409 conflict", "Error message indicates duplicate/existing resource"],
        [{ field: acField, operation: "duplicate" }],
        "high",
        method
      );
    }

    // BOUNDARY: Greater-than / positive-range constraints
    if (/greater than zero|must be positive|greater than/i.test(lower)) {
      tryAdd(
        `${titleBase} - [Negative] ${acField} must be rejected when less than minimum`,
        "negative",
        ac,
        ["API returns 422/400 for out-of-range value", `Error indicates ${acField} out of valid range`],
        [{ field: acField, operation: "boundaryMin", value: -1 }],
        "medium",
        method
      );
    }

    // BOUNDARY: Cannot exceed / max constraint
    if (/cannot exceed|exceed|maximum|max/i.test(lower)) {
      const maxVal = /amount|price|total/i.test(acField) ? 9999999 : 99999;
      tryAdd(
        `${titleBase} - [Negative] ${acField} exceeding maximum must be rejected`,
        "negative",
        ac,
        ["API returns 422/400 for exceeded limit", `Error indicates ${acField} exceeds maximum`],
        [{ field: acField, operation: "boundaryMax", value: maxVal }],
        "medium",
        method
      );
      // Also add a positive boundary test (valid max value) if not added yet
      tryAdd(
        `${titleBase} - [Positive] ${acField} at maximum valid value succeeds`,
        "positive",
        ac,
        [`Valid ${acField} at boundary accepted`, "Returns success status"],
        [],
        "low",
        method
      );
    }

    // General rejection: "not allowed", "cannot", "reject"
    // Only applies if NOT already handled by a more specific handler
    if (/reject|not allowed|cannot|should not/i.test(lower) && !isRequired && !isUnique && !isBoundary) {
      tryAdd(
        `${titleBase} - [Negative] ${ac.length > 80 ? ac.slice(0, 80) : ac}`,
        "negative",
        ac,
        [`API rejects invalid request: ${ac}`],
        [{ field: acField, operation: "invalidType" }],
        "medium",
        method
      );
    }

    // Password policy (only if password referenced)
    if (/password|uppercase|special|number|digit/i.test(lower)) {
      tryAdd(`${titleBase} - [Negative] Password too short must be rejected`, "negative", ac,
        ["API returns validation error for password length"],
        [{ field: "password", operation: "replace", value: "Ab1!" }], "medium", method);
      tryAdd(`${titleBase} - [Negative] Password without uppercase must be rejected`, "negative", ac,
        ["API returns validation error - uppercase required"],
        [{ field: "password", operation: "replace", value: "abcdef123!" }], "medium", method);
      tryAdd(`${titleBase} - [Negative] Password without number must be rejected`, "negative", ac,
        ["API returns validation error - number required"],
        [{ field: "password", operation: "replace", value: "Abcdefgh!" }], "medium", method);
      tryAdd(`${titleBase} - [Negative] Password without special char must be rejected`, "negative", ac,
        ["API returns validation error - special character required"],
        [{ field: "password", operation: "replace", value: "Abcdefg1" }], "medium", method);
    }

    // Email format (only if email referenced)
    if (/email|format.*invalid/i.test(lower)) {
      tryAdd(`${titleBase} - [Negative] Email without @ must be rejected`, "negative", ac,
        ["API returns validation error for invalid email format"],
        [{ field: "email", operation: "replace", value: "invalid-email-at" }], "medium", method);
      tryAdd(`${titleBase} - [Negative] Email without domain must be rejected`, "negative", ac,
        ["API returns validation error for invalid email format"],
        [{ field: "email", operation: "replace", value: "user@" }], "medium", method);
    }

    // Default role (only if role referenced)
    if (/default|role|assign/i.test(lower)) {
      tryAdd(`${titleBase} - [Positive] Default role assignment when role not specified`, "positive", ac,
        ["Account created with default role", "Response includes default role value"],
        [], "low", method);
    }

    // Audit logging (only if audit referenced)
    if (/audit|log|logging/i.test(lower)) {
      tryAdd(`${titleBase} - [Positive] Audit log created for operation`, "positive", ac,
        ["Audit log entry created", "Log contains user ID, timestamp, and origin"],
        [], "low", method);
    }
  }

// 3. Generic edge cases (only if relevant to ticket content)
  const hasSecurity = /password|auth|token|login|security/i.test(description + " " + acceptance.join(" "));
  const hasValidation = /valid|input|data|field/i.test(description + " " + acceptance.join(" "));
  
  if (hasValidation) {
    tryAdd(`${titleBase} - [Edge] Request with empty JSON body rejected`, "negative",
      "Edge case - empty payload", ["API returns 400 validation error"],
      [{ field: "body", operation: "replace", value: {} }], "medium", null);
  }

  if (hasValidation) {
    tryAdd(`${titleBase} - [Edge] Unknown fields handling`, "negative",
      "Edge case - unknown fields", ["API ignores or rejects unknown fields"],
      [{ field: "extraField", operation: "replace", value: "unexpected" }], "low", null);
  }

  // SQL injection/XSS only for text-heavy APIs
  if (/text|message|content|description|name|email/i.test(description + " " + acceptance.join(" "))) {
    tryAdd(`${titleBase} - [Edge] SQL injection prevention`, "negative",
      "Edge case - injection", ["API rejects malicious input", "No SQL error exposed"],
      [{ field: lastDetectedField, operation: "replace", value: "'; DROP TABLE users; --" }], "high", null);
  }

  // 4. AUTH / Security (only if security-related content)
  if (hasSecurity) {
    tryAdd(`${titleBase} - [Auth] Missing authorization rejected`, "auth",
      "Security - missing auth", ["API returns 401 unauthorized"],
      [{ field: "auth", operation: "remove" }], "high", "GET");

    tryAdd(`${titleBase} - [Auth] Invalid token rejected`, "auth",
      "Security - invalid token", ["API returns 401 or 403"],
      [{ field: "auth", operation: "replace", value: "invalid-token" }], "high", "GET");
  }

  return cases;
}

/**
 * Smart endpoint assignment: each test case gets assigned to
 * the SINGLE best-matching endpoint, or none if no match found.
 */
function assignEndpointsToTestCases(testCases, contract) {
  const scenarios = [];
  let counter = 1;
  const endpoints = contract?.endpoints || [];
  const unlinkedCounter = { val: 1 };

  for (const tc of testCases) {
    if (!endpoints.length) {
      // No endpoints at all — create unlinked scenario
      scenarios.push(createUnlinkedScenario(tc, unlinkedCounter));
      continue;
    }

    // Score all endpoints for this test case
    const scored = endpoints.map((ep) => {
      const { score, reasons } = scoreEndpointForTestCase(tc, ep);
      return { endpoint: ep, score, reasons };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // Only assign if score >= minimum threshold of 3 (at least one solid match)
    if (best && best.score >= 3) {
      const ep = best.endpoint;
      const override = {
        title: tc.title,
        type: tc.type || "scenario",
        expectedStatus: tc.type === "positive" ? positiveStatus(ep) : tc.type === "auth" ? authStatus(ep) : negativeStatus(ep),
        assertions: tc.assertions || [],
        mutations: tc.mutations && tc.mutations.length ? tc.mutations : tc.sourceAc ? businessRuleMutation(tc.sourceAc, ep) : [],
        sourceAc: tc.sourceAc || "",
        risk: tc.risk || "medium",
        matchScore: best.score,
        matchReasons: best.reasons,
      };
      scenarios.push(buildScenario(ep, counter++, override));
    } else {
      // No good endpoint match — create unlinked scenario
      scenarios.push(createUnlinkedScenario(tc, unlinkedCounter));
    }
  }

  // Determine which contract endpoints have no TCs assigned
  const usedEndpointIds = new Set(scenarios.filter(s => s.endpointId).map(s => s.endpointId));
  const unusedEndpoints = (contract?.endpoints || []).filter(ep => !usedEndpointIds.has(ep.id));

  return { scenarios, unusedEndpoints };
}

function createUnlinkedScenario(tc, counter) {
  const idx = counter.val++;
  const method = tc.expectedMethod || tc.method || "POST";
  return {
    id: `${tc.id}-UL-${String(idx).padStart(3, "0")}`,
    title: tc.title,
    endpointId: null,
    method,
    path: "/",
    basePayload: {},
    mutations: tc.mutations || [],
    assertions: tc.assertions || [],
    risk: tc.risk || "medium",
    sourceAc: tc.sourceAc || "",
    type: tc.type,
    expectedStatus: tc.type === "positive" ? 200 : tc.type === "auth" ? 401 : 400,
    unlinked: true,
  };
}

async function localGenerate(ticket, contract) {
  const testCases = createTestCasesFromTicket(ticket || {});
  const { scenarios, unusedEndpoints } = assignEndpointsToTestCases(testCases, contract || {});
  return { scenarios, unusedEndpoints };
}

function prioritizeScenarios(scenarios) {
  const riskScores = { high: 3, medium: 2, low: 1 };
  return [...scenarios].sort((a, b) => {
    const aRisk = riskScores[a.risk] || 2;
    const bRisk = riskScores[b.risk] || 2;
    if (bRisk !== aRisk) return bRisk - aRisk;
    // Then by match score (better matches first)
    if ((b.matchScore || 0) !== (a.matchScore || 0)) return (b.matchScore || 0) - (a.matchScore || 0);
    return (a.title || "").localeCompare(b.title || "");
  });
}

async function generateScenarios({ ticket, contract, useAi = false }) {
  const warnings = [];

  let normalizedContract = contract || {};
  try {
    const looksLikeRaw = typeof normalizedContract === 'string' ||
      (normalizedContract && !Array.isArray(normalizedContract.endpoints) &&
       (normalizedContract.openapi || normalizedContract.swagger || normalizedContract.item || normalizedContract.collection));
    if (looksLikeRaw) {
      normalizedContract = parseContract(normalizedContract);
    }
  } catch (err) {
    warnings.push(`Contract parsing failed: ${err.message}`);
    normalizedContract = { endpoints: [] };
  }

  const { scenarios: localScenarios, unusedEndpoints } = await localGenerate(ticket, normalizedContract);
  const prioritized = prioritizeScenarios(localScenarios);

if (!useAi) {
    return {
      mode: "local",
      warnings,
      scenarios: prioritized,
      unusedEndpoints,
    };
  }

  try {
    const enhanced = await enhanceScenarios({ ticket, contract: normalizedContract, localScenarios });
    if (enhanced.usedAi && Array.isArray(enhanced.scenarios) && enhanced.scenarios.length) {
      // Merge: keep all local scenarios (they have endpoints) and add any new AI-only scenarios
      const localTitles = new Set((localScenarios || []).map((s) => (s.title || "").toLowerCase()));
      const newAiScenarios = enhanced.scenarios.filter((s) => !localTitles.has((s.title || "").toLowerCase()));
      const merged = [...localScenarios, ...newAiScenarios];
      return {
        mode: "ai_enhanced",
        warnings: enhanced.warning ? [enhanced.warning] : warnings,
        scenarios: merged,
        unusedEndpoints,
      };
    }
    return {
      mode: "local",
      warnings: enhanced.warning ? [enhanced.warning] : warnings,
      scenarios: localScenarios,
      unusedEndpoints,
    };
  } catch (error) {
    return {
      mode: "local",
      warnings: [`AI enhancement failed, local scenarios were used. ${error.message}`, ...warnings],
      scenarios: localScenarios,
      unusedEndpoints,
    };
  }
}

module.exports = {
  generateScenarios,
};