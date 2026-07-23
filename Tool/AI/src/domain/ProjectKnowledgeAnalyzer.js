/**
 * ProjectKnowledgeAnalyzer
 *
 * Uses the configured AI provider to analyze project instructions/services/api-models
 * and propose structured KnowledgeRelationship records.
 */

const config = require("../config");
const { createKnowledgeRelationship, RELATIONSHIP_TYPES, STATUSES } = require("./KnowledgeRelationship");

const PROMPT = [
  "You analyze API project knowledge and propose structured relationships between API operations.",
  "Return ONLY valid JSON. No markdown, no fences, no extra text.",
  'Format: {"relationships":[{"type":"authentication|data_dependency","source":{"serviceId":"...","operationId":"...","location":"..."},"target":{"serviceId":"...","operationId":"...","location":"..."},"transform":"...","confidence":0.0,"evidence":"..."}]}',
  "Allowed types: authentication, data_dependency.",
  "Allowed statuses will be applied later: proposed, confirmed, rejected.",
  "confidence must be between 0 and 1.",
].join(" ");

/**
 * Build a compact summary of services/api-models for prompt context.
 */
function compactProjectContext({ services = [], apiModels = [] }) {
  const operations = [];
  for (const model of apiModels) {
    const serviceId = model.service?.id || model.title || 'api-service';
    for (const op of model.operations || []) {
      operations.push({
        serviceId,
        operationId: op.id || op.operationId || `${op.method || 'GET'} ${op.path || '/'}`,
        method: op.method,
        path: op.path,
        protocol: op.protocol || 'rest',
        summary: op.summary || '',
      });
    }
  }

  return {
    services: services.map((s) => ({ id: s.id, name: s.name, protocol: s.protocol })),
    operations: operations.slice(0, 50),
  };
}

/**
 * Analyze project knowledge and return proposed relationships.
 * Does not persist anything.
 */
async function analyzeProjectKnowledge({ instructions = '', services = [], apiModels = [] }) {
  if (!isAiConfigured()) {
    return { usedAi: false, relationships: [], warning: 'AI provider is not configured.' };
  }

  const context = compactProjectContext({ services, apiModels });
  const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.ai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            instructions,
            services: context.services,
            operations: context.operations,
          }),
        },
      ],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}): ${text}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Malformed AI response: ${err.message}`);
  }

  const content = (data.choices?.[0]?.message?.content || "{}").trim();
  let cleaned = content;
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const extracted = cleaned.slice(jsonStart, jsonEnd + 1);
      try {
        parsed = JSON.parse(extracted);
      } catch (innerErr) {
        return { usedAi: true, relationships: [] };
      }
    } else {
      return { usedAi: true, relationships: [] };
    }
  }

  const rawRelationships = Array.isArray(parsed.relationships) ? parsed.relationships : [];
  const validOperationIds = new Set((context.operations || []).map((op) => `${op.serviceId}::${op.operationId}`));

  const relationships = [];
  for (const rel of rawRelationships) {
    const normalized = tryCreateRelationship(rel, validOperationIds);
    if (normalized) {
      relationships.push(normalized);
    }
  }

  return { usedAi: true, relationships };
}

function isAiConfigured() {
  return Boolean(config.ai.apiKey && config.ai.baseUrl && config.ai.model);
}

function tryCreateRelationship(rel, validOperationIds) {
  try {
    const created = createKnowledgeRelationship({
      ...rel,
      status: 'proposed',
    });

    if (!created.source || !created.target) return null;
    if (!created.source.serviceId || !created.source.operationId || !created.source.location) return null;
    if (!created.target.serviceId || !created.target.operationId || !created.target.location) return null;
    if (!RELATIONSHIP_TYPES.includes(created.type)) return null;
    if (!STATUSES.includes(created.status)) return null;
    if (typeof created.confidence !== 'number' || Number.isNaN(created.confidence)) return null;
    const confident = Math.max(0, Math.min(1, created.confidence));
    if (validOperationIds.size > 0) {
      const sourceKey = `${created.source.serviceId}::${created.source.operationId}`;
      const targetKey = `${created.target.serviceId}::${created.target.operationId}`;
      if (!validOperationIds.has(sourceKey) || !validOperationIds.has(targetKey)) {
        return null;
      }
    }

    return { ...created, confidence: confident };
  } catch {
    return null;
  }
}

module.exports = {
  analyzeProjectKnowledge,
  compactProjectContext,
};