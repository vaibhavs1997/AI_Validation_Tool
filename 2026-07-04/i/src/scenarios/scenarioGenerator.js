const { createSampleValue, parseContract } = require("../contracts/contractParser");
const { enhanceScenarios } = require("../integrations/llmClient");

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "should",
  "when",
  "then",
  "user",
  "api",
  "able",
  "only",
  "will",
  "must",
  "into",
  "have",
  "has",
]);

function words(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9/{}_-]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function endpointScore(ticketText, endpoint) {
  const ticketWords = new Set(words(ticketText));
  const endpointWords = words(
    [endpoint.path, endpoint.summary, endpoint.description, endpoint.operationId, ...(endpoint.tags || [])].join(" ")
  );
  return endpointWords.reduce((score, word) => score + (ticketWords.has(word) ? 1 : 0), 0);
}

function relevantEndpoints(ticket, contract) {
  const text = [
    ticket?.summary,
    ticket?.description,
    ...(ticket?.acceptanceCriteria || []),
  ].join(" ");

  const scored = (contract.endpoints || []).map((endpoint) => ({
    endpoint,
    score: endpointScore(text, endpoint),
  }));

  scored.sort((a, b) => b.score - a.score);
  const matched = scored.filter((item) => item.score > 0).map((item) => item.endpoint);
  return (matched.length ? matched : scored.map((item) => item.endpoint)).slice(0, 5);
}

function positiveStatus(endpoint) {
  const statuses = Object.keys(endpoint.responses || {});
  return statuses.find((status) => ["200", "201", "202", "204"].includes(status)) || statuses.find((status) => /^2/.test(status)) || 200;
}

function negativeStatus(endpoint) {
  const statuses = Object.keys(endpoint.responses || {});
  return statuses.find((status) => ["400", "422", "409"].includes(status)) || 400;
}

function authStatus(endpoint) {
  const statuses = Object.keys(endpoint.responses || {});
  return statuses.find((status) => ["401", "403"].includes(status)) || 401;
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

function requiredFields(schema, prefix = "") {
  const out = [];
  for (const field of schema?.required || []) {
    out.push(prefix ? `${prefix}.${field}` : field);
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
  return field ? [{ field, operation: "replace", value: "rule-violation-value" }] : [];
}

// New: create test cases based on Jira ticket only
function createTestCasesFromTicket(ticket) {
  const cases = [];
  let counter = 1;
  const titleBase = ticket?.summary || ticket?.description || "Manual test case";

  // Happy path
  cases.push({
    id: `TC-${String(counter++).padStart(3, "0")}`,
    title: `${titleBase} - happy path`,
    type: "positive",
    sourceAc: ticket?.summary || "",
    description: ticket?.description || "",
    assertions: ["Primary acceptance criteria"],
    mutations: [],
  });

  // Acceptance criteria driven cases
  const acceptance = ticket?.acceptanceCriteria || [];
  for (const rule of acceptance.slice(0, 10)) {
    const tc = {
      id: `TC-${String(counter++).padStart(3, "0")}`,
      title: rule.length > 90 ? rule.slice(0, 90) : rule,
      type: /not|cannot|invalid|only|exceed|less|greater/i.test(rule) ? "negative" : "positive",
      sourceAc: rule,
      description: ticket?.description || "",
      assertions: [`Acceptance criterion: ${rule}`],
      mutations: [],
    };
    cases.push(tc);
  }

  // Security/auth related
  cases.push({
    id: `TC-${String(counter++).padStart(3, "0")}`,
    title: `${titleBase} - missing authorization`,
    type: "auth",
    authMode: "missing",
    sourceAc: "Security",
    description: ticket?.description || "",
    assertions: ["API rejects unauthenticated request"],
    mutations: [],
  });

  // Invalid payload example
  cases.push({
    id: `TC-${String(counter++).padStart(3, "0")}`,
    title: `${titleBase} - invalid payload type`,
    type: "negative",
    sourceAc: "Derived",
    description: ticket?.description || "",
    assertions: ["API returns validation error for invalid type"],
    mutations: [],
  });

  return cases;
}

function assignEndpointsToTestCases(testCases, contract, maxPerCase = 3) {
  const scenarios = [];
  let counter = 1;
  const endpoints = contract?.endpoints || [];

  for (const tc of testCases) {
    // Score endpoints against the test case text
    const text = [tc.title, tc.description, tc.sourceAc, ...(tc.assertions || [])].join(" ");
    const scored = endpoints.map((endpoint) => ({ endpoint, score: endpointScore(text, endpoint) }));
    scored.sort((a, b) => b.score - a.score);
    const matched = scored.filter((s) => s.score > 0).map((s) => s.endpoint);
    const chosen = (matched.length ? matched : endpoints.slice(0, 1)).slice(0, maxPerCase);

    if (!chosen.length) {
      // No endpoints available: create a single scenario without an endpointId
      scenarios.push({
        id: `${tc.id}-NOEP`,
        title: tc.title,
        endpointId: null,
        method: tc.method || "GET",
        path: tc.path || "/",
        basePayload: {},
        mutations: tc.mutations || [],
        assertions: tc.assertions || [],
        risk: tc.risk || "medium",
        sourceAc: tc.sourceAc || "",
      });
      continue;
    }

    for (const endpoint of chosen) {
      const override = {
        title: tc.title,
        type: tc.type,
        expectedStatus: tc.type === "positive" ? positiveStatus(endpoint) : tc.type === "auth" ? authStatus(endpoint) : negativeStatus(endpoint),
        assertions: tc.assertions || [],
        mutations: tc.mutations && tc.mutations.length ? tc.mutations : tc.sourceAc ? businessRuleMutation(tc.sourceAc, endpoint) : [],
        sourceAc: tc.sourceAc || "",
      };
      scenarios.push(buildScenario(endpoint, counter++, override));
    }
  }

  return scenarios;
}

async function localGenerate(ticket, contract) {
  // Create test cases based on Jira ticket only
  const testCases = createTestCasesFromTicket(ticket || {});
  // Assign contract endpoints to those test cases and produce per-endpoint scenarios
  const scenarios = assignEndpointsToTestCases(testCases, contract || {});
  return scenarios;
}

async function generateScenarios({ ticket, contract, useAi = false }) {
  const warnings = [];

  // Normalize contract: if a raw OpenAPI/Postman object was passed, parse it
  let normalizedContract = contract || {};
  try {
    const looksLikeRaw = normalizedContract && !Array.isArray(normalizedContract.endpoints) && (normalizedContract.openapi || normalizedContract.swagger || normalizedContract.item || normalizedContract.collection);
    if (looksLikeRaw) {
      normalizedContract = parseContract(normalizedContract);
    }
  } catch (err) {
    warnings.push(`Contract parsing failed: ${err.message}`);
    normalizedContract = { endpoints: [] };
  }

  // Generate local scenarios from Jira test cases and assign endpoints
  const localScenarios = await localGenerate(ticket, normalizedContract);

  if (!useAi) {
    return {
      mode: "local",
      warnings,
      scenarios: localScenarios,
    };
  }

  try {
    const enhanced = await enhanceScenarios({ ticket, contract: normalizedContract, localScenarios });
    return {
      mode: enhanced.usedAi ? "ai_enhanced" : "local",
      warnings: enhanced.warning ? [enhanced.warning] : warnings,
      scenarios: enhanced.scenarios,
    };
  } catch (error) {
    return {
      mode: "local",
      warnings: [`AI enhancement failed, local scenarios were used. ${error.message}`, ...warnings],
      scenarios: localScenarios,
    };
  }
}

module.exports = {
  generateScenarios,
};
