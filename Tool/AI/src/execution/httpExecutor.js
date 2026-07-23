/**
 * Shared HTTP Executor
 *
 * Production-hardened single-request execution logic extracted for reuse.
 * Used by dependencyAwareExecutor.js and related execution flows.
 */

const config = require("../config");
const { validateResponse } = require("../validation/validators");

/**
 * Comprehensive secret redaction for execution evidence.
 */
function redactSecrets(value) {
  if (value === null || value === undefined) return value;
  
  const str = String(value);
  
  // Check for Bearer authorization prefix
  if (str.toLowerCase().includes("bearer ")) {
    return "[AUTH_TOKEN_REDACTED]";
  }
  
  // Check for long token-like values
  if (/[a-zA-Z0-9]{20,}/.test(str) && /token|auth|secret|key|credential/i.test(str)) {
    return "[SECRET_REDACTED]";
  }
  
  // Check for password patterns
  if (/password|passwd|pwd/i.test(str) && /["'][^"']{8,}["']/.test(str)) {
    return "[PASSWORD_REDACTED]";
  }
  
  return value;
}

function redactHeaders(headers = {}) {
  const redacted = {};
  if (!headers || typeof headers !== 'object') return redacted;
  for (const [key, value] of Object.entries(headers)) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes("authorization") || 
        keyLower.includes("token") || 
        keyLower.includes("secret") || 
        keyLower.includes("api-key") || 
        keyLower.includes("apikey") || 
        keyLower.includes("password") ||
        keyLower.includes("credential")) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Parse response body based on content-type.
 */
function parseResponseBody(text, contentType) {
  if (!text) return null;
  if ((contentType || "").includes("json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Execute a single HTTP request with full production hardening.
 */
async function executeHttpRequest(request, options = {}) {
  const {
    timeoutMs = config.requestTimeoutMs,
    dryRun = false,
    variables = {},
    endpoint = null,
    scenario = null,
  } = options;

  const startedAt = new Date().toISOString();

  // Resolve Postman {{variable}} patterns
  function resolveVariables(value) {
    if (typeof value === "string") {
      return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        return variables[key] !== undefined ? variables[key] : `{{${key}}}`;
      });
    }
    return value;
  }

  // Resolve variables recursively in objects
  function resolveVariablesRecursive(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "string") return resolveVariables(obj);
    if (Array.isArray(obj)) return obj.map(resolveVariablesRecursive);
    if (typeof obj === "object") {
      const result = {};
      for (const [key, val] of Object.entries(obj)) {
        result[key] = resolveVariablesRecursive(val);
      }
      return result;
    }
    return obj;
  }

  // Build the final request with variable resolution
  const method = (request.method || "GET").toUpperCase();
  const headers = resolveVariablesRecursive(request.headers || {});
  const url = resolveVariables(request.url || "");
  const body = request.body ? resolveVariablesRecursive(request.body) : null;

  // Check for unresolved variables
  const unresolvedPattern = /\{\{([^}]+)\}\}/g;
  const unresolvedInUrl = url.match(unresolvedPattern);
  const unresolvedInBody = body ? JSON.stringify(body).match(unresolvedPattern) : null;
  
  if (unresolvedInUrl || unresolvedInBody) {
    return {
      status: "blocked",
      error: "Unresolved variable(s): " + (unresolvedInUrl || unresolvedInBody || []).map(m => m.slice(2, -2)).join(", "),
      startedAt,
      finishedAt: new Date().toISOString(),
      request: {
        method,
        url,
        headers: redactHeaders(headers),
        body: body ? resolveVariablesRecursive(body) : null,
      },
      response: null,
      validation: { assertions: [], passed: false, failed: false },
    };
  }

  // Dry run - no actual HTTP call
  if (dryRun) {
    return {
      status: "dry_run",
      startedAt,
      finishedAt: new Date().toISOString(),
      request: {
        method,
        url,
        headers: redactHeaders(headers),
        body,
      },
      response: null,
      validation: { assertions: [], passed: false, failed: false },
      note: "Dry run only. No API request was sent.",
    };
  }

  // Actual HTTP execution with timeout/retry
  const hasBody = !["GET", "HEAD"].includes(method);
  if (hasBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let lastError = null;
  const maxRetries = 1;
  const requestStarted = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      const responseBody = parseResponseBody(text, response.headers.get("content-type"));
      const responseTimeMs = Date.now() - requestStarted;

      const validation = validateResponse({
        scenario,
        endpoint,
        status: response.status,
        body: responseBody,
        responseTimeMs,
      });

      // Redact secrets from response body for evidence
      const safeResponseBody = redactSecretsFromObject(responseBody);

      return {
        status: validation.failed ? "failed" : validation.passed ? "passed" : "needs_review",
        startedAt,
        finishedAt: new Date().toISOString(),
        request: {
          method,
          url,
          headers: redactHeaders(headers),
          body,
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: safeResponseBody,
          size: text.length,
        },
        validation,
        responseTimeMs,
        retryAttempt: attempt > 0 ? attempt : 0,
      };
    } catch (error) {
      lastError = error;
      if ((error.name === "AbortError" || 
           error.message.includes("fetch") || 
           error.message.includes("network")) && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      break;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    status: "failed",
    startedAt,
    finishedAt: new Date().toISOString(),
    request: {
      method,
      url,
      headers: redactHeaders(headers),
      body,
    },
    response: null,
    validation: { assertions: [], passed: false, failed: false },
    error: lastError ? (lastError.name === "AbortError" ? "Request timed out." : lastError.message) : "Request failed.",
  };
}

/**
 * Redact secrets from response objects recursively.
 */
function redactSecretsFromObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return redactSecrets(obj);
  if (Array.isArray(obj)) return obj.map(redactSecretsFromObject);
  if (typeof obj === "object") {
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes("token") || 
          keyLower.includes("secret") || 
          keyLower.includes("password") ||
          keyLower.includes("api_key") ||
          keyLower.includes("apikey") ||
          keyLower.includes("authorization")) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSecretsFromObject(val);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Check if required bindings are satisfied.
 */
function validateRequiredBindings(bindings, responses) {
  const missingBindings = [];
  
  for (const binding of bindings) {
    const { location, required = false } = binding;
    if (!required) continue;
    
    const sourceResponse = responses.get(`${binding.from?.serviceId}::${binding.from?.operationId}`);
    if (!sourceResponse) {
      missingBindings.push(location);
      continue;
    }
    
    // Try to extract the value from the response
    const value = extractValueFromLocation(sourceResponse, location);
    if (value === undefined) {
      missingBindings.push(location);
    }
  }
  
  return missingBindings.length > 0 ? missingBindings : null;
}

/**
 * Extract value from response using location string.
 */
function extractValueFromLocation(response, location) {
  if (!response || !location) return undefined;
  
  // Parse location like "response.body.token"
  const parts = location.split(".");
  if (parts.length < 3) return undefined;
  
  let current = response;
  // Skip "response" prefix, get to container (headers/body/query/path)
  const container = parts[1];
  if (container === "body" && response.body !== undefined) {
    current = response.body;
  } else if (container === "headers" && response.headers !== undefined) {
    current = response.headers;
  }
  
  // Navigate remaining path
  for (let i = 2; i < parts.length; i++) {
    if (current === undefined || current === null) return undefined;
    current = current[parts[i]];
  }
  
  return current;
}

module.exports = {
  executeHttpRequest,
  redactHeaders,
  redactSecrets,
  redactSecretsFromObject,
  parseResponseBody,
  validateRequiredBindings,
  extractValueFromLocation,
};