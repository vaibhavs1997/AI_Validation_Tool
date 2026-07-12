const config = require("../config");

function isConfigured() {
  return Boolean(config.ai.apiKey && config.ai.baseUrl && config.ai.model);
}

function compactContract(contract) {
  return {
    title: contract.title,
    version: contract.version,
    baseUrl: contract.baseUrl,
    endpoints: (contract.endpoints || []).slice(0, 12).map((endpoint) => ({
      method: endpoint.method,
      path: endpoint.path,
      operationId: endpoint.operationId,
      summary: endpoint.summary,
      required: endpoint.requestSchema?.required || [],
      responses: endpoint.responses,
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
    "You are generating executable API validation scenarios for QA review.",
    "Return strict JSON with a top-level scenarios array.",
    "Preserve endpoint method/path from the contract.",
    "Each scenario must include title, type, sourceAc, expectedStatus, mutations, assertions, and risk.",
    "Do not invent endpoints that are not present in the contract.",
  ].join(" ");

  const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.ai.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.ai.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: JSON.stringify(
            {
              ticket,
              contract: compactContract(contract),
              localScenarios,
            },
            null,
            2
          ),
        },
      ],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}): ${text}`);
  }

  const data = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);

  if (!Array.isArray(parsed.scenarios)) {
    throw new Error("AI response did not include a scenarios array.");
  }

  return {
    usedAi: true,
    scenarios: parsed.scenarios,
  };
}

module.exports = {
  enhanceScenarios,
  isConfigured,
};
