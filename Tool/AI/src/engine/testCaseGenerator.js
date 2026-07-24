/**
 * TestCase Generator
 *
 * Native requirement-first generation.
 * Produces canonical TestCase[] directly from requirements/ticket.
 * API-independent: no contract, endpoints, or operations used during generation.
 */

const { generateWithAiV2 } = require('./aiTestGeneratorV2');
const { createTestCase } = require('../domain/TestCase');
const { getProjectKnowledge } = require('../domain/ProjectKnowledgeRepository');

function normalizeType(raw, title = "") {
  const type = String(raw || "").toLowerCase();
  if (type === "positive" || type === "negative" || type === "edge" || type === "functional" || type === "auth") {
    return type;
  }
  const lower = title.toLowerCase();
  const negativeIndicators = ["fails", "invalid", "rejected", "cannot", "should not", "missing", "unauthorized", "forbidden"];
  if (negativeIndicators.some((indicator) => lower.includes(indicator))) {
    return "negative";
  }
  return "positive";
}

function buildDescription(title, acText, summary) {
  // Already well-formed description
  const lower = acText.toLowerCase();
  if (acText && (lower.startsWith("verify that ") || lower.startsWith("verify ") || lower.startsWith("test "))) {
    return acText;
  }
  const source = summary || title || "";
  if (source) {
    const s = source.toLowerCase();
    if (s.startsWith("verify that ") || s.startsWith("verify ") || s.startsWith("test ")) {
      return source;
    }
    return "Verify that " + source + ".";
  }
  return "";
}

function sanitizeWeakAcText(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "ac" || lower === "a.c." || lower === "ac.") return "";
  if (/^ac\s*\d*$/i.test(text)) return "";
  if (lower.startsWith("verify that ac.")) return "";
  return text;
}

function generateDescriptionForAc(acText, summary, title) {
  const cleanedAc = sanitizeWeakAcText(acText);
  if (cleanedAc) {
    const last = cleanedAc.trim().slice(-1);
    if (last === "." || last === "!" || last === "?") return cleanedAc;
    return cleanedAc + ".";
  }
  if (summary) {
    const last = summary.trim().slice(-1);
    if (last === "." || last === "!" || last === "?") return summary;
    return summary + ".";
  }
  if (title && title !== "Generated TestCase") {
    const last = title.trim().slice(-1);
    if (last === "." || last === "!" || last === "?") return title;
    return title + ".";
  }
  return "";
}

function generateLocalFallbackTestCases(ticket) {
  const acs = ticket.acceptanceCriteria || [];
  const summary = ticket.summary || "";
  const description = ticket.description || "";

  const testCases = [];

  for (let i = 0; i < acs.length; i++) {
    const raw = acs[i];
    const acText = typeof raw === "string" ? raw : (raw.text || raw.acText || String(raw));
    const acIndex = typeof raw === "object" && raw.acIndex !== undefined ? raw.acIndex : i;
    const title = acText || summary || `Generated TestCase ${i + 1}`;
    testCases.push({
      title,
      description: generateDescriptionForAc(acText, summary),
      type: "positive",
      sourceAcIndex: acIndex,
      testData: { pathParams: {}, queryParams: {}, headers: {}, body: {} },
      expected: { status: 200, responseAssertions: [] },
    });
  }

  if (testCases.length === 0 && summary) {
    const title = summary;
    testCases.push({
      title,
      description: generateDescriptionForAc("", summary, title),
      type: "positive",
      sourceAcIndex: 0,
      testData: { pathParams: {}, queryParams: {}, headers: {}, body: {} },
      expected: { status: 200, responseAssertions: [] },
    });
  }

  return testCases;
}

async function generateTestCases({ projectId, ticket }) {
  let projectInstructions = "";
  try {
    const knowledge = await getProjectKnowledge(projectId);
    projectInstructions = knowledge?.instructions || "";
  } catch {
    // ignore
  }

  const aiResult = await generateWithAiV2(ticket, null, {
    requirementOnly: true,
    projectInstructions,
  });

  let rawTestCases = [];
  let mode = "local_fallback";
  let warnings = [];

  if (aiResult.success && Array.isArray(aiResult.testCases)) {
    rawTestCases = aiResult.testCases;
    mode = "ai_v2";
  } else {
    rawTestCases = generateLocalFallbackTestCases(ticket);
    warnings = aiResult.reason ? [`AI generation failed: ${aiResult.reason}`] : [];
  }

  const testCases = rawTestCases.map((raw) => {
    const acIndex = typeof raw.sourceAcIndex === "number" ? raw.sourceAcIndex : 0;
    const title = typeof raw.title === "string" ? raw.title : "Generated TestCase";

    // Preserve meaningful AI description; only improve weak/vague descriptions
    let description = typeof raw.description === "string" ? raw.description.trim() : "";
    if (!description) {
      description = generateDescriptionForAc(raw.sourceAc || raw.acText || "", ticket.summary, title);
    }

    return createTestCase({
      title,
      description,
      type: normalizeType(raw.type, title),
      requirementRefs: [{ acIndex, acText: raw.sourceAc || raw.acText || "" }],
      testData: {
        pathParams: raw.testData?.pathParams || {},
        queryParams: raw.testData?.queryParams || {},
        headers: raw.testData?.headers || {},
        body: raw.testData?.body || {},
      },
      expectedBehavior: {
        status: raw.expected?.status || 200,
        responseAssertions: raw.expected?.responseAssertions || [],
      },
      assertions: raw.expected?.responseAssertions || [],
    });
  });

  return {
    projectId,
    testCases,
    diagnostics: {
      generated: testCases.length,
      mode,
    },
    warnings,
  };
}

module.exports = {
  generateTestCases,
};