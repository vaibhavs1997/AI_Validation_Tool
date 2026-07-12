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

function fillPathParams(path, params = {}) {
  return String(path || "/").replace(/\{([^}]+)\}/g, (_, name) => encodeURIComponent(params[name] || "sample-id"));
}

function joinUrl(baseUrl, path) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(baseUrl || "").replace(/\/$/, "");
  const suffix = String(path || "/").startsWith("/") ? path : `/${path}`;
  if (!base) return suffix;
  return `${base}${suffix}`;
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
      throw new Error(`Token endpoint failed (${response.status}): ${typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody)}`);
    }

    const token = discoverToken(responseBody, auth.tokenPath || "access_token");
    if (!token) {
      throw new Error(`Token was not found at path "${auth.tokenPath || "access_token"}".`);
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

function authHeaders(auth = {}, scenario = {}) {
  if (scenario.type === "auth" && scenario.authMode === "missing") return {};

  if (auth.type === "bearer" && auth.token) return { Authorization: `Bearer ${auth.token}` };
  if (auth.type === "basic" && auth.username && auth.password) {
    return { Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}` };
  }
  if (auth.type === "custom" && auth.headerName && auth.headerValue) {
    return { [auth.headerName]: auth.headerValue };
  }
  if (auth.type === "apiKey" && auth.headerName && auth.headerValue) {
    return { [auth.headerName]: auth.headerValue };
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

async function executeScenario({ scenario, endpoint, environment }) {
  const startedAt = new Date().toISOString();
  const payload = applyMutations(scenario.basePayload || {}, scenario.mutations || []);
  const method = scenario.method || endpoint?.method || "GET";
  const url = joinUrl(environment.baseUrl || "", fillPathParams(scenario.path || endpoint?.path || "/", scenario.pathParams));

  const headers = {
    Accept: "application/json",
    ...authHeaders(environment.auth, scenario),
  };

  const hasBody = !["GET", "HEAD"].includes(method.toUpperCase());
  if (hasBody) headers["Content-Type"] = "application/json";

  const request = {
    method,
    url,
    headers: maskHeaders(headers),
    body: hasBody ? payload : null,
  };

  if (environment.dryRun) {
    return {
      scenarioId: scenario.id,
      title: scenario.title,
      status: "dry_run",
      startedAt,
      finishedAt: new Date().toISOString(),
      request,
      response: null,
      validation: {
        assertions: [],
        passed: false,
        failed: false,
      },
      note: "Dry run only. No API request was sent.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), environment.timeoutMs || config.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    const body = parseResponseBody(text, response.headers.get("content-type"));
    const validation = validateResponse({
      scenario,
      endpoint,
      status: response.status,
      body,
    });

    return {
      scenarioId: scenario.id,
      title: scenario.title,
      status: validation.failed ? "failed" : validation.passed ? "passed" : "needs_review",
      startedAt,
      finishedAt: new Date().toISOString(),
      request,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      },
      validation,
    };
  } catch (error) {
    return {
      scenarioId: scenario.id,
      title: scenario.title,
      status: "blocked",
      startedAt,
      finishedAt: new Date().toISOString(),
      request,
      response: null,
      validation: {
        assertions: [],
        passed: false,
        failed: false,
      },
      error: error.name === "AbortError" ? "Request timed out." : error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function executeRun({ ticket, contract, scenarios, environment }) {
  const runId = `${ticket?.key || "manual"}-${Date.now()}`;
  const results = [];
  const endpointMap = new Map((contract.endpoints || []).map((endpoint) => [endpoint.id, endpoint]));
  let effectiveEnvironment = environment || {};
  let authStatus = null;

  try {
    const resolved = await acquireBearerToken(effectiveEnvironment);
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
      ticket,
      contract: {
        title: contract.title,
        version: contract.version,
        baseUrl: contract.baseUrl,
        endpointCount: contract.endpoints?.length || 0,
      },
      environment: {
        name: environment.name || "local",
        baseUrl: environment.baseUrl || "",
        dryRun: Boolean(environment.dryRun),
        authType: environment.auth?.type || "none",
      },
      authStatus,
      summary: { total: scenarios.length, passed: 0, failed: 0, blocked: scenarios.length, needs_review: 0, dry_run: 0 },
      scenarios,
      results: scenarios.map((scenario) => ({
        scenarioId: scenario.id,
        title: scenario.title,
        status: "blocked",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        request: null,
        response: null,
        validation: { assertions: [], passed: false, failed: false },
        error: `Authentication setup failed: ${error.message}`,
      })),
      createdAt: new Date().toISOString(),
    };
  }

  for (const scenario of scenarios) {
    const endpoint = endpointMap.get(scenario.endpointId) || contract.endpoints?.[0];
    results.push(await executeScenario({ scenario, endpoint, environment: effectiveEnvironment }));
  }

  const summary = results.reduce(
    (acc, result) => {
      acc.total += 1;
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    },
    { total: 0, passed: 0, failed: 0, blocked: 0, needs_review: 0, dry_run: 0 }
  );

  return {
    id: runId,
    ticket,
    contract: {
      title: contract.title,
      version: contract.version,
      baseUrl: contract.baseUrl,
      endpointCount: contract.endpoints?.length || 0,
    },
    environment: {
      name: environment.name || "local",
      baseUrl: environment.baseUrl || "",
      dryRun: Boolean(environment.dryRun),
      authType: environment.auth?.type || "none",
    },
    authStatus,
    summary,
    scenarios,
    results,
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  executeRun,
};
