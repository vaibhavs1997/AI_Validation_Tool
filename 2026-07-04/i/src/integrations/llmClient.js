const config = require("../config");

function isConfigured() {
  return Boolean(config.ai.apiKey && config.ai.baseUrl && config.ai.model);
}

function compactContract(contract) {
  return {
    title: contract.title,
    version: contract.version,
    baseUrl: contract.baseUrl,
    endpoints: (contract.endpoints || []).slice(0, 5).map((endpoint) => ({
      method: endpoint.method,
      path: endpoint.path,
      operationId: endpoint.operationId,
      summary: endpoint.summary,
    })),
  };
}

async function enhanceScenarios({ ticket, contract, localScenarios }) {
  if (!isConfigured()) {
    return {
      usedAi: false,
      scenarios: localScenarios,
      warning: "AI provider is not configured.",
    };
  }

  const prompt = [
    "You generate API validation scenarios.",
    "Return ONLY valid JSON. No markdown, no fences, no extra text.",
    'Format: {"scenarios": [{"title":"...","type":"positive|negative|auth","sourceAc":"...","expectedStatus":200,"mutations":[],"assertions":[],"risk":"low|medium|high"}]}',
    "Map each acceptance criterion to at least one positive and one negative scenario.",
  ].join(" ");

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
        {
          role: "user",
          content: JSON.stringify(
            {
              ticket: { key: ticket.key, summary: ticket.summary, acceptanceCriteria: (ticket.acceptanceCriteria || []).slice(0, 8) },
              contract: compactContract(contract),
              localScenarios: (localScenarios || []).slice(0, 10),
            }
          ),
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
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

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
        throw new Error(`AI content not JSON: ${innerErr.message}`);
      }
    } else {
      throw new Error(`AI content not JSON: ${err.message}`);
    }
  }

  if (!Array.isArray(parsed.scenarios)) {
    throw new Error("AI response did not include a scenarios array.");
  }

  // Preserve endpoint info from local scenarios when AI scenarios lack it
  const byTitle = new Map();
  for (const ls of localScenarios || []) {
    if (ls.title) byTitle.set(ls.title.toLowerCase(), ls);
  }

  const merged = parsed.scenarios.map((ai) => {
    const key = String(ai.title || "").toLowerCase();
    const match = byTitle.get(key);
    if (match && (!ai.method && !ai.path && !ai.endpointId)) {
      return { ...ai, method: ai.method || match.method, path: ai.path || match.path, endpointId: ai.endpointId || match.endpointId };
    }
    return ai;
  });

  return {
    usedAi: true,
    scenarios: merged,
  };
}

module.exports = {
  enhanceScenarios,
  isConfigured,
};