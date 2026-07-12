const { createSampleValue } = require("../contracts/contractParser");
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
  const schema = endpoint.requestSchema;
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

function localGenerate(ticket, contract) {
  const endpoints = relevantEndpoints(ticket, contract);
  const scenarios = [];
  let counter = 1;

  for (const endpoint of endpoints) {
    scenarios.push(
      buildScenario(endpoint, counter++, {
        title: `${endpoint.method} ${endpoint.path} accepts a valid request`,
        type: "positive",
        expectedStatus: positiveStatus(endpoint),
        assertions: ["Response matches success contract", "Business operation is completed"],
        risk: "high",
      })
    );

    const required = requiredFields(endpoint.requestSchema);
    for (const field of required.slice(0, 4)) {
      scenarios.push(
        buildScenario(endpoint, counter++, {
          title: `Missing required field: ${field}`,
          type: "negative",
          expectedStatus: negativeStatus(endpoint),
          mutations: [{ field, operation: "remove" }],
          assertions: [`API returns a validation error for missing ${field}`],
          sourceAc: "Request schema",
        })
      );
    }

    const field = firstField(endpoint.requestSchema);
    if (field) {
      scenarios.push(
        buildScenario(endpoint, counter++, {
          title: `Invalid data type for ${field}`,
          type: "negative",
          expectedStatus: negativeStatus(endpoint),
          mutations: [{ field, operation: "invalidType" }],
          assertions: [`API rejects invalid type for ${field}`],
          sourceAc: "Request schema",
        })
      );
    }

    for (const numeric of numericFields(endpoint.requestSchema).slice(0, 2)) {
      scenarios.push(
        buildScenario(endpoint, counter++, {
          title: `Boundary validation for ${numeric.path}`,
          type: "boundary",
          expectedStatus: negativeStatus(endpoint),
          mutations: [{ field: numeric.path, operation: "boundaryMin", value: numeric.schema.minimum ?? -1 }],
          assertions: [`API enforces boundary rules for ${numeric.path}`],
          sourceAc: "Boundary validation",
        })
      );
    }

    scenarios.push(
      buildScenario(endpoint, counter++, {
        title: `Missing authorization for ${endpoint.method} ${endpoint.path}`,
        type: "auth",
        authMode: "missing",
        expectedStatus: authStatus(endpoint),
        assertions: ["API rejects unauthenticated request"],
        risk: "high",
        sourceAc: "Security validation",
      })
    );
  }

  const acceptanceCriteria = ticket?.acceptanceCriteria || [];
  for (const rule of acceptanceCriteria.slice(0, 10)) {
    const endpoint = endpoints[0];
    if (!endpoint) break;
    scenarios.push(
      buildScenario(endpoint, counter++, {
        title: `Business rule: ${rule.slice(0, 90)}`,
        type: "business_rule",
        expectedStatus: /not|cannot|invalid|only|exceed|less|greater/i.test(rule) ? negativeStatus(endpoint) : positiveStatus(endpoint),
        mutations: businessRuleMutation(rule, endpoint),
        assertions: [`Acceptance criterion is satisfied: ${rule}`],
        sourceAc: rule,
        risk: "high",
      })
    );
  }

  return scenarios;
}

async function generateScenarios({ ticket, contract, useAi = false }) {
  if (!contract?.endpoints?.length) {
    throw new Error("No endpoints found in the API contract.");
  }

  const localScenarios = localGenerate(ticket, contract);
  const warnings = [];

  if (!useAi) {
    return {
      mode: "local",
      warnings,
      scenarios: localScenarios,
    };
  }

  try {
    const enhanced = await enhanceScenarios({ ticket, contract, localScenarios });
    return {
      mode: enhanced.usedAi ? "ai_enhanced" : "local",
      warnings: enhanced.warning ? [enhanced.warning] : warnings,
      scenarios: enhanced.scenarios,
    };
  } catch (error) {
    return {
      mode: "local",
      warnings: [`AI enhancement failed, local scenarios were used. ${error.message}`],
      scenarios: localScenarios,
    };
  }
}

module.exports = {
  generateScenarios,
};
