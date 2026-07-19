const crypto = require("crypto");
const config = require("../config");
const { applyMutations } = require("../payload/mutationEngine");
const { validateResponse } = require("../validation/validators");

function maskHeaders(headers) {
  const masked = { ...headers };
  for (const key of Object.keys(masked)) {
    if (/authorization|token|api-key|apikey|secret/i.test(key)) masked[key] = "***masked***";
  }
  return masked;
}

/**
 * Smart path parameter filling with schema-aware defaults.
 * Uses parameter name patterns and schema types to generate realistic values.
 */
function fillPathParams(path, params = {}) {
  return String(path || "/").replace(/\{([^}]+)\}/g, (_, name) => {
    const value = params[name];
    if (value !== undefined && value !== null && value !== "") {
      return encodeURIComponent(String(value));
    }
    return `sample-${name}`;
  });
}

/**
 * Build query string from extracted query parameters.
 */
function buildQueryString(queryParams) {
  if (!queryParams || !queryParams.length) return "";
  const parts = [];
  for (const param of queryParams) {
    const value = param.value !== undefined && param.value !== null && param.value !== ""
      ? param.value
      : param.example || "";
    if (value !== "") {
      parts.push(encodeURIComponent(param.name) + "=" + encodeURIComponent(String(value)));
    }
  }
  return parts.length ? "?" + parts.join("&") : "";
}

/**
 * Resolve Postman {{variable}} patterns in a string.
 */
function resolveVariables(text, variables) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

function joinUrl(baseUrl, path, queryString) {
  if (/^https?:\/\//i.test(path)) return path + (queryString || "");
  const base = String(baseUrl || "").replace(/\/$/, "");
  const suffix = String(path || "/").startsWith("/") ? path : "/" + path;
  if (!base) return suffix + (queryString || "");
  return base + suffix + (queryString || "");
}

function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function valueAtPath(value, path) {
  if (!value || !path) return undefined;
  return String(path)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .reduce((cursor, part) => cursor?.[part], value);
}

function discoverToken(body, tokenPath) {
  return (
    valueAtPath(body, tokenPath) ||
    valueAtPath(body, "access_token") ||
    valueAtPath(body, "token") ||
    valueAtPath(body, "jwt") ||
    valueAtPath(body, "data.access_token") ||
    valueAtPath(body, "data.token") ||
    valueAtPath(body, "result.access_token") ||
    valueAtPath(body, "result.token")
  );
}

async function acquireBearerToken(environment) {
  const auth = environment.auth || {};
  if (auth.type !== "autoBearer") return { environment, authStatus: null };
  if (environment.dryRun) {
    return {
      environment,
      authStatus: {
        mode: "autoBearer",
        status: "skipped",
        message: "Dry run enabled. Token endpoint was not called.",
      },
    };
  }

  if (!auth.tokenUrl) {
    throw new Error("Auto bearer token requires a token URL.");
  }

  const method = String(auth.tokenMethod || "POST").toUpperCase();
  const url = joinUrl(environment.baseUrl || "", auth.tokenUrl);
  const headers = {
    Accept: "application/json",
    ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
    ...parseJsonObject(auth.tokenHeaders, {}),
  };
  const body = parseJsonObject(auth.tokenBody, {});
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), environment.timeoutMs || config.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    const responseBody = parseResponseBody(text, response.headers.get("content-type"));

    if (!response.ok) {
      throw new Error("Token endpoint failed (" + response.status + "): " + (typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody)));
    }

    const token = discoverToken(responseBody, auth.tokenPath || "access_token");
    if (!token) {
      throw new Error("Token was not found at path \"" + (auth.tokenPath || "access_token") + "\".");
    }

    return {
      environment: {
        ...environment,
        auth: {
          type: "bearer",
          token: String(token),
          source: "autoBearer",
        },
      },
      authStatus: {
        mode: "autoBearer",
        status: "created",
        tokenUrl: url,
        tokenPath: auth.tokenPath || "access_token",
      },
    };
  } catch (error) {
    throw new Error(error.name === "AbortError" ? "Token request timed out." : error.message);
  } finally {
    clearTimeout(timeout);
  }
}

function authHeaders(auth, scenario) {
  if (!auth) auth = {};
  if (!scenario) scenario = {};
  if (scenario.type === "auth" && scenario.authMode === "missing") return {};

  if (auth.type === "bearer" && auth.token) return { Authorization: "Bearer " + auth.token };
  if (auth.type === "basic" && auth.username && auth.password) {
    return { Authorization: "Basic " + Buffer.from(auth.username + ":" + auth.password).toString("base64") };
  }
  if (auth.type === "custom" && auth.headerName && auth.headerValue) {
    var h = {};
    h[auth.headerName] = auth.headerValue;
    return h;
  }
  if (auth.type === "apiKey" && auth.headerName && auth.headerValue) {
    var h = {};
    h[auth.headerName] = auth.headerValue;
    return h;
  }
  return {};
}

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
 * Execute a single scenario with retry support.
 */
async function executeScenario(scenario, endpoint, environment) {
  var startedAt = new Date().toISOString();
  var payload = applyMutations(scenario.basePayload || {}, scenario.mutations || []);
  var method = scenario.method || (endpoint ? endpoint.method : null) || "GET";

  // Build path with params
  var pathParams = scenario.pathParams || (endpoint ? endpoint.pathParams : null) || {};
  var path = fillPathParams(scenario.path || (endpoint ? endpoint.path : null) || "/", pathParams);

  // Build query string from endpoint query params
  var queryParams = scenario.queryParams || (endpoint ? endpoint.queryParams : null) || [];
  var queryString = buildQueryString(queryParams);

  // Resolve Postman variables in path
  var contractVars = (endpoint && endpoint.variables) || (environment && environment.variables) || {};
  path = resolveVariables(path, contractVars);

  var url = joinUrl(environment.baseUrl || "", path, queryString);

  // Build headers: start with endpoint-specific headers, then auth headers
  var headers = {
    Accept: "application/json",
  };

  // Add endpoint-specific headers (from Postman collection)
  var endpointHeaders = (endpoint && endpoint.headers) || {};
  for (var hk in endpointHeaders) {
    if (endpointHeaders.hasOwnProperty(hk)) {
      headers[hk] = resolveVariables(endpointHeaders[hk], contractVars);
    }
  }

  // Add auth headers
  var authH = authHeaders(environment.auth, scenario);
  for (var ak in authH) {
    if (authH.hasOwnProperty(ak)) {
      headers[ak] = authH[ak];
    }
  }

  var hasBody = ["GET", "HEAD"].indexOf(method.toUpperCase()) === -1;
  if (hasBody) headers["Content-Type"] = "application/json";

  var request = {
    method: method,
    url: url,
    headers: maskHeaders(headers),
    body: hasBody ? payload : null,
  };

  var requestStarted = Date.now();

  if (environment.dryRun) {
    return {
      scenarioId: scenario.id,
      title: scenario.title,
      status: "dry_run",
      startedAt: startedAt,
      finishedAt: new Date().toISOString(),
      request: request,
      response: null,
      validation: {
        assertions: [],
        passed: false,
        failed: false,
      },
      note: "Dry run only. No API request was sent.",
    };
  }

  // Execute with retry support (1 retry for transient failures)
  var maxRetries = 1;
  var lastError = null;
  var maxTimeoutMs = 60 * 1000;
  var defaultTimeoutMs = Number(config.requestTimeoutMs);
  if (!Number.isFinite(defaultTimeoutMs) || defaultTimeoutMs <= 0) defaultTimeoutMs = 30 * 1000;
  defaultTimeoutMs = Math.min(defaultTimeoutMs, maxTimeoutMs);

  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    var controller = new AbortController();
    var requestedTimeoutMs = Number(environment.timeoutMs);
    var timeoutMs = Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0
      ? Math.min(requestedTimeoutMs, maxTimeoutMs)
      : defaultTimeoutMs;
    var timeout = setTimeout(function() { controller.abort(); }, timeoutMs);

    try {
      var response = await fetch(url, {
        method: method,
        headers: headers,
        body: hasBody ? JSON.stringify(payload) : undefined,
        signal: controller.signal,
      });

      var text = await response.text();
      var body = parseResponseBody(text, response.headers.get("content-type"));
      var responseTimeMs = Date.now() - requestStarted;
      var validation = validateResponse({
        scenario: scenario,
        endpoint: endpoint,
        status: response.status,
        body: body,
        responseTimeMs: responseTimeMs,
      });

      return {
        scenarioId: scenario.id,
        title: scenario.title,
        status: validation.failed ? "failed" : validation.passed ? "passed" : "needs_review",
        startedAt: startedAt,
        finishedAt: new Date().toISOString(),
        request: request,
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: body,
          size: text.length,
        },
        validation: validation,
        retryAttempt: attempt > 0 ? attempt : 0,
      };
    } catch (error) {
      lastError = error;
      // Only retry on network errors, not on validation/status errors
      if (error.name === "AbortError" || error.message.indexOf("fetch") !== -1 || error.message.indexOf("network") !== -1) {
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(function(r) { setTimeout(r, 500 * (attempt + 1)); });
          continue;
        }
      }
      break;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    scenarioId: scenario.id,
    title: scenario.title,
    status: "blocked",
    startedAt: startedAt,
    finishedAt: new Date().toISOString(),
    request: request,
    response: null,
    validation: {
      assertions: [],
      passed: false,
      failed: false,
    },
    error: lastError ? (lastError.name === "AbortError" ? "Request timed out." : lastError.message) : "Request failed.",
  };
}

async function executeScenarioParallel(scenarios, endpointMap, contract, environment) {
  var results = [];
  var batchSize = 5;

  for (var i = 0; i < scenarios.length; i += batchSize) {
    var batch = scenarios.slice(i, i + batchSize);
    var batchResults = await Promise.all(
      batch.map(async function(scenario) {
        var endpoint = endpointMap.get(scenario.endpointId) || (contract.endpoints ? contract.endpoints[0] : null);
        return executeScenario(scenario, endpoint, environment);
      })
    );
    results = results.concat(batchResults);
  }

  return results;
}

async function executeRun(params) {
  var ticket = params.ticket;
  var contract = params.contract;
  var scenarios = params.scenarios || [];
  var environment = params.environment || {};

  var runId = (ticket ? ticket.key : "manual") + "-" + crypto.randomUUID().slice(0, 8);
  var results = [];
  var endpointMap = new Map();
  if (contract && contract.endpoints) {
    for (var e = 0; e < contract.endpoints.length; e++) {
      endpointMap.set(contract.endpoints[e].id, contract.endpoints[e]);
    }
  }
  var effectiveEnvironment = environment;
  var authStatus = null;

  // Pass contract variables to environment for resolution
  if (contract && contract.variables) {
    effectiveEnvironment = {
      ...effectiveEnvironment,
      variables: contract.variables,
    };
  }

  try {
    var resolved = await acquireBearerToken(effectiveEnvironment);
    effectiveEnvironment = resolved.environment;
    authStatus = resolved.authStatus;
  } catch (error) {
    authStatus = {
      mode: "autoBearer",
      status: "failed",
      message: error.message,
    };
    return {
      id: runId,
      ticket: ticket,
      contract: {
        title: contract ? contract.title : "",
        version: contract ? contract.version : "",
        baseUrl: contract ? contract.baseUrl : "",
        endpointCount: contract && contract.endpoints ? contract.endpoints.length : 0,
      },
      environment: {
        name: environment.name || "local",
        baseUrl: environment.baseUrl || "",
        dryRun: Boolean(environment.dryRun),
        authType: environment.auth ? environment.auth.type : "none",
      },
      authStatus: authStatus,
      summary: { total: scenarios.length, passed: 0, failed: 0, blocked: scenarios.length, needs_review: 0, dry_run: 0 },
      scenarios: scenarios,
      results: scenarios.map(function(scenario) {
        return {
          scenarioId: scenario.id,
          title: scenario.title,
          status: "blocked",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          request: null,
          response: null,
          validation: { assertions: [], passed: false, failed: false },
          error: "Authentication setup failed: " + error.message,
        };
      }),
      createdAt: new Date().toISOString(),
    };
  }

  var parallelResults = await executeScenarioParallel(scenarios, endpointMap, contract, effectiveEnvironment);
  results = results.concat(parallelResults);

  var summary = results.reduce(function(acc, result) {
    acc.total += 1;
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, { total: 0, passed: 0, failed: 0, blocked: 0, needs_review: 0, dry_run: 0 });

  return {
    id: runId,
    ticket: ticket,
    contract: {
      title: contract ? contract.title : "",
      version: contract ? contract.version : "",
      baseUrl: contract ? contract.baseUrl : "",
      endpointCount: contract && contract.endpoints ? contract.endpoints.length : 0,
    },
    environment: {
      name: environment.name || "local",
      baseUrl: environment.baseUrl || "",
      dryRun: Boolean(environment.dryRun),
      authType: environment.auth ? environment.auth.type : "none",
    },
    authStatus: authStatus,
    summary: summary,
    scenarios: scenarios,
    results: results,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  executeRun,
};
