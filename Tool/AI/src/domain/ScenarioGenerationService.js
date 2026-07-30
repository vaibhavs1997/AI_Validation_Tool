/**
 * ScenarioGenerationService
 *
 * AI service to generate validation scenarios from approved requirements.
 * Uses existing llmClient for AI interactions.
 *
 * No persistence side-effects.
 */

const { isConfigured } = require("../integrations/llmClient");

function buildPrompt({ requirements, existingScenarios }) {
  const requirementText = requirements
    .map((r) => `Requirement: ${r.title}\n${r.description}\nAcceptance Criteria:\n${r.acceptanceCriteria.map((ac) => `- ${ac}`).join("\n")}\nBusiness Rules:\n${r.businessRules.map((br) => `- ${br}`).join("\n")}`)
    .join("\n\n---\n\n");

  return [
    "You are generating validation scenarios for software requirements.",
    "For each requirement, generate 2-4 validation scenarios that describe how to verify the requirement is met.",
    "Each scenario MUST include: title, description, priority (low|medium|high|critical), confidence (0-1).",
    "Include a requirementId field matching the requirement it validates.",
    "Return ONLY valid JSON. No markdown, no code fences, no extra text.",
    "Format: { proposals: [...] }",
    "Confidence reflects how certain you are that this scenario correctly validates the requirement.",
  ].join("\n");
}

function normalizeProposal(p, requirementId) {
  if (!p || typeof p !== "object") return null;
  const title = String(p.title || "").trim();
  if (!title) return null;

  const priority = String(p.priority || "medium").toLowerCase();
  const validPriorities = ["low", "medium", "high", "critical"];
  const normalizedPriority = validPriorities.includes(priority) ? priority : "medium";

  const confidence = Number(p.confidence);
  const safeConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5;

  return {
    title,
    description: String(p.description || "").trim(),
    priority: normalizedPriority,
    confidence: safeConfidence,
    requirementId: p.requirementId || requirementId,
  };
}

async function callAi({ prompt, requirements }) {
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
        { role: "user", content: JSON.stringify({ requirements }) },
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

async function generateScenarios({ requirements, existingScenarios = [] } = {}) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    throw new Error("Requirements array is required and must not be empty.");
  }

  const prompt = buildPrompt({ requirements, existingScenarios });
  let result;
  try {
    result = await callAi({ prompt, requirements });
  } catch (err) {
    if (!isConfigured()) {
      return {
        proposals: [],
        warning: "AI provider is not configured. Configure AI to enable scenario generation.",
        usedAi: false,
      };
    }
    throw err;
  }

  return {
    proposals: result.proposals,
    warning: result.proposals.length === 0 ? "AI did not generate any scenarios from the provided requirements." : undefined,
    usedAi: true,
  };
}

module.exports = {
  buildPrompt,
  callAi,
  generateScenarios,
  normalizeProposal,
};