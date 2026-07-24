/**
 * Main Server - STEP 10.11
 * V2 production generator with explicit diagnostics
 * STEP 4.23 - TestSpecification + Planning API
 * STEP 4.24 - Dependency-Aware Execution API
 */

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const config = require("./config");
const storage = require("./storage");
const jiraClient = require("./integrations/jiraClient");
const llmClient = require("./integrations/llmClient");
const { parseContract } = require("./contracts/contractParser");
const { compareContracts } = require("./contracts/openapiDiff");
const { generateTestCases } = require("./engine/testCaseGenerator");
const { matchTestCasesToApis } = require("./engine/matching/testCaseMatcher");
const { prepareTestSpecifications } = require("./engine/testSpecificationBridge");
const { createProjectContext } = require("./domain/ProjectContext");
const {
  createProject,
  getProject,
  listProjects,
  projectExists,
  seedDefaultProject,
} = require("./domain/ProjectRepository");
const {
  createService,
  getService,
  listServices,
  saveApiModel,
  getApiModel,
  serviceExists,
} = require("./domain/ServiceRepository");
const { adaptContractToApiModel } = require("./domain/contractAdapter");
const {
  analyzeAndStoreProposals,
  listRelationshipsByStatus,
  confirmRelationship,
  rejectRelationship,
  STATUSES,
} = require("./domain/ProjectKnowledgeService");
const { DEFAULT_PROJECT } = require("./domain/ProjectIdentity");
const { executeTestSpecification } = require("./execution/dependencyAwareExecutor");
const { validatePlan } = require("./domain/ExecutionPlan");
const { saveRun, getRun, listRuns } = require("./domain/RunRepository");
const { migrate } = require("./db/migrate");
const { checkConnection } = require("./db/pool");

storage.ensureStorage();

// Seed default project — handles both sync (file) and async (PostgreSQL) backends
const seedResult = seedDefaultProject();
if (seedResult && typeof seedResult.then === 'function') {
  seedResult.catch(err => console.error('[startup] Default project seed failed:', err.message));
}

// Run PostgreSQL migration if enabled (non-blocking — file repos still work)
if (config.pg.enabled) {
  migrate().then((result) => {
    if (result.applied) {
      console.log('[startup] PostgreSQL schema ready');
    } else if (result.error) {
      console.error('[startup] PostgreSQL migration error:', result.error);
    } else {
      console.log('[startup] PostgreSQL disabled, skipping migration');
    }
    // Verify connectivity
    checkConnection().then((status) => {
      if (status.connected) {
        console.log('[startup] PostgreSQL connected');
      } else {
        console.log('[startup] PostgreSQL status:', status.reason);
      }
    });
  });
}

// Ensure projects are loadable even when default/project state changes later
function reSeedDefaults() {
  try { seedDefaultProject(); } catch {}
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function send(res, status, body, headers = {}) {
  if (!headers["Access-Control-Allow-Origin"]) {
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
  }
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data, null, 2), {
    "Content-Type": "application/json; charset=utf-8",
  });
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    req.on("error", reject);
  });
}

function serveFile(res, filePath, baseDir) {
  const resolved = path.resolve(filePath);
  const base = path.resolve(baseDir);
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return notFound(res);
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) return notFound(res);
  send(res, 200, fs.readFileSync(resolved), {
    "Content-Type": contentTypes[path.extname(resolved)] || "application/octet-stream",
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      app: "AI API Validation Tool MVP",
      time: new Date().toISOString(),
    });
  }

  if (req.method === "GET" && url.pathname === "/api/config/status") {
    return sendJson(res, 200, {
      jiraConfigured: jiraClient.isConfigured(),
      aiConfigured: llmClient.isConfigured(),
      aiModel: config.ai.model,
      port: config.port,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/runs") {
    return sendJson(res, 200, storage.listRunSummaries());
  }

  const runReportMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\.html$/);
  if (req.method === "GET" && runReportMatch) {
    const reportFile = storage.reportPath(runReportMatch[1]);
    if (!fs.existsSync(reportFile)) return notFound(res);
    return serveFile(res, reportFile, storage.buckets.reports);
  }

  const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
  if (req.method === "GET" && runMatch) {
    const run = storage.readJson("runs", runMatch[1]);
    return run ? sendJson(res, 200, run) : notFound(res);
  }

  if (req.method === "DELETE" && runMatch) {
    const result = storage.deleteRun(runMatch[1]);
    return sendJson(res, 200, { success: true, message: "Run deleted successfully", ...result });
  }

  // GET endpoints that need to work before POST-only check
  // =================================================================
  // Project Management Endpoints (GET)
  // =================================================================

  // List projects
  if (req.method === "GET" && url.pathname === "/api/projects") {
    return sendJson(res, 200, { projects: listProjects() });
  }

  // Get project
  if (req.method === "GET" && url.pathname.match(/^\/api\/projects\/([^/]+)$/)) {
    const match = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    const projectId = match[1];
    const project = getProject(projectId);
    return project ? sendJson(res, 200, { project }) : notFound(res);
  }

  // List services for a project
  if (req.method === "GET" && url.pathname === "/api/services") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    return sendJson(res, 200, { services: listServices(projectId) });
  }

  // Get a specific service
  if (req.method === "GET" && url.pathname.match(/^\/api\/services\/[^/]+\/[^/]+$/)) {
    const match = url.pathname.match(/^\/api\/services\/([^/]+)\/([^/]+)$/);
    const projectId = match[1];
    const serviceId = match[2];
    const service = getService(projectId, serviceId);
    if (!service) return notFound(res);
    const apiModel = getApiModel(projectId, serviceId);
    return sendJson(res, 200, { service, apiModel });
  }

  // Get project knowledge (instructions + relationships)
  if (req.method === "GET" && url.pathname === "/api/knowledge") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const knowledge = require("./domain/ProjectKnowledgeRepository").getProjectKnowledge(projectId);
    return sendJson(res, 200, { knowledge: knowledge || { relationships: [] } });
  }

  // List relationships by status
  if (req.method === "GET" && url.pathname.match(/^\/api\/knowledge\/relationships\/([^/]+)$/)) {
    const match = url.pathname.match(/^\/api\/knowledge\/relationships\/([^/]+)$/);
    const status = match[1];
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;

    if (!STATUSES.includes(status)) {
      return sendJson(res, 400, { error: "Invalid status. Use: proposed, confirmed, rejected" });
    }

    const relationships = listRelationshipsByStatus(projectId, status);
    return sendJson(res, 200, { relationships });
  }

  // STEP 5.8 - Project-scoped run endpoints (active workflow)
  const activeRunListMatch = url.pathname.match(/^\/api\/active\/runs$/);
  if (req.method === "GET" && activeRunListMatch) {
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return sendJson(res, 400, { error: "projectId query parameter required" });
    const runs = listRuns(projectId);
    return sendJson(res, 200, { runs });
  }

  const activeRunDetailMatch = url.pathname.match(/^\/api\/active\/runs\/([^/]+)$/);
  if (req.method === "GET" && activeRunDetailMatch) {
    const runId = activeRunDetailMatch[1];
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return sendJson(res, 400, { error: "projectId query parameter required" });
    const run = getRun(projectId, runId);
    if (!run) return notFound(res);
    return sendJson(res, 200, { run });
  }

  if (req.method !== "POST") return notFound(res);

  const body = await readBody(req);

  if (url.pathname === "/api/jira/ticket") {
    const ticket = await jiraClient.fetchIssue(body.issueKey);
    storage.saveJson("tickets", ticket.key, ticket);
    return sendJson(res, 200, { ticket });
  }

  if (url.pathname === "/api/jira/jql") {
    const result = await jiraClient.searchIssues(body.jql, body.maxResults || 10);
    return sendJson(res, 200, result);
  }

  if (url.pathname === "/api/contracts/parse") {
    const contract = parseContract(body.contract || body.content);
    storage.saveJson("contracts", body.name || contract.title || "contract", contract);
    return sendJson(res, 200, { contract });
  }

  if (url.pathname === "/api/contracts/diff") {
    const oldContract = parseContract(body.oldContract || body.old);
    const newContract = parseContract(body.newContract || body.new);
    const diff = compareContracts(oldContract, newContract);
    return sendJson(res, 200, { diff });
  }

  // STEP 5.5B - TestCase Generation API
  if (url.pathname === "/api/test-cases/generate") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const ticket = body.ticket || {};

    const project = getProject(projectId);
    if (!project) {
      return sendJson(res, 400, { error: `Project not found: ${projectId}` });
    }

    const result = await generateTestCases({ projectId, ticket });

    return sendJson(res, 200, {
      projectId: result.projectId,
      testCases: result.testCases,
      diagnostics: result.diagnostics,
      warnings: result.warnings,
    });
  }

  // STEP 5.5D - TestCase → API Endpoint Matching
  if (url.pathname === "/api/test-cases/match") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const testCases = body.testCases || [];

    // Validate project exists
    const project = getProject(projectId);
    if (!project) {
      return sendJson(res, 400, { error: `Project not found: ${projectId}` });
    }

    // Validate test cases
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return sendJson(res, 400, { error: "testCases array is required and must not be empty" });
    }

    // Match test cases against registered project APIs (deterministic, no AI)
    const result = matchTestCasesToApis({ projectId, testCases });

    return sendJson(res, 200, result);
  }

  // STEP 5.5E - Prepare TestSpecifications from confirmed TestCase/API mappings
  if (url.pathname === "/api/test-specifications/prepare") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const testCases = body.testCases || [];
    const mappings = body.mappings || [];

    // Validate project exists
    const project = getProject(projectId);
    if (!project) {
      return sendJson(res, 400, { error: `Project not found: ${projectId}` });
    }

    // Validate inputs
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return sendJson(res, 400, { error: "testCases array is required and must not be empty" });
    }
    if (!Array.isArray(mappings)) {
      return sendJson(res, 400, { error: "mappings array is required" });
    }

    // Prepare TestSpecifications from confirmed mappings (no AI, no execution)
    const result = prepareTestSpecifications({ projectId, testCases, mappings });

    return sendJson(res, 200, result);
  }

  // STEP 4.24/5.7/5.8 - Dependency-Aware Execution API + Persistence
  if (url.pathname === "/api/runs/execute-dependent") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const testSpecification = body.testSpecification;
    const executionPlan = body.executionPlan;
    const environment = body.environment || {};

    // Validate project exists
    const project = getProject(projectId);
    if (!project) {
      return sendJson(res, 400, { error: `Project not found: ${projectId}` });
    }

    // Validate test specification exists
    if (!testSpecification || !testSpecification.id) {
      return sendJson(res, 400, { error: "testSpecification with id is required" });
    }

    // Validate execution plan and reject invalid
    if (!executionPlan || !validatePlan(executionPlan)) {
      return sendJson(res, 400, { 
        error: "Invalid executionPlan",
        reason: executionPlan?.errors || ["ExecutionPlan validation failed"]
      });
    }

    // Load apiModels for request building
    const services = listServices(projectId);
    const apiModels = services.map((s) => getApiModel(projectId, s.id));

    // Execute using shared dependency-aware executor
    const startedAt = new Date().toISOString();
    const execStartMs = Date.now();
    const result = await executeTestSpecification(testSpecification, executionPlan, apiModels, { environment });
    const durationMs = Date.now() - execStartMs;

    // Redact sensitive values from responses in the result
    const { redactSecretsFromObject } = require("./execution/httpExecutor");
    const safeResults = result.results.map((r) => ({
      ...r,
      response: r.response ? {
        status: r.response.status,
        statusText: r.response.statusText,
        headers: r.response.headers ? require("./execution/httpExecutor").redactHeaders(r.response.headers) : {},
        body: r.response.body ? redactSecretsFromObject(r.response.body) : null,
      } : null,
      request: r.request ? {
        ...r.request,
        headers: require("./execution/httpExecutor").redactHeaders(r.request.headers || {}),
        body: r.request.body ? redactSecretsFromObject(r.request.body) : null,
      } : null,
    }));

    // Build target operation summary from execution plan
    const targetOp = executionPlan.target || {};
    const runId = `${testSpecification.id}-${Date.now()}`;

    // Construct canonical Run (self-contained, redacted)
    const runData = {
      id: runId,
      projectId,
      title: testSpecification.title,
      description: testSpecification.description,
      status: result.success ? "passed" : "failed",
      testSpecification: {
        id: testSpecification.id,
        title: testSpecification.title,
        description: testSpecification.description,
        requirementRefs: testSpecification.requirementRefs || [],
        operationRefs: testSpecification.operationRefs || [],
        expectedBehavior: testSpecification.expectedBehavior || {},
      },
      executionPlanSummary: {
        target: targetOp,
        stepCount: (executionPlan.steps || []).length,
        operations: (executionPlan.steps || []).map((s) => s.operation || {}),
      },
      targetOperation: targetOp,
      results: safeResults,
      errors: result.errors,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
    };

    // Persist the run
    const persisted = saveRun(projectId, runData);

    return sendJson(res, 200, {
      specId: result.specId,
      spec: result.spec,
      status: result.success ? "passed" : "failed",
      results: safeResults,
      errors: result.errors,
      success: result.success,
      runId: persisted.id,
      run: {
        id: persisted.id,
        projectId: persisted.projectId,
      },
    });
  }

  // Create project
  if (url.pathname === "/api/projects" && req.method === "POST") {
    try {
      const project = createProject({
        id: body.id,
        name: body.name,
        createdAt: body.createdAt,
        updatedAt: body.updatedAt,
      });
      return sendJson(res, 200, { project });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  // Register a service/API under a project from a parsed contract
  if (url.pathname === "/api/services/register" && req.method === "POST") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const contract = body.contract;

    if (!contract) {
      return sendJson(res, 400, { error: "contract required" });
    }

    try {
      const service = createService(projectId, {
        id: contract.title || body.serviceId || "api-service",
        name: contract.title || "API Service",
        protocol: "rest",
        description: contract.description || "",
      });

      const apiModel = adaptContractToApiModel(contract);

      saveApiModel(projectId, service.id, {
        service: apiModel.service,
        title: apiModel.title,
        baseUrl: apiModel.baseUrl,
        operations: apiModel.operations,
      });

      return sendJson(res, 200, { service, apiModel });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  // Update project instructions + analyze
  if (url.pathname === "/api/knowledge/instructions" && req.method === "POST") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const instructions = body.instructions || "";

    try {
      const services = listServices(projectId);
      const apiModels = services.map((s) => getApiModel(projectId, s.id));

      const result = await analyzeAndStoreProposals({
        projectId,
        instructions,
        services,
        apiModels,
      });

      return sendJson(res, 200, { knowledge: result });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  // Confirm a relationship
  if (url.pathname === "/api/knowledge/relationships/confirm" && req.method === "POST") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const sourceKey = body.sourceKey;

    if (!sourceKey) {
      return sendJson(res, 400, { error: "sourceKey required" });
    }

    const result = confirmRelationship(projectId, sourceKey);
    return result ? sendJson(res, 200, { knowledge: result }) : notFound(res);
  }

  // Reject a relationship
  if (url.pathname === "/api/knowledge/relationships/reject" && req.method === "POST") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const sourceKey = body.sourceKey;

    if (!sourceKey) {
      return sendJson(res, 400, { error: "sourceKey required" });
    }

    const result = rejectRelationship(projectId, sourceKey);
    return result ? sendJson(res, 200, { knowledge: result }) : notFound(res);
  }

  return notFound(res);
}

function getProjectIdFromRequest(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const fromQuery = url.searchParams.get("projectId");
  if (typeof fromQuery === "string" && fromQuery.trim().length > 0) {
    return fromQuery.trim();
  }

  return undefined;
}

async function handleRequest(req, res) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const projectContext = createProjectContext({ projectId: getProjectIdFromRequest(req) });

  if (req.method === "OPTIONS") {
    return send(res, 204, "", {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
  }

  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);

    if (url.pathname.startsWith("/sample-data/")) {
      const relative = decodeURIComponent(url.pathname.replace(/^\/sample-data\/?/, ""));
      return serveFile(res, path.join(config.sampleDir, relative), config.sampleDir);
    }

    const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const filePath = path.join(config.publicDir, relative);
    return serveFile(res, filePath, config.publicDir);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  } finally {
    const duration = Date.now() - startTime;
    const status = res.statusCode || 0;
    if (url.pathname.startsWith("/api/")) {
      console.log(`[${requestId}] ${req.method} ${url.pathname} → ${status} (${duration}ms)`);
    }
  }
}

const server = http.createServer(handleRequest);

server.listen(config.port, () => {
  console.log(`AI API Validation Tool MVP running at http://localhost:${config.port}`);
});

function shutdown(signal) {
  console.log(`\n[server] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log("[server] Server closed. Goodbye.");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[server] Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.once("uncaughtException", (err) => {
  console.error("[server] Uncaught exception:", err);
  shutdown("uncaughtException");
});