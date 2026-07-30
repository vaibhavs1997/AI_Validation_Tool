/**
 * TestGenerationService
 *
 * AI service to suggest executable tests from approved requirements, scenarios, mappings, knowledge, and API catalog.
 * Uses existing llmClient for AI interactions.
 *
 * No persistence side-effects.
 */

const { isConfigured } = require("../integrations/llmClient");

function buildPrompt({ requirements, scenarios, mappings, knowledge, apiCatalog }) {
  return [
    "You are generating executable API test cases from approved requirements, validation scenarios, implementation mappings, project knowledge, and API catalog.",
    "Inputs:",
    "- Approved Requirements",
    "- Approved Validation Scenarios",
    "- Approved Implementation Mappings",
    "- Project Knowledge",
    "- API Catalog (services and operations)",
    "",
    "For each implementation mapping, suggest 1 executable test. Each test MUST include:",
    "- title: short test title",
    "- description: what this test verifies",
    "- scenario: the scenario being tested",
    "- mappedApis: array of API operations with serviceId, operationId, method, path",
    "- executionSteps: ordered steps with description, operationRef, headers, body",
    "- headers: default headers for the test",
    "- variables: variables used in the test",
    "- requestBody: sample request body if applicable",
    "- assertions: array of assertions with type, field, expected, operator",
    "- expectedStatusCode: expected HTTP status code",
    "- expectedResponse: sample expected response",
    "- dependencies: array of dependency descriptions",
    "- priority: low, medium, high, critical",
    "- confidence: 0-1",
    "",
    "Return ONLY valid JSON. No markdown, no code fences, no extra text.",
    "Format: { proposals: [...] }",
  ].join("\n");
}

function normalizeProposal(p, mappingId) {
  if (!p || typeof p !== "object") return null;
  const title = String(p.title || "").trim();
  if (!title) return null;

  const mappedApis = Array.isArray(p.mappedApis)
    ? p.mappedApis.map((api) => ({
        serviceId: api.serviceId ? String(api.serviceId).trim() : undefined,
        operationId: api.operationId ? String(api.operationId).trim() : undefined,
        method: api.method ? String(api.method).trim().toUpperCase() : undefined,
        path: api.path ? String(api.path).trim() : undefined,
      }))
    : [];

  const executionSteps = Array.isArray(p.executionSteps)
    ? p.executionSteps
        .map((step) => ({
          step: Number(step.step) || 0,
          description: String(step.description || "").trim(),
          operationRef: step.operationRef
            ? {
                serviceId: step.operationRef.serviceId ? String(step.operationRef.serviceId).trim() : undefined,
                operationId: step.operationRef.operationId ? String(step.operationRef.operationId).trim() : undefined,
              }
            : undefined,
          headers: step.headers && typeof step.headers === "object" ? step.headers : {},
          body: step.body !== undefined ? step.body : null,
        }))
        .sort((a, b) => a.step - b.step)
    : [];

  const assertions = Array.isArray(p.assertions)
    ? p.assertions.map((a) => ({
        type: String(a.type || "status").trim(),
        field: a.field ? String(a.field).trim() : undefined,
        expected: a.expected !== undefined ? a.expected : undefined,
        operator: a.operator ? String(a.operator).trim() : undefined,
      }))
    : [];

  const confidence = Number(p.confidence);
  const safeConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5;

  const expectedStatusCode = Number(p.expectedStatusCode);
  const safeStatusCode = Number.isFinite(expectedStatusCode) ? expectedStatusCode : 200;

  return {
    mappingId: mappingId || (p.mappingId ? String(p.mappingId).trim() : null),
    requirementId: p.requirementId ? String(p.requirementId).trim() : null,
    scenarioId: p.scenarioId ? String(p.scenarioId).trim() : null,
    title,
    description: String(p.description || "").trim(),
    scenario: String(p.scenario || "").trim(),
    mappedApis,
    executionSteps,
    headers: p.headers && typeof p.headers === "object" ? p.headers : {},
    variables: p.variables && typeof p.variables === "object" ? p.variables : {},
    requestBody: p.requestBody !== undefined ? p.requestBody : null,
    assertions,
    expectedStatusCode: safeStatusCode,
    expectedResponse: p.expectedResponse !== undefined ? p.expectedResponse : null,
    dependencies: Array.isArray(p.dependencies) ? p.dependencies.map(String) : [],
    priority: ["low", "medium", "high", "critical"].includes(String(p.priority || "").toLowerCase())
      ? String(p.priority).toLowerCase()
      : "medium",
    confidence: safeConfidence,
  };
}

async function callAi({ prompt, requirements, scenarios, mappings, knowledge, apiCatalog }) {
  const config = require("../config");

  const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.ai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify({ requirements, scenarios, mappings, knowledge, apiCatalog }) },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}): ${raw}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Malformed AI response: not valid JSON.");
  }

  const content = String(data.choices?.[0]?.message?.content || "").trim();

  let cleaned = content;
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const extracted = cleaned.slice(jsonStart, jsonEnd + 1);
      try {
        parsed = JSON.parse(extracted);
      } catch {
        throw new Error("AI content is not valid JSON.");
      }
    } else {
      throw new Error("AI content is not valid JSON.");
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response did not return a JSON object.");
  }

  const proposals = Array.isArray(parsed.proposals) ? parsed.proposals.map((p) => normalizeProposal(p)).filter(Boolean) : [];
  return { proposals };
}

async function generateTests({ requirements = [], scenarios = [], mappings = [], knowledge = {}, apiCatalog = {} } = {}) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    throw new Error("Requirements array is required and must not be empty.");
  }
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error("Scenarios array is required and must not be empty.");
  }
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw new Error("Mappings array is required and must not be empty.");
  }

  const prompt = buildPrompt({ requirements, scenarios, mappings, knowledge, apiCatalog });
  let result;
  try {
    result = await callAi({ prompt, requirements, scenarios, mappings, knowledge, apiCatalog });
  } catch (err) {
    if (!isConfigured()) {
      return {
        proposals: [],
        warning: "AI provider is not configured. Configure AI to enable test generation.",
        usedAi: false,
      };
    }
    throw err;
  }

  return {
    proposals: result.proposals,
    warning: result.proposals.length === 0 ? "AI did not generate any executable tests from the provided inputs." : undefined,
    usedAi: true,
  };
}

module.exports = {
  buildPrompt,
  callAi,
  generateTests,
  normalizeProposal,
};