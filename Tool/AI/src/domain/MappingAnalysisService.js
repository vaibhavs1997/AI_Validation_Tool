/**
 * MappingAnalysisService
 *
 * AI service to suggest implementation mappings from approved requirements, scenarios, and API catalog.
 * Uses existing llmClient for AI interactions.
 *
 * No persistence side-effects.
 */

const { isConfigured } = require("../integrations/llmClient");

function buildPrompt({ requirements, scenarios, apiCatalog }) {
  return [
    "You are analyzing approved requirements and validation scenarios to suggest implementation mappings against an API catalog.",
    "Inputs:",
    "- Approved Requirements",
    "- Approved Validation Scenarios",
    "- API Catalog (services and operations)",
    "",
    "For each scenario, suggest 1-3 implementation mappings. Each mapping MUST include:",
    "- scenarioId: the scenario being mapped",
    "- requirementId: the requirement this scenario validates",
    "- title: short mapping title",
    "- description: what this mapping achieves",
    "- candidateApis: array of API operations with serviceId, operationId, method, path",
    "- executionOrder: 'sequential' or 'parallel'",
    "- authenticationRequired: boolean",
    "- authenticationDetails: brief description if auth is required",
    "- requestDependencies: array of dependency descriptions",
    "- variablesRequired: array of variable names needed",
    "- executionFlow: ordered steps with description and optional operationRef",
    "- confidence: 0-1",
    "- reasoning: brief explanation of why these APIs satisfy the scenario",
    "",
    "Return ONLY valid JSON. No markdown, no code fences, no extra text.",
    "Format: { proposals: [...] }",
  ].join("\n");
}

function normalizeProposal(p) {
  if (!p || typeof p !== "object") return null;
  const title = String(p.title || "").trim();
  if (!title) return null;

  const candidateApis = Array.isArray(p.candidateApis)
    ? p.candidateApis.map((api) => ({
        serviceId: api.serviceId ? String(api.serviceId).trim() : undefined,
        operationId: api.operationId ? String(api.operationId).trim() : undefined,
        method: api.method ? String(api.method).trim().toUpperCase() : undefined,
        path: api.path ? String(api.path).trim() : undefined,
      }))
    : [];

  const executionFlow = Array.isArray(p.executionFlow)
    ? p.executionFlow
        .map((step) => ({
          step: Number(step.step) || 0,
          description: String(step.description || "").trim(),
          operationRef: step.operationRef
            ? {
                serviceId: step.operationRef.serviceId ? String(step.operationRef.serviceId).trim() : undefined,
                operationId: step.operationRef.operationId ? String(step.operationRef.operationId).trim() : undefined,
              }
            : undefined,
        }))
        .sort((a, b) => a.step - b.step)
    : [];

  const confidence = Number(p.confidence);
  const safeConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5;

  return {
    scenarioId: String(p.scenarioId || "").trim(),
    requirementId: p.requirementId ? String(p.requirementId).trim() : null,
    title,
    description: String(p.description || "").trim(),
    candidateApis,
    executionOrder: ["sequential", "parallel"].includes(String(p.executionOrder || "").toLowerCase())
      ? String(p.executionOrder).toLowerCase()
      : "sequential",
    authenticationRequired: Boolean(p.authenticationRequired),
    authenticationDetails: p.authenticationDetails ? String(p.authenticationDetails).trim() : "",
    requestDependencies: Array.isArray(p.requestDependencies) ? p.requestDependencies.map(String) : [],
    variablesRequired: Array.isArray(p.variablesRequired) ? p.variablesRequired.map(String) : [],
    executionFlow,
    confidence: safeConfidence,
    reasoning: p.reasoning ? String(p.reasoning).trim() : "",
  };
}

async function callAi({ prompt, requirements, scenarios, apiCatalog }) {
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
        { role: "user", content: JSON.stringify({ requirements, scenarios, apiCatalog }) },
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

async function analyzeMappings({ requirements = [], scenarios = [], apiCatalog = {} } = {}) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    throw new Error("Requirements array is required and must not be empty.");
  }
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error("Scenarios array is required and must not be empty.");
  }

  const prompt = buildPrompt({ requirements, scenarios, apiCatalog });
  let result;
  try {
    result = await callAi({ prompt, requirements, scenarios, apiCatalog });
  } catch (err) {
    if (!isConfigured()) {
      return {
        proposals: [],
        warning: "AI provider is not configured. Configure AI to enable implementation mapping suggestions.",
        usedAi: false,
      };
    }
    throw err;
  }

  return {
    proposals: result.proposals,
    warning: result.proposals.length === 0 ? "AI did not generate any implementation mappings from the provided inputs." : undefined,
    usedAi: true,
  };
}

module.exports = {
  buildPrompt,
  callAi,
  analyzeMappings,
  normalizeProposal,
};