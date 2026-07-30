/**
 * RequirementExtractionService
 *
 * AI service to extract requirements from pasted text or document content.
 * Uses existing llmClient for AI interactions.
 *
 * No persistence side-effects.
 */

const { isConfigured } = require("../integrations/llmClient");
const { compactText } = require("../acExtractor");

function buildPrompt({ text, fileName }) {
  const header = fileName
    ? `You are extracting requirements from a document named: ${fileName}.`
    : "You are extracting requirements from user-provided text.";

  return [
    header,
    "Extract an array of requirement proposals from the content.",
    "Each proposal MUST include: title, description, acceptanceCriteria (array), businessRules (array), priority (low|medium|high|critical), confidence (0-1), sourceNotes (string).",
    "If a field is not detectable, return empty arrays or empty strings as appropriate. Do NOT fabricate values.",
    "Return ONLY valid JSON. No markdown, no code fences, no extra text. Format: { proposals: [...] }",
    "Acceptance criteria and business rules must each be arrays of strings.",
    "Confidence reflects how certain you are that this is a real requirement.",
  ].join("\n");
}

function cleanAiText(value) {
  if (!value) return "";
  return String(value).trim();
}

function normalizeProposal(p) {
  if (!p || typeof p !== "object") return null;
  const title = cleanAiText(p.title);
  if (!title) return null;
  const acceptanceCriteria = Array.isArray(p.acceptanceCriteria)
    ? p.acceptanceCriteria.map(String).filter(Boolean)
    : [];
  const businessRules = Array.isArray(p.businessRules)
    ? p.businessRules.map(String).filter(Boolean)
    : [];
  const priority = String(p.priority || "medium").toLowerCase();
  const validPriorities = ["low", "medium", "high", "critical"];
  const normalizedPriority = validPriorities.includes(priority) ? priority : "medium";
  const confidence = Number(p.confidence);
  const safeConfidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5;

  return {
    title,
    description: cleanAiText(p.description),
    acceptanceCriteria,
    businessRules,
    priority: normalizedPriority,
    confidence: safeConfidence,
    sourceNotes: cleanAiText(p.sourceNotes),
  };
}

async function callAi({ prompt, text }) {
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
        { role: "user", content: JSON.stringify({ content: text }) },
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

  const proposals = Array.isArray(parsed.proposals) ? parsed.proposals.map(normalizeProposal).filter(Boolean) : [];
  return { proposals };
}

async function extractRequirements({ text, fileName } = {}) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Content text is required.");
  }

  const prompt = buildPrompt({ text, fileName });
  let result;
  try {
    result = await callAi({ prompt, text });
  } catch (err) {
    // If AI unavailable, return empty array and warning rather than hard failure
    if (!isConfigured()) {
  return {
    proposals: [],
    warning: "AI provider is not configured. Configure AI to enable requirement extraction.",
    usedAi: false,
  };
    }
    throw err;
  }

  return {
    proposals: result.proposals,
    warning: result.proposals.length === 0 ? "AI did not find any requirements in the provided content." : undefined,
  };
}

module.exports = {
  buildPrompt,
  callAi,
  extractRequirements,
  normalizeProposal,
};