/**
 * AI Test Generator V2 — Provider-Agnostic AI-First Implementation
 * 
 * STEP 10.1 / 11.2A: Provides a clean, isolated path that:
 * - Preserves raw requirement semantics
 * - Generates test cases directly via LLM
 * - Provider-agnostic: works with any OpenAI-compatible API
 * - Explicit error classification
 */

const config = require("../config");
const fs = require("fs");
const path = require("path");
const aiLogPath = path.join(config.rootDir, "data", "ai-debug.log");

// JSON repair helper for common LLM output issues
function repairJson(text) {
  let repaired = text.trim();
  
  // Remove trailing commas before closing braces/brackets
  repaired = repaired.replace(/,\s*}/g, '}');
  repaired = repaired.replace(/,\s*\]/g, ']');
  
  // Try to close unclosed JSON structures (truncated response)
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  
  // Add missing closing braces/brackets
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
  for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
  
  return repaired;
}

// Requirement-only prompt (no API contract)
const REQUIREMENT_ONLY_PROMPT = `You are an expert QA engineer. Analyze the requirement and generate meaningful, non-redundant test cases.

CRITICAL RULE: One acceptance criterion (AC) does NOT equal one test case. Each AC can — and often should — generate MULTIPLE distinct test cases.

TITLE RULE: Use short, scenario-specific titles like "Login with valid credentials", "Login with invalid username", "Login with empty password". Do NOT use labels such as "Verify AC" or generic titles.

DESCRIPTION RULE: Each description must be a clear, human-readable test intent in 1-3 sentences. Describe:
- the condition/context (who/what state),
- the user action,
- the expected behavior/outcome.
Do NOT mention HTTP methods, endpoints, paths, service IDs, operation IDs, or any API implementation details.

For each AC, enumerate EVERY distinct testable condition. Each condition becomes its own testCase with its own title, type, and evidence.

For each AC, consider these dimensions independently:
1. HAPPY PATH: One positive test showing valid behavior works
2. EACH EXPLICIT FAILURE CONDITION: If the AC says "quantity must be > 0", that means quantity=0 is one test AND quantity=-1 is a separate test.
3. EACH SCHEMA CONSTRAINT: For every field mentioned in the AC, check for: required, minimum, maximum, minLength, maxLength, format, type, enum. Each constraint that can be violated becomes a separate test.
4. EACH BOUNDARY VALUE: For numeric fields with min/max, generate: min-1 (below), min (valid boundary), max (valid boundary), max+1 (above).
5. NOT_FOUND: If resource lookup is described, test with non-existent ID.

Scope rules:
- The AC defines WHAT behavior is relevant
- Do NOT invent business rules not present in requirement
- Do NOT generate duplicate tests (same condition = duplicate)
- Do NOT reference specific API endpoints, paths, or methods unless explicitly stated in the requirement text itself

Categories allowed (only when justified):
- POSITIVE: Valid behavior works correctly
- NEGATIVE: Validation/constraint violated intentionally
- BOUNDARY: Min/max constraints
- NOT_FOUND: When 404 response is relevant
- AUTHORIZATION: When auth-related behavior is described

CRITICAL OUTPUT RULE: Return ONLY raw JSON. No markdown, no backticks, no asterisks, no explanations, no extra text. The output must start with { and end with }.

JSON shape: {"testCases":[{"title":"...","description":"...","type":"POSITIVE|NEGATIVE|BOUNDARY|NOT_FOUND|AUTHORIZATION","sourceAcIndex":0,"testData":{"pathParams":{},"queryParams":{},"headers":{},"body":{}},"expected":{"status":200,"responseAssertions":[]},"assertions":[]}]}`;

// Contract-grounded prompt (legacy)
const AI_V2_PROMPT = `You are an expert API QA engineer. Analyze the requirement and API contract to generate meaningful, non-redundant test cases.

CRITICAL RULE: One acceptance criterion (AC) does NOT equal one test case. Each AC can — and often should — generate MULTIPLE distinct test cases.

For each AC, enumerate EVERY distinct testable condition. Each condition becomes its own testCase with its own title, type, and evidence.

For each AC, consider these dimensions independently:
1. HAPPY PATH: One positive test showing valid behavior works
2. EACH EXPLICIT FAILURE CONDITION: If the AC says "quantity must be > 0", that means quantity=0 is one test AND quantity=-1 is a separate test. Do NOT collapse into one "invalid quantity" test.
3. EACH SCHEMA CONSTRAINT: For every field mentioned in the AC, check the contract schema for: required, minimum, maximum, minLength, maxLength, format, type, enum. Each constraint that can be violated becomes a separate test.
4. EACH BOUNDARY VALUE: For numeric fields with min/max, generate: min-1 (below), min (valid boundary), max (valid boundary), max+1 (above). Each is a separate test.
5. AUTHORIZATION: If auth is mentioned, test each relevant endpoint individually.
6. NOT_FOUND: If resource lookup is described, test with non-existent ID.

EXAMPLES of correct multi-test expansion:
- AC "quantity must be > 0" → Test 1: quantity=0 (boundary), Test 2: quantity=-1 (below boundary)
- AC "quantity max 10" → Test 1: quantity=11 (above max boundary)
- AC "email must be valid" → Test 1: email="not-an-email" (format violation)
- AC "field X is required" → Test 1: missing X (required field violation)
- AC "auth required" → Test 1: POST /orders without auth, Test 2: GET /orders without auth, Test 3: GET /orders/{id} without auth, Test 4: DELETE /orders/{id} without auth

Scope rules:
- The AC defines WHAT behavior is relevant
- The contract/schema provides technical EVIDENCE to deepen testing
- Do NOT generate tests for endpoints or operations not referenced by ANY AC
- Do NOT invent business rules not present in requirement or contract schema
- Do NOT generate duplicate tests (same operation + same condition = duplicate)

Evidence sources:
- REQUIREMENT: Explicitly stated in acceptance criteria or description
- CONTRACT_SCHEMA: Derived from schema constraints (required, format, min/max, type)
- REQUIREMENT_AND_CONTRACT: Both provide clear evidence
- AI_INFERENCE: Use sparingly only for obvious API patterns

Categories allowed (only when justified):
- POSITIVE: Valid behavior works correctly
- NEGATIVE: Validation/constraint violated intentionally
- BOUNDARY: Min/max constraints from schema
- NOT_FOUND: When 404 response is documented and relevant
- AUTHORIZATION: When auth-related behavior is described

Select endpoints ONLY from the provided contract.

CRITICAL OUTPUT RULE: Return ONLY raw JSON. No markdown, no backticks, no asterisks, no bullet points, no bold, no explanations, no extra text. The output must start with { and end with }.

JSON shape: {"testCases":[{"title":"...","description":"...","type":"POSITIVE|NEGATIVE|BOUNDARY|NOT_FOUND|AUTHORIZATION","testOrigin":"REQUIREMENT|CONTRACT_SCHEMA|REQUIREMENT_AND_CONTRACT|AI_INFERENCE","confidence":"HIGH|MEDIUM|LOW","sourceAcIndex":0,"negativeCondition":{"kind":"MISSING_REQUIRED_FIELD|INVALID_FORMAT|OUT_OF_RANGE","field":"field name"},"proposedOperation":{"endpointId":"...","method":"...","path":"/posts/{postId}"},"testData":{"pathParams":{},"queryParams":{},"headers":{},"body":{}},"expected":{"status":200,"responseAssertions":["response.id exists"]},"evidence":["..."],"candidates":[{"endpointId":"...","method":"...","path":"...","reasoning":"..."}]}]}`;

// ============================================================
// Error Classification
// ============================================================

const ErrorType = {
  RATE_LIMIT: "RATE_LIMIT",
  AUTH_ERROR: "AUTH_ERROR",
  TIMEOUT: "TIMEOUT",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  INVALID_AI_RESPONSE: "INVALID_AI_RESPONSE",
  UNKNOWN: "UNKNOWN",
};

function classifyHttpError(status, body) {
  if (status === 429) return ErrorType.RATE_LIMIT;
  if (status === 401 || status === 403) return ErrorType.AUTH_ERROR;
  if (status >= 500) return ErrorType.PROVIDER_ERROR;
  if (status >= 400) return ErrorType.PROVIDER_ERROR;
  return ErrorType.UNKNOWN;
}

function classifyFetchError(error) {
  const msg = (error.message || "").toLowerCase();
  if (msg.includes("timeout") || msg.includes("abort") || msg.includes("timed out")) {
    return ErrorType.TIMEOUT;
  }
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("econnreset")) {
    return ErrorType.PROVIDER_ERROR;
  }
  return ErrorType.UNKNOWN;
}

function classifyParseError(error) {
  return ErrorType.INVALID_AI_RESPONSE;
}

function isAiAvailableV2() {
  const aiConfig = getAiConfig();
  const isOllama = (aiConfig.baseUrl || "").toLowerCase().includes("localhost:11434") ||
                   (aiConfig.provider || "").toLowerCase() === "ollama";
  if (isOllama) {
    return Boolean(aiConfig.baseUrl && aiConfig.model);
  }
  return Boolean(aiConfig.apiKey && aiConfig.baseUrl && aiConfig.model);
}

// ============================================================
// Provider Interface — OpenAI-compatible chat completion
// ============================================================

function getAiConfig() {
  return {
    provider: config.ai.provider,
    apiKey: config.ai.apiKey,
    model: config.ai.model,
    baseUrl: config.ai.baseUrl,
  };
}

async function callChatCompletion(messages, signal) {
  const aiConfig = getAiConfig();
  
  // Build headers - Ollama doesn't require Bearer auth
  const isOllama = (aiConfig.baseUrl || "").toLowerCase().includes("localhost:11434") ||
                   (aiConfig.provider || "").toLowerCase() === "ollama";
  
  const headers = {
    "Content-Type": "application/json",
  };
  
  if (!isOllama && aiConfig.apiKey) {
    headers["Authorization"] = `Bearer ${aiConfig.apiKey}`;
  }
  
  const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: aiConfig.model,
      messages,
      temperature: 0.2,
      max_tokens: 4000,
      ...(isOllama ? { format: "json" } : {}),
    }),
    signal,
  });

  return response;
}

// ============================================================
// Response Parsing — Extract test cases from LLM output
// ============================================================

function parseAiResponse(content) {
  let cleaned = content;

  // Try to extract content from triple backtick fences with optional json tag
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const fenceMatch = cleaned.match(fenceRegex);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    // Find the first viable JSON object payload
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      cleaned = content.slice(jsonStart, jsonEnd + 1);
    }
  }

  // Remove any remaining backtick characters that may have been missed
  cleaned = cleaned.replace(/`/g, '').trim();

  // Try direct parse first, then repair, then relaxed extraction
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_firstErr) {
    const repaired = repairJson(cleaned);
    try {
      parsed = JSON.parse(repaired);
    } catch (_secondErr) {
      // Relaxed fallback: if the model returned explanatory text with embedded JSON,
      // extract the largest JSON object/array we can find.
      const relaxed = extractLargestJson(cleaned || content);
      if (relaxed !== null) {
        parsed = relaxed;
      } else {
        throw new Error(`AI content not JSON: ${_secondErr.message}`);
      }
    }
  }

  if (!Array.isArray(parsed.testCases)) {
    throw new Error("Missing testCases array in AI response");
  }

  return parsed.testCases;
}

function extractLargestJson(text) {
  const starts = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') starts.push(i);
  }

  let best = null;
  let bestLen = -1;

  for (const start of starts) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    const opener = text[start];

    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === '\\' && inStr) {
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;

      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end > start) {
      const candidate = text.slice(start, end + 1);
      try {
        const parsed = JSON.parse(candidate);
        const len = JSON.stringify(parsed).length;
        if (len > bestLen) {
          bestLen = len;
          best = parsed;
        }
      } catch (_e) {
        // skip invalid candidate
      }
    }
  }

  return best;
}

// ============================================================
// Main Generation — Provider-agnostic with diagnostics
// ============================================================

async function generateWithAiV2(requirement, contract, options = {}) {
  const aiConfig = getAiConfig();
  const diagnostics = {
    aiProvider: aiConfig.provider,
    aiModel: aiConfig.model,
    aiAttempted: 0,
    aiSucceeded: false,
    aiErrorType: null,
    aiErrorDetail: null,
    aiLatencyMs: null,
  };

  if (!isAiAvailableV2()) {
    return {
      success: false,
      reason: "AI provider not configured",
      testCases: [],
      diagnostics,
    };
  }

  const requirementOnly = !!options.requirementOnly;
  const systemPrompt = requirementOnly ? REQUIREMENT_ONLY_PROMPT : AI_V2_PROMPT;

  for (let attempt = 1; attempt <= 3; attempt++) {
    diagnostics.aiAttempted = attempt;
    const attemptStart = Date.now();

    try {
      const messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            requirement: {
              summary: requirement.summary,
              description: requirement.description,
              acceptanceCriteria: requirement.acceptanceCriteria,
            },
            ...(requirementOnly ? {} : { contract: contract }),
          }),
        },
      ];

      const controller = new AbortController();
      const timeoutMs = Number(config.ai.timeoutMs) || 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response;
      try {
        response = await callChatCompletion(messages, controller.signal);
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await response.text();
      diagnostics.aiLatencyMs = Date.now() - attemptStart;

      if (!response.ok) {
        const errorType = classifyHttpError(response.status, text);
        diagnostics.aiErrorType = errorType;
        diagnostics.aiErrorDetail = `HTTP ${response.status}: ${text.slice(0, 200)}`;

        if (attempt === 3) {
          return {
            success: false,
            reason: diagnostics.aiErrorDetail,
            testCases: [],
            diagnostics,
          };
        }

        // Rate limit backoff
        const waitMs = errorType === ErrorType.RATE_LIMIT ? 10000 * attempt : 1000 * attempt;
        console.log(`[ai] ${errorType} attempt ${attempt}/3, waiting ${waitMs}ms`);
        await delay(waitMs);
        continue;
      }

      // Parse AI response
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.log("[ai] RAW_RESPONSE", String(text).slice(0, 500));
        throw err;
      }
      const content = (data.choices?.[0]?.message?.content || "{}").trim();
      console.log("[ai] AI_CONTENT", String(content).slice(0, 300));

      let testCases;
      try {
        testCases = parseAiResponse(content);
      } catch (parseError) {
        diagnostics.aiErrorType = ErrorType.INVALID_AI_RESPONSE;
        diagnostics.aiErrorDetail = parseError.message;

        if (attempt === 3) {
          return {
            success: false,
            reason: `Invalid AI response: ${parseError.message}`,
            testCases: [],
            diagnostics,
          };
        }

        console.log(`[ai] ${ErrorType.INVALID_AI_RESPONSE} attempt ${attempt}/3, retrying...`);
        await delay(3000 * attempt);
        continue;
      }

      diagnostics.aiSucceeded = true;
      diagnostics.aiErrorType = null;
      diagnostics.aiErrorDetail = null;

      return {
        success: true,
        testCases,
        model: aiConfig.model,
        diagnostics,
      };

    } catch (error) {
      diagnostics.aiLatencyMs = Date.now() - attemptStart;
      const errorType = classifyFetchError(error);
      diagnostics.aiErrorType = errorType;
      diagnostics.aiErrorDetail = error.message;

      if (attempt === 3) {
        return {
          success: false,
          reason: error.message,
          testCases: [],
          diagnostics,
        };
      }

      // Timeout: do not retry repeated timeouts; fail fast for local Ollama
      const waitMs = errorType === ErrorType.TIMEOUT ? 0 : 3000 * attempt;
      if (errorType === ErrorType.TIMEOUT) {
        console.log(`[ai] ${errorType} attempt ${attempt}/3: ${error.message}, no retry`);
      } else {
        console.log(`[ai] ${errorType} attempt ${attempt}/3: ${error.message}, waiting ${waitMs}ms`);
      }
      if (waitMs > 0) {
        await delay(waitMs);
      }
    }
  }

  return {
    success: false,
    reason: "Max retries exceeded",
    testCases: [],
    diagnostics,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  generateWithAiV2,
  isAiAvailableV2,
  ErrorType,
};
