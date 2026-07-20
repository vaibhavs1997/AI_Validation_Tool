/**
 * Scenario Generator — Fully Domain-Agnostic
 *
 * Generates API validation scenarios entirely from:
 *   - The uploaded Postman/OpenAPI contract structure (endpoints, schemas, parameters)
 *   - The Jira ticket text (acceptance criteria, description)
 *
 * No business-domain knowledge is hardcoded. All field names, values, patterns,
 * and behaviors are discovered dynamically from the input.
 *
 * The SAME code works for Banking, Healthcare, E-commerce, CRM, IoT, etc.
 * without any code changes.
 */

const { parseContract } = require("../contracts/contractParser");
const { matchTestCases } = require("../engine/matching/matchingEngine");

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "should",
  "when", "then", "user", "api", "able", "only", "will", "must",
  "into", "have", "has",
]);

// Protocol-level: HTTP methods are standard, not domain-specific
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

function keywords(text) {
  return new Set(words(text));
}

// ─── Endpoint scoring ─────────────────────────────────────────────────────

function scoreEndpointForTestCase(tc, endpoint) {
  const tcText = [tc.title, tc.sourceAc, tc.description, ...(tc.assertions || [])].join(" ").toLowerCase();
  const tcWords = keywords(tcText);
  const epPath = (endpoint.path || "").toLowerCase();
  const epMethod = (endpoint.method || "").toUpperCase();
  const epWords = keywords([endpoint.path, endpoint.summary, endpoint.description, endpoint.operationId, ...(endpoint.tags || [])].join(" "));
  const reasons = [];
  let score = 0;

  // 1. HTTP method match from the ticket context
  const tcMethod = detectMethod(tc);
  if (tcMethod && tcMethod === epMethod) {
    score += 10;
    reasons.push(`method:${epMethod}`);
  } else if (tcMethod && tcMethod !== epMethod) {
    score -= 5;
  }

  // 2. Path segment matching
  const pathSegments = epPath.split("/").filter(Boolean);
  for (const segment of pathSegments) {
    const cleanSeg = segment.replace(/[{}]/g, "");
    if (tcWords.has(cleanSeg)) {
      score += 8;
      reasons.push(`path:${cleanSeg}`);
    }
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

function detectMethod(tc) {
  const title = tc.title.toLowerCase();
  for (const [action, method] of Object.entries(ACTION_TO_METHOD)) {
    if (title.includes(action)) return method;
  }
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

// ─── Schema utilities ─────────────────────────────────────────────────────

function firstField(schema) {
  const properties = schema?.properties || {};
  return Object.keys(properties)[0] || "";
}

function numericFields(schema, prefix = "") {
  const out = [];
  for (const [key, child] of Object.entries(schema?.properties || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    const type = Array.isArray(child.type) ? child.type[0] : child.type;
    if (["number", "integer"].includes(type)) out.push({ path, schema: child });
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

// ─── Domain-agnostic mutation derivation ─────────────────────────────────

function deriveMutationFromRule(rule, endpoint) {
  const schema = endpoint?.requestSchema;
  const nums = numericFields(schema);
  const field = nums[0]?.path || firstField(schema) || "field";
  const lower = rule.toLowerCase();

  if (/greater|exceed|more than|maximum|max/i.test(lower)) {
    return [{ field, operation: "boundaryMax", value: 999999999 }];
  }
  if (/less|minimum|min|negative/i.test(lower)) {
    return [{ field, operation: "boundaryMin", value: -1 }];
  }
  if (/required|mandatory|must provide/i.test(lower)) {
    return [{ field, operation: "remove" }];
  }
  if (/invalid|not allowed|cannot|should not/i.test(lower)) {
    return [{ field, operation: "invalidType" }];
  }
  if (/duplicate|already exists|unique/i.test(lower)) {
    return [{ field, operation: "duplicate" }];
  }
  if (/length|character|char|min|max/i.test(lower)) {
    return [{ field, operation: "boundary", value: "edge-case-value" }];
  }
  if (/format|pattern|valid/i.test(lower)) {
    return [{ field, operation: "invalidFormat" }];
  }
  return field ? [{ field, operation: "replace", value: "rule-violation-value" }] : [];
}

// ─── Domain-agnostic AC text analysis ────────────────────────────────────

function detectAcConstraintType(ac) {
  const lower = ac.toLowerCase();
  const result = { isConstraint: false, isBoundary: false, isRequired: false, isUnique: false };

  result.isConstraint = /invalid|error|fail|reject|not|cannot|missing|duplicate|already|mandatory|required|only\s*for|must\s*(be|not)|cannot\s*exceed/i.test(lower);
  result.isRequired = /required|mandatory|missing/i.test(lower);
  result.isUnique = /unique|already exists|duplicate/i.test(lower);
  result.isBoundary = /greater than|less than|minimum|maximum|exceed|greater than zero/i.test(lower);
  result.isRange = /range|between|up to|no more|no less/i.test(lower);
  result.isFormat = /format|pattern|valid|invalid/i.test(lower);
  result.isLength = /length|character|char/i.test(lower);
  result.isEmail = /email/i.test(lower);
  result.isAuth = /auth|token|login|password|credential|authentication/i.test(lower);

  return result;
}

function detectMethodFromAc(ac) {
  const lower = ac.toLowerCase();
  if (/create|add|submit|register/i.test(lower)) return "POST";
  if (/get|fetch|retrieve|list|search/i.test(lower)) return "GET";
  if (/update|edit|change|modify/i.test(lower)) return "PUT";
  if (/delete|remove|cancel/i.test(lower)) return "DELETE";
  if (/login|auth|token/i.test(lower)) return "POST";
  return null;
}

function cleanAcceptanceItem(item) {
  if (!item) return "";
  let s = String(item);
  s = s.replace(/^(?:\s*AC(?:'s)?s?|\s*ACs|\s*Acceptance Criteria)\s*[:\-\.\s]*/i, "");
  s = s.replace(/^[-*\s\d\.)]+/, "");
  return s.trim();
}

// ─── Domain-agnostic test case generation ────────────────────────────────

function createTestCasesFromTicket(ticket) {
  const cases = [];
  let counter = 1;
  const titleBase = ticket?.summary || "API validation";
  const acceptance = ticket?.acceptanceCriteria || [];
  const description = ticket?.description || "";
  const ticketKey = ticket?.key || "REQUIREMENT";

  const added = new Set();

  function dedupKey(type, mutations, assertions, sourceAc) {
    const mutSig = (mutations || []).map(m => `${m.operation}:${m.field}:${JSON.stringify(m.value)}`).sort().join(",");
    const asrtSig = (assertions || []).join("|");
    return `${type}|${mutSig}|${asrtSig}|${sourceAc || ""}`;
  }

  function tryAdd(title, type, sourceAc, assertions, mutations, risk, expectedMethod, fieldName) {
    const key = dedupKey(type, mutations, assertions, sourceAc);
    if (added.has(key)) return;
    added.add(key);

    const mutationDesc = (mutations || []).map(m => `${m.operation}`).join(", ");
    const finalTitle = title.length > 200 ? title.slice(0, 197) + "..." : title;

    cases.push({
      id: `TC-${String(counter++).padStart(3, "0")}`,
      title: finalTitle,
      type,
      sourceAc: sourceAc || "",
      description,
      assertions: assertions || [],
      mutations: mutations || [],
      risk: risk || "medium",
      expectedMethod: expectedMethod || null,
      precondition: null,
      expectedOutcome: null,
      // Add traceability for matching engine grouping
      traceability: {
        requirementIds: [ticketKey],
        sourceText: titleBase,
        acceptanceCriterion: sourceAc || "",
      },
    });
  }

  // Determine overall method from ticket summary
  const summaryLower = titleBase.toLowerCase();
  let defaultMethod = detectMethodFromAc(summaryLower);

  // 1. POSITIVE: One happy path using valid data (no mutations)
  tryAdd(
    `Verify happy path: Send a valid request with correct data and confirm the API returns a successful response`,
    "positive",
    ticket?.summary || "Happy path",
    ["Returns success status (2xx)", "Response contains expected resource data"],
    [],
    "low",
    defaultMethod
  );

  // 2. For each acceptance criterion, generate domain-agnostic test scenarios
  for (const rawAc of acceptance.slice(0, 10)) {
    const ac = cleanAcceptanceItem(rawAc);
    if (!ac) continue;

    const constraint = detectAcConstraintType(ac);
    const method = detectMethodFromAc(ac) || defaultMethod;

    // POSITIVE scenario: only if this AC is NOT a constraint
    if (!constraint.isConstraint) {
      tryAdd(
        `Verify: ${ac.length > 120 ? ac.slice(0, 120) + "..." : ac} — should succeed`,
        "positive",
        rawAc,
        [`Verify: ${ac}`],
        [],
        "low",
        method
      );
    }

    // NEGATIVE scenarios based on detected constraint type
    if (constraint.isRequired) {
      tryAdd(
        `Negative — Missing required field as per: "${ac.slice(0, 80)}"`,
        "negative",
        rawAc,
        ["API returns validation error (400/422) indicating the missing field"],
        [{ field: "field", operation: "remove" }],
        "medium",
        method
      );
      tryAdd(
        `Negative — Empty required field as per: "${ac.slice(0, 80)}"`,
        "negative",
        rawAc,
        ["API returns validation error for empty field"],
        [{ field: "field", operation: "replace", value: "" }],
        "medium",
        method
      );
    }

    if (constraint.isUnique) {
      tryAdd(
        `Negative — Duplicate request rejected as per: "${ac.slice(0, 80)}"`,
        "negative",
        rawAc,
        ["API returns 409 conflict", "Error indicates duplicate resource"],
        [{ field: "field", operation: "duplicate" }],
        "high",
        method
      );
    }

    if (constraint.isBoundary) {
      tryAdd(
        `Negative — Value below minimum as per: "${ac.slice(0, 80)}"`,
        "negative",
        rawAc,
        ["API returns validation error for out-of-range value"],
        [{ field: "field", operation: "boundaryMin", value: -1 }],
        "medium",
        method
      );
      tryAdd(
        `Negative — Value exceeding maximum as per: "${ac.slice(0, 80)}"`,
        "negative",
        rawAc,
        ["API returns validation error for exceeded limit"],
        [{ field: "field", operation: "boundaryMax", value: 999999999 }],
        "medium",
        method
      );
    }

    if (constraint.isFormat && constraint.isEmail) {
      // Email format is protocol-level standard (RFC 5321/5322)
      // We still generate from the text pattern, not from domain knowledge
      tryAdd(
        `Negative — Invalid format as per: "${ac.slice(0, 80)}"`,
        "negative",
        rawAc,
        ["API returns validation error for invalid format"],
        [{ field: "field", operation: "invalidType" }],
        "medium",
        method
      );
    } else if (constraint.isFormat) {
      tryAdd(
        `Negative — Invalid format as per: "${ac.slice(0, 80)}"`,
        "negative",
        rawAc,
        ["API returns validation error for invalid format"],
        [{ field: "field", operation: "invalidType" }],
        "medium",
        method
      );
    }

    if (constraint.isLength) {
      tryAdd(
        `Negative — Exceed maximum length as per: "${ac.slice(0, 80)}"`,
        "negative",
        rawAc,
        ["API returns validation error for exceeding length"],
        [{ field: "field", operation: "maxLengthExceeded", length: 999 }],
        "medium",
        method
      );
    }

    // General rejection: "not allowed", "cannot", "reject"
    if (constraint.isConstraint && !constraint.isRequired && !constraint.isUnique && !constraint.isBoundary) {
      tryAdd(
        `Negative — Invalid input as per: "${ac.slice(0, 80)}"`,
        "negative",
        rawAc,
        [`API rejects invalid request`],
        [{ field: "field", operation: "invalidType" }],
        "medium",
        method
      );
    }
  }

  // 3. Generic negative/edge cases — domain agnostic
  const hasBodyContent = /data|field|input|payload|json|body/i.test(description + " " + acceptance.join(" "));
  const hasAuthContent = /auth|token|login|password|credential|authentication|session/i.test(description + " " + acceptance.join(" "));

  if (hasBodyContent) {
    tryAdd(`Edge case: Empty JSON body rejected`, "negative",
      "Edge case - empty payload", ["API returns validation error"],
      [{ field: "body", operation: "replace", value: {} }], "medium", null);
  }

  if (hasBodyContent) {
    tryAdd(`Edge case: Unknown/extra fields in payload`, "negative",
      "Edge case - unknown fields", ["API ignores or rejects unknown fields"],
      [{ field: "extraField", operation: "replace", value: "unexpected" }], "low", null);
  }

  // 4. Auth/Security — only when auth is mentioned in ticket
  if (hasAuthContent) {
    tryAdd(`Security: Missing authentication rejected`, "auth",
      "Security - missing auth", ["API returns 401 unauthorized"],
      [{ field: "auth", operation: "remove" }], "high", "GET");

    tryAdd(`Security: Invalid authentication rejected`, "auth",
      "Security - invalid token", ["API returns 401 or 403"],
      [{ field: "auth", operation: "replace", value: "invalid-token" }], "high", "GET");
  }

  return cases;
}

// ─── Endpoint assignment (Matching Engine) ───────────────────────────────

function assignEndpointsToTestCases(testCases, contract) {
  const endpoints = contract?.endpoints || [];
  const unlinkedCounter = { val: 1 };
  let scenarioCounter = 1;

  if (!endpoints.length) {
    // No endpoints — create unlinked scenarios for all
    return {
      scenarios: testCases.map((tc) => createUnlinkedScenario(tc, unlinkedCounter)),
      unusedEndpoints: [],
    };
  }

  // Run the intelligent matching engine
  const { scenarioAssignments, results } = matchTestCases(testCases, endpoints, {
    maxCandidates: 20,
  });

  const scenarios = [];

  for (const tc of testCases) {
    const assignment = scenarioAssignments.get(tc.id);

    if (assignment && assignment.endpointId && !assignment.needsHumanReview) {
      // Good match — use the matched endpoint
      const ep = assignment.endpoint;
      if (ep) {
        const override = {
          title: tc.title,
          type: tc.type || "scenario",
          expectedStatus: tc.type === "positive" ? positiveStatus(ep) : tc.type === "auth" ? authStatus(ep) : negativeStatus(ep),
          assertions: tc.assertions || [],
          mutations: tc.mutations && tc.mutations.length ? tc.mutations : tc.sourceAc ? deriveMutationFromRule(tc.sourceAc, ep) : [],
          sourceAc: tc.sourceAc || "",
          risk: tc.risk || "medium",
          matchScore: Math.round(assignment.confidence * 100),
          matchReasons: assignment.reviewReasons || [],
          matchConfidence: assignment.confidenceLevel,
          matchAmbiguous: assignment.ambiguous,
          matchNeedsReview: assignment.needsHumanReview,
        };
        scenarios.push(buildScenario(ep, scenarioCounter++, override));
      } else {
        scenarios.push(createUnlinkedScenario(tc, unlinkedCounter));
      }
    } else if (assignment && assignment.needsHumanReview && assignment.endpointId) {
      // Low confidence but still has a suggested endpoint — attach with review flag
      const ep = assignment.endpoint;
      if (ep) {
        const override = {
          title: tc.title,
          type: tc.type || "scenario",
          expectedStatus: tc.type === "positive" ? positiveStatus(ep) : tc.type === "auth" ? authStatus(ep) : negativeStatus(ep),
          assertions: tc.assertions || [],
          mutations: tc.mutations && tc.mutations.length ? tc.mutations : tc.sourceAc ? deriveMutationFromRule(tc.sourceAc, ep) : [],
          sourceAc: tc.sourceAc || "",
          risk: tc.risk || "medium",
          matchScore: Math.round(assignment.confidence * 100),
          matchReasons: assignment.reviewReasons || [],
          matchConfidence: assignment.confidenceLevel,
          matchAmbiguous: assignment.ambiguous,
          matchNeedsReview: true,
          needsHumanReview: true,
        };
        scenarios.push(buildScenario(ep, scenarioCounter++, override));
      } else {
        scenarios.push(createUnlinkedScenario(tc, unlinkedCounter));
      }
    } else {
      // No match — unlinked
      scenarios.push(createUnlinkedScenario(tc, unlinkedCounter));
    }
  }

  // Compute unused endpoints
  const matchedEpIds = new Set(scenarios.filter((s) => s.endpointId).map((s) => s.endpointId));
  const unusedEndpoints = endpoints.filter((ep) => !matchedEpIds.has(ep.id));

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

  // AI enhancement path — kept for backwards compatibility
  return {
    mode: "local",
    warnings: [...warnings, "AI enhancement requires llmClient integration."],
    scenarios: prioritized,
    unusedEndpoints,
  };
}

// Re-export createSampleValue from contractParser for backwards compat
const { createSampleValue } = require("../contracts/contractParser");

module.exports = {
  generateScenarios,
};
