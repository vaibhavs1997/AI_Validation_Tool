/**
 * RequirementAnalysisService
 *
 * AI-powered requirement analysis service.
 * Uses existing llmClient and Knowledge Library to analyze requirements.
 *
 * Extracts:
 * - Acceptance Criteria
 * - Business Rules
 * - Positive Flows
 * - Negative Flows
 * - Edge Cases
 * - Preconditions
 * - Postconditions
 * - Dependencies
 * - Assumptions
 * - Missing Information
 * - Ambiguities
 *
 * Reuses existing:
 * - llmClient for AI interactions
 * - ProjectKnowledgeRepository for knowledge context
 * - ServiceRepository for API catalog context
 */

const { isConfigured } = require("../integrations/llmClient");

function buildAnalysisPrompt({ requirement, knowledge, apiCatalog }) {
  const lines = [
    "You are a senior QA analyst analyzing a software requirement.",
    "Extract comprehensive testing information from the requirement.",
    "",
    "Requirement:",
    `Title: ${requirement.title || 'Untitled'}`,
    `Description: ${requirement.description || 'N/A'}`,
    `Acceptance Criteria: ${(requirement.acceptanceCriteria || []).join(', ') || 'N/A'}`,
    `Business Rules: ${(requirement.businessRules || []).join(', ') || 'N/A'}`,
  ];

  if (knowledge && knowledge.relationships && knowledge.relationships.length > 0) {
    lines.push("", "Knowledge Library Context:");
    knowledge.relationships.slice(0, 5).forEach((rel) => {
      lines.push(`- ${rel.sourceKey || rel.description || 'Knowledge item'}`);
    });
  }

  if (apiCatalog && Object.keys(apiCatalog).length > 0) {
    lines.push("", "Available API Services:");
    Object.entries(apiCatalog).forEach(([serviceId, service]) => {
      lines.push(`- ${service.name || serviceId}: ${(service.operations || []).length} operations`);
    });
  }

  lines.push("",
    "Return ONLY valid JSON. No markdown, no code fences, no extra text.",
    "Format:",
    `{
      "acceptanceCriteria": ["..."],
      "businessRules": ["..."],
      "positivePaths": ["..."],
      "negativePaths": ["..."],
      "edgeCases": ["..."],
      "preconditions": ["..."],
      "postconditions": ["..."],
      "dependencies": ["..."],
      "assumptions": ["..."],
      "missingInformation": ["..."],
      "ambiguities": ["..."]
    }`,
    "",
    "If a field is not applicable, return an empty array. Do NOT fabricate values.",
  );

  return lines.join("\n");
}

function cleanAiText(value) {
  if (!value) return "";
  return String(value).trim();
}

function parseAnalysisResult(content) {
  let cleaned = String(content || "").trim();

  // Remove markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Try to extract JSON object
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI analysis response is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI analysis response did not return a JSON object.");
  }

  const extractArray = (field) =>
    Array.isArray(parsed[field]) ? parsed[field].map(String).filter(Boolean) : [];

  return {
    acceptanceCriteria: extractArray("acceptanceCriteria"),
    businessRules: extractArray("businessRules"),
    positivePaths: extractArray("positivePaths"),
    negativePaths: extractArray("negativePaths"),
    edgeCases: extractArray("edgeCases"),
    preconditions: extractArray("preconditions"),
    postconditions: extractArray("postconditions"),
    dependencies: extractArray("dependencies"),
    assumptions: extractArray("assumptions"),
    missingInformation: extractArray("missingInformation"),
    ambiguities: extractArray("ambiguities"),
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
  if (!content) {
    throw new Error("AI returned empty content.");
  }

  return parseAnalysisResult(content);
}

/**
 * Analyze a requirement using AI.
 * @param {object} options
 * @param {object} options.requirement - The requirement to analyze
 * @param {object} [options.knowledge] - Knowledge library context
 * @param {object} [options.apiCatalog] - API catalog context
 * @returns {Promise<object>} Analysis result
 */
async function analyzeRequirement({ requirement, knowledge, apiCatalog } = {}) {
  if (!requirement || !requirement.title) {
    throw new Error("Requirement with title is required for analysis.");
  }

  const prompt = buildAnalysisPrompt({ requirement, knowledge, apiCatalog });

  try {
    const result = await callAi({ prompt, text: requirement.description || requirement.title });
    return {
      ...result,
      completed: true,
      analyzedAt: new Date().toISOString(),
      usedAi: true,
    };
  } catch (err) {
    if (!isConfigured()) {
      return {
        acceptanceCriteria: requirement.acceptanceCriteria || [],
        businessRules: requirement.businessRules || [],
        positivePaths: [],
        negativePaths: [],
        edgeCases: [],
        preconditions: [],
        postconditions: [],
        dependencies: [],
        assumptions: [],
        missingInformation: [],
        ambiguities: [],
        completed: false,
        analyzedAt: null,
        usedAi: false,
        warning: "AI provider is not configured. Configure AI to enable analysis.",
      };
    }
    throw err;
  }
}

/**
 * Generate test cases from analysis results.
 * @param {object} options
 * @param {object} options.requirement
 * @param {object} options.analysis
 * @returns {Promise<Array>} Generated test cases
 */
async function generateTestCasesFromAnalysis({ requirement, analysis } = {}) {
  if (!requirement || !analysis) {
    throw new Error("Requirement and analysis are required.");
  }

  const prompt = [
    "You are a senior test engineer generating business-level test cases.",
    "Based on the requirement and analysis below, generate comprehensive test cases.",
    "",
    "Requirement:",
    `Title: ${requirement.title}`,
    `Description: ${requirement.description || 'N/A'}`,
    "",
    "Analysis Results:",
    `Acceptance Criteria: ${(analysis.acceptanceCriteria || []).join(', ') || 'N/A'}`,
    `Business Rules: ${(analysis.businessRules || []).join(', ') || 'N/A'}`,
    `Positive Paths: ${(analysis.positivePaths || []).join(', ') || 'N/A'}`,
    `Negative Paths: ${(analysis.negativePaths || []).join(', ') || 'N/A'}`,
    `Edge Cases: ${(analysis.edgeCases || []).join(', ') || 'N/A'}`,
    `Preconditions: ${(analysis.preconditions || []).join(', ') || 'N/A'}`,
    `Postconditions: ${(analysis.postconditions || []).join(', ') || 'N/A'}`,
    "",
    "Generate test cases. Each test case must have:",
    "- title: string",
    "- description: string",
    "- type: 'positive' | 'negative'",
    "- priority: 'low' | 'medium' | 'high' | 'critical'",
    "- acceptanceCriteriaRef: array of strings referencing specific criteria",
    "- expectedResult: string",
    "- expectedStatusCode: number or null",
    "- tags: array of strings",
    "- risk: 'low' | 'medium' | 'high'",
    "- confidenceScore: number between 0 and 1",
    "",
    "Return ONLY valid JSON array. No markdown, no code fences.",
    `Format: [{ "title": "...", "description": "...", "type": "positive", ... }]`,
  ].join("\n");

  try {
    const result = await callAi({ prompt, text: requirement.description || requirement.title });

    // The result from callAi is parsed analysis, but we need test cases
    // Re-call with test case specific prompt
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
          { role: "user", content: JSON.stringify({ content: requirement.description || requirement.title }) },
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

    const jsonStart = cleaned.indexOf("[");
    const jsonEnd = cleaned.lastIndexOf("]");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }

    let testCases;
    try {
      testCases = JSON.parse(cleaned);
    } catch {
      // Try wrapping in array if single object
      try {
        const obj = JSON.parse(cleaned);
        testCases = [obj];
      } catch {
        throw new Error("AI test case response is not valid JSON.");
      }
    }

    if (!Array.isArray(testCases)) {
      testCases = [testCases];
    }

    return testCases.map((tc, idx) => ({
      id: tc.id || `tc-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      title: String(tc.title || `Test Case ${idx + 1}`),
      description: String(tc.description || ""),
      type: ["positive", "negative"].includes(tc.type) ? tc.type : "positive",
      priority: ["low", "medium", "high", "critical"].includes(tc.priority) ? tc.priority : "medium",
      acceptanceCriteriaRef: Array.isArray(tc.acceptanceCriteriaRef)
        ? tc.acceptanceCriteriaRef.map(String)
        : [],
      expectedResult: String(tc.expectedResult || ""),
      expectedStatusCode: tc.expectedStatusCode || null,
      tags: Array.isArray(tc.tags) ? tc.tags.map(String) : [],
      risk: ["low", "medium", "high"].includes(tc.risk) ? tc.risk : "medium",
      confidenceScore: typeof tc.confidenceScore === "number" ? Math.max(0, Math.min(1, tc.confidenceScore)) : 0.7,
      approved: false,
    }));
  } catch (err) {
    if (!isConfigured()) {
      return [];
    }
    throw err;
  }
}

module.exports = {
  analyzeRequirement,
  generateTestCasesFromAnalysis,
  buildAnalysisPrompt,
  parseAnalysisResult,
};