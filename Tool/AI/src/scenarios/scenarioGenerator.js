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
    acIndex: -1,
    generationSource: "orchestrator",
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
  result.isFormat = /format|pattern|valid|invalid/i.test(lower);
  result.isLength = /length|character|char/i.test(lower);
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

// ─── Legacy: Marked as DEPRECATED - NOT USED in production generation ────────────

/**
 * @deprecated This function is deprecated and should not be used in production.
 * The orchestrator pipeline is the authoritative scenario generation path.
 */
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

  function tryAdd(title, type, sourceAc, assertions, mutations, risk, expectedMethod) {
    const key = dedupKey(type, mutations, assertions, sourceAc);
    if (added.has(key)) return;
    added.add(key);

    cases.push({
      id: `TC-${String(counter++).padStart(3, "0")}`,
      title: title.slice(0, 200),
      type,
      sourceAc: sourceAc || "",
      description,
      assertions: assertions || [],
      mutations: mutations || [],
      risk: risk || "medium",
      expectedMethod: expectedMethod || null,
      traceability: {
        requirementIds: [ticketKey],
        sourceText: titleBase,
      },
    });
  }

  const summaryLower = titleBase.toLowerCase();
  let defaultMethod = detectMethodFromAc(summaryLower);

  // 1. POSITIVE: One happy path
  tryAdd(
    `Verify happy path: Send a valid request with correct data`,
    "positive",
    ticket?.summary || "Happy path",
    ["Returns success status (2xx)"],
    [],
    "low",
    defaultMethod
  );

  // 2. For each acceptance criterion
  for (const rawAc of acceptance.slice(0, 10)) {
    const ac = cleanAcceptanceItem(rawAc);
    if (!ac) continue;
    const constraint = detectAcConstraintType(ac);
    const method = detectMethodFromAc(ac) || defaultMethod;

    if (!constraint.isConstraint) {
      tryAdd(`Verify: ${ac} — should succeed`, "positive", rawAc, ["Verify"], [], "low", method);
    }
    if (constraint.isRequired) {
      tryAdd(`Negative — Missing required`, "negative", rawAc, ["400 error"], [{ field: "field", operation: "remove" }], "medium", method);
    }
  }

  return cases;
}

// ─── Endpoint assignment (Matching Engine) ───────────────────────────────

function assignEndpointsToTestCases(testCases, contract, requirements = []) {
  const endpoints = contract?.endpoints || [];
  const unlinkedCounter = { val: 1 };
  let scenarioCounter = 1;

  if (!endpoints.length) {
    return {
      scenarios: testCases.map((tc) => createUnlinkedScenario(tc, unlinkedCounter)),
      unusedEndpoints: [],
    };
  }

  const { scenarioAssignments } = matchTestCases(testCases, endpoints, {
    requirements,
    maxCandidates: 20,
  });

  const scenarios = [];

  for (const tc of testCases) {
    const assignment = scenarioAssignments.get(tc.id);

    if (assignment && assignment.endpointId && !assignment.needsHumanReview) {
      const ep = assignment.endpoint;
      scenarios.push(buildScenario(ep, scenarioCounter++, {
        title: tc.title,
        type: tc.type || "scenario",
        expectedStatus: tc.type === "positive" ? positiveStatus(ep) : tc.type === "auth" ? authStatus(ep) : negativeStatus(ep),
        assertions: tc.assertions || [],
        sourceAc: tc.sourceAc || "",
        acIndex: tc.acIndex ?? -1,
        risk: tc.risk || "medium",
        generationSource: tc.generationSource || "orchestrator",
      }));
    } else if (assignment && assignment.needsHumanReview && assignment.endpointId) {
      const ep = assignment.endpoint;
      scenarios.push(buildScenario(ep, scenarioCounter++, {
        title: tc.title,
        type: tc.type || "scenario",
        expectedStatus: tc.type === "positive" ? positiveStatus(ep) : tc.type === "auth" ? authStatus(ep) : negativeStatus(ep),
        assertions: tc.assertions || [],
        sourceAc: tc.sourceAc || "",
        acIndex: tc.acIndex ?? -1,
        risk: tc.risk || "medium",
        generationSource: tc.generationSource || "orchestrator",
        matchNeedsReview: true,
        needsHumanReview: true,
      }));
    } else {
      scenarios.push(createUnlinkedScenario(tc, unlinkedCounter));
    }
  }

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
    path: tc.pathHint || "/",
    basePayload: {},
    mutations: tc.mutations || [],
    assertions: tc.assertions || [],
    risk: tc.risk || "medium",
    sourceAc: tc.sourceAc || "",
    acIndex: tc.acIndex ?? -1,
    type: tc.type,
    generationSource: tc.generationSource || "orchestrator",
    expectedStatus: tc.type === "positive" ? 200 : tc.type === "auth" ? 401 : 400,
    unlinked: true,
  };
}

// ─── Orchestrator-based generation (Authoritative Path) ───────────────────────────

const { runPipeline } = require("../engine/orchestrator");
const { GenerationModes } = require("../engine/types");

function orchestratorGenerate(ticket, contract) {
  const pipelineResult = runPipeline(ticket || {}, GenerationModes.STANDARD);

  const testCases = (pipelineResult.testCases || []).map(tc => ({
    ...tc,
    generationSource: "orchestrator",
  }));

  const adaptedTestCases = testCases.map(tc => ({
    id: tc.testCaseId,
    title: tc.title || "Untitled",
    type: mapCategoryToType(tc.classification?.category),
    sourceAc: tc.traceability?.originalAc || tc.description || "",
    description: tc.description || "",
    assertions: tc.expected?.bodyAssertions || [],
    mutations: tc.request?.mutation ? [tc.request.mutation] : [],
    risk: mapConfidenceToRisk(tc.classification?.confidence, tc.classification?.origin),
    expectedMethod: tc.request?.method || tc.methodHint || null,
    pathHint: tc.request?.endpoint || tc.pathHint || null,
    acIndex: tc.traceability?.acIndex ?? -1,
    generationSource: tc.generationSource,
    traceability: {
      requirementIds: tc.traceability?.requirementIds || [],
      acIndex: tc.traceability?.acIndex ?? -1,
    },
  }));

  const { scenarios, unusedEndpoints } = assignEndpointsToTestCases(adaptedTestCases, contract || {}, pipelineResult.requirements || []);

  return { scenarios, unusedEndpoints, requirementGaps: pipelineResult.requirementGaps, summary: pipelineResult.summary };
}

function mapCategoryToType(category) {
  const map = {
    "POSITIVE": "positive",
    "NEGATIVE": "negative",
    "BOUNDARY": "negative",
    "EDGE": "negative",
    "SECURITY": "auth",
  };
  return map[category] || "positive";
}

function mapConfidenceToRisk(confidence, origin) {
  if (origin === "EXPLICIT") return "high";
  if (origin === "DERIVED") return "medium";
  return "low";
}

function prioritizeScenarios(scenarios) {
  const riskScores = { high: 3, medium: 2, low: 1 };
  return [...scenarios].sort((a, b) => {
    const aRisk = riskScores[a.risk] || 2;
    const bRisk = riskScores[b.risk] || 2;
    if (bRisk !== aRisk) return bRisk - aRisk;
    return (a.title || "").localeCompare(b.title || "");
  });
}

// ─── AI-first hybrid generation ───────────────────────────────────────────

const { generateWithAi, isAiAvailable } = require("../engine/aiTestDesigner");
const { validateAiGeneratedTestCases } = require("../engine/deterministicValidator");
const { adaptAiTestCasesToScenarios } = require("../engine/scenarioAdapter");

async function generateScenarios({ ticket, contract, useAi = null }) {
  const warnings = [];
  const generationMeta = {
    mode: "deterministic_fallback",
    model: null,
    attempts: null,
    fallbackReason: null,
  };

  // Normalize contract
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

  // STEP 9L.2C-2: AI-first with deterministic fallback
  // AI is primary when configured and available
  const shouldAttemptAi = isAiAvailable();

  if (shouldAttemptAi) {
    const startTime = Date.now();
    const aiResult = await generateWithAi(ticket, normalizedContract);

    if (aiResult.success && aiResult.testCases && aiResult.testCases.length > 0) {
      // Validate AI output against contract
      const validated = validateAiGeneratedTestCases(aiResult.testCases, normalizedContract);

      // Get valid scenarios (VALID or VALID_WITH_WARNINGS)
      const validTests = validated.filter(
        (tc) => tc.validation.status === "VALID" || tc.validation.status === "VALID_WITH_WARNINGS"
      );

      if (validTests.length > 0) {
        // AI succeeded with usable output
        const scenarios = adaptAiTestCasesToScenarios(validTests, normalizedContract);
        const prioritized = prioritizeScenarios(scenarios);

        generationMeta.mode = "ai_primary";
        generationMeta.model = aiResult.model;
        generationMeta.attempts = aiResult.attempts;

        return {
          mode: generationMeta.mode,
          warnings,
          scenarios: prioritized,
          unusedEndpoints: [],
          generationMeta,
        };
      }

      // AI returned output but all tests rejected - fallback with warning
      generationMeta.fallbackReason = "All AI scenarios rejected by contract validation";
      warnings.push(`AI generated ${validated.length} scenarios but all were rejected`);
    } else {
      generationMeta.fallbackReason = aiResult.reason || "Unknown AI error";
      warnings.push(`AI generation unavailable: ${aiResult.reason}`);
    }
  } else {
    generationMeta.fallbackReason = "AI provider not configured";
  }

  // Deterministic fallback
  const { scenarios: orchestratorScenarios, unusedEndpoints, requirementGaps, summary } =
    orchestratorGenerate(ticket, normalizedContract);
  const prioritized = prioritizeScenarios(orchestratorScenarios);

  return {
    mode: generationMeta.mode,
    warnings,
    scenarios: prioritized,
    unusedEndpoints,
    generationMeta,
  };
}

// Re-export createSampleValue from contractParser for backwards compat
const { createSampleValue } = require("../contracts/contractParser");

module.exports = {
  generateScenarios,
  createTestCasesFromTicket,
};