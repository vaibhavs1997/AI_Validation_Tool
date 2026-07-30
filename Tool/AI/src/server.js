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
const {
  createProject,
  getProject,
  listProjects,
  seedDefaultProject,
  ensureReady: ensureProjectRepositoryReady,
} = require("./domain/ProjectRepository");
const { getProjectService } = require("./domain/ProjectService");
const {
  getService,
  listServices,
  getApiModel,
  registerServiceWithApiModel,
  ensureReady: ensureServiceRepositoryReady,
} = require("./domain/ServiceRepository");
const { adaptContractToApiModel } = require("./domain/contractAdapter");
const {
  analyzeAndStoreProposals,
  listRelationshipsByStatus,
  confirmRelationship,
  rejectRelationship,
  STATUSES,
} = require("./domain/ProjectKnowledgeService");
const {
  getProjectKnowledge,
  ensureReady: ensureProjectKnowledgeRepositoryReady,
} = require("./domain/ProjectKnowledgeRepository");
const { DEFAULT_PROJECT } = require("./domain/ProjectIdentity");
const { executeTestSpecification } = require("./execution/dependencyAwareExecutor");
const { validatePlan } = require("./domain/ExecutionPlan");
const {
  saveRun,
  getRun,
  listRuns,
  ensureReady: ensureRunRepositoryReady,
} = require("./domain/RunRepository");
const { migrate } = require("./db/migrate");
const { closePool } = require("./db/pool");

storage.ensureStorage();

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

  if (req.method === "GET" && url.pathname === "/api/projects") {
    const search = url.searchParams.get("search") || undefined;
    const sort = url.searchParams.get("sort") || undefined;
    const order = url.searchParams.get("order") || undefined;
    const limit = url.searchParams.get("limit") || undefined;
    const offset = url.searchParams.get("offset") || undefined;
    const service = getProjectService();
    const projects = await service.listProjects({ search, sort, order, limit, offset });
    return sendJson(res, 200, {
      projects,
      total: projects.length,
      limit: limit ? Number(limit) : 100,
      offset: offset ? Number(offset) : 0,
    });
  }

  if (req.method === "GET" && url.pathname.match(/^\/api\/projects\/([^/]+)$/)) {
    const match = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    const projectId = match[1];
    const service = getProjectService();
    try {
      const project = await service.getProject(projectId);
      return sendJson(res, 200, { project });
    } catch (error) {
      return sendJson(res, 404, { error: error.message });
    }
  }

  if (req.method === "PATCH" && url.pathname.match(/^\/api\/projects\/([^/]+)$/)) {
    const match = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    const projectId = match[1];
    const service = getProjectService();
    const patchBody = await readBody(req);

    if (!patchBody || Object.keys(patchBody).length === 0) {
      return sendJson(res, 400, { error: "Request body is required." });
    }

    try {
      const project = await service.updateProject(projectId, patchBody);
      return sendJson(res, 200, { project });
    } catch (error) {
      const msg = String(error && error.message ? error.message : error);
      if (msg.includes("not found")) {
        return sendJson(res, 404, { error: msg });
      }
      return sendJson(res, 400, { error: msg });
    }
  }

  if (req.method === "DELETE" && url.pathname.match(/^\/api\/projects\/([^/]+)$/)) {
    const match = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    const projectId = match[1];
    const service = getProjectService();

    try {
      await service.deleteProject(projectId);
      return sendJson(res, 200, {
        success: true,
        message: "Project deleted successfully",
        id: projectId,
      });
    } catch (error) {
      const msg = String(error && error.message ? error.message : error);
      if (msg.includes("not found")) {
        return sendJson(res, 404, { error: msg });
      }
      if (msg.includes("Cannot delete the default project")) {
        return sendJson(res, 400, { error: msg });
      }
      return sendJson(res, 500, { error: msg });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/services") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    return sendJson(res, 200, { services: await listServices(projectId) });
  }

  if (req.method === "GET" && url.pathname.match(/^\/api\/services\/[^/]+\/[^/]+$/)) {
    const match = url.pathname.match(/^\/api\/services\/([^/]+)\/([^/]+)$/);
    const projectId = match[1];
    const serviceId = match[2];
    const service = await getService(projectId, serviceId);
    if (!service) return notFound(res);
    const apiModel = await getApiModel(projectId, serviceId);
    return sendJson(res, 200, { service, apiModel });
  }

  if (req.method === "GET" && url.pathname === "/api/knowledge") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const knowledge = await getProjectKnowledge(projectId);
    return sendJson(res, 200, { knowledge: knowledge || { relationships: [] } });
  }

  if (req.method === "GET" && url.pathname.match(/^\/api\/knowledge\/relationships\/([^/]+)$/)) {
    const match = url.pathname.match(/^\/api\/knowledge\/relationships\/([^/]+)$/);
    const status = match[1];
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    if (!STATUSES.includes(status)) {
      return sendJson(res, 400, { error: "Invalid status. Use: proposed, confirmed, rejected" });
    }
    const relationships = await listRelationshipsByStatus(projectId, status);
    return sendJson(res, 200, { relationships });
  }

  if (req.method === "GET" && url.pathname === "/api/active/runs") {
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return sendJson(res, 400, { error: "projectId query parameter required" });
    const runs = await listRuns(projectId);
    return sendJson(res, 200, { runs });
  }

  if (req.method === "GET" && url.pathname.match(/^\/api\/active\/runs\/([^/]+)$/)) {
    const match = url.pathname.match(/^\/api\/active\/runs\/([^/]+)$/);
    const runId = match[1];
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return sendJson(res, 400, { error: "projectId query parameter required" });
    const run = await getRun(projectId, runId);
    if (!run) return notFound(res);
    return sendJson(res, 200, { run });
  }

  if (req.method !== "POST") return notFound(res);

  const body = await readBody(req);

  if (url.pathname === "/api/projects") {
    const service = getProjectService();
    if (!body || !body.id || String(body.id).trim().length === 0) {
      return sendJson(res, 400, { error: "Project identity id must be a non-empty string." });
    }
    try {
      const project = await service.createProject({
        id: body.id,
        name: body.name,
        createdAt: body.createdAt,
        updatedAt: body.updatedAt,
      });
      return sendJson(res, 201, { project });
    } catch (error) {
      const status = error.message.includes("already exists") ? 409 : 400;
      return sendJson(res, status, { error: error.message });
    }
  }

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

  if (url.pathname === "/api/services/register") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const contract = body.contract;
    if (!contract) {
      return sendJson(res, 400, { error: "contract required" });
    }
    try {
      const apiModel = adaptContractToApiModel(contract);
      const registration = await registerServiceWithApiModel(
        projectId,
        {
          id: contract.title || body.serviceId || "api-service",
          name: contract.title || "API Service",
          protocol: "rest",
          description: contract.description || "",
        },
        {
          service: apiModel.service,
          title: apiModel.title,
          baseUrl: apiModel.baseUrl,
          operations: apiModel.operations,
        }
      );
      return sendJson(res, 200, {
        service: registration.service,
        apiModel,
      });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/knowledge/instructions") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const instructions = body.instructions || "";
    try {
      const services = await listServices(projectId);
      const apiModels = await Promise.all(services.map((s) => getApiModel(projectId, s.id)));
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

  if (url.pathname === "/api/test-cases/generate") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const ticket = body.ticket || {};
    const project = await getProject(projectId);
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

  if (url.pathname === "/api/test-cases/match") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const testCases = body.testCases || [];
    const project = await getProject(projectId);
    if (!project) {
      return sendJson(res, 400, { error: `Project not found: ${projectId}` });
    }
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return sendJson(res, 400, { error: "testCases array is required and must not be empty" });
    }
    const result = await matchTestCasesToApis({ projectId, testCases });
    return sendJson(res, 200, result);
  }

  if (url.pathname === "/api/test-specifications/prepare") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const testCases = body.testCases || [];
    const mappings = body.mappings || [];
    const project = await getProject(projectId);
    if (!project) {
      return sendJson(res, 400, { error: `Project not found: ${projectId}` });
    }
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return sendJson(res, 400, { error: "testCases array is required and must not be empty" });
    }
    if (!Array.isArray(mappings)) {
      return sendJson(res, 400, { error: "mappings array is required" });
    }
    const result = await prepareTestSpecifications({ projectId, testCases, mappings });
    return sendJson(res, 200, result);
  }

  if (url.pathname === "/api/runs/execute-dependent") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const testSpecification = body.testSpecification;
    const executionPlan = body.executionPlan;
    const environment = body.environment || {};
    const project = await getProject(projectId);
    if (!project) {
      return sendJson(res, 400, { error: `Project not found: ${projectId}` });
    }
    if (!testSpecification || !testSpecification.id) {
      return sendJson(res, 400, { error: "testSpecification with id is required" });
    }
    if (!executionPlan || !validatePlan(executionPlan)) {
      return sendJson(res, 400, {
        error: "Invalid executionPlan",
        reason: executionPlan?.errors || ["ExecutionPlan validation failed"]
      });
    }
    const services = await listServices(projectId);
    const apiModels = await Promise.all(services.map((s) => getApiModel(projectId, s.id)));
    const startedAt = new Date().toISOString();
    const execStartMs = Date.now();
    const result = await executeTestSpecification(testSpecification, executionPlan, apiModels, { environment });
    const durationMs = Date.now() - execStartMs;
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
    const targetOp = executionPlan.target || {};
    const runId = `${testSpecification.id}-${Date.now()}`;
    const runData = {
      id: runId, projectId,
      title: testSpecification.title,
      description: testSpecification.description,
      status: result.success ? "passed" : "failed",
      testSpecification: {
        id: testSpecification.id, title: testSpecification.title,
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
      results: safeResults, errors: result.errors,
      startedAt, completedAt: new Date().toISOString(), durationMs,
    };
    const persisted = await saveRun(projectId, runData);
    return sendJson(res, 200, {
      specId: result.specId, spec: result.spec,
      status: result.success ? "passed" : "failed",
      results: safeResults, errors: result.errors,
      success: result.success,
      runId: persisted.id,
      run: { id: persisted.id, projectId: persisted.projectId },
    });
  }

  if (url.pathname === "/api/knowledge/relationships/confirm" && req.method === "POST") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const sourceKey = body.sourceKey;
    if (!sourceKey) {
      return sendJson(res, 400, { error: "sourceKey required" });
    }
    const result = await confirmRelationship(projectId, sourceKey);
    return result ? sendJson(res, 200, { knowledge: result }) : notFound(res);
  }

  if (url.pathname === "/api/knowledge/relationships/reject" && req.method === "POST") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const sourceKey = body.sourceKey;
    if (!sourceKey) {
      return sendJson(res, 400, { error: "sourceKey required" });
    }
    const result = await rejectRelationship(projectId, sourceKey);
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
    const resolved = path.resolve(filePath);
    const base = path.resolve(config.publicDir);
    const relPath = path.relative(base, resolved);
    let shouldServeIndex = false;
    if (relPath.startsWith("..") || path.isAbsolute(relPath)) {
      shouldServeIndex = true;
    } else {
      try {
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) shouldServeIndex = true;
      } catch {
        shouldServeIndex = true;
      }
    }
    const indexPath = path.join(config.publicDir, "index.html");
    const servePath = shouldServeIndex ? indexPath : filePath;
    return serveFile(res, servePath, config.publicDir);
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

async function startServer() {
  if (!fs.existsSync(config.publicDir) || !fs.statSync(config.publicDir).isDirectory()) {
    console.warn(`[server] Warning: publicDir does not exist: ${config.publicDir}`);
    console.warn(`[server] Run 'npm run frontend:build' to create the React build.`);
  }
  if (config.pg && config.pg.enabled) {
    const migrationResult = await migrate();
    if (migrationResult && migrationResult.error) {
      throw new Error(migrationResult.error);
    }
  }
  await ensureProjectRepositoryReady();
  await seedDefaultProject();
  await ensureServiceRepositoryReady();
  await ensureProjectKnowledgeRepositoryReady();
  await ensureRunRepositoryReady();
  server.listen(config.port, () => {
    console.log(`AI API Validation Tool MVP running at http://localhost:${config.port}`);
  });
}

startServer().catch((error) => {
  console.error(`[server] Startup failed: ${error.message}`);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`\n[server] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await closePool();
    } catch (error) {
      console.error(`[server] Error closing PostgreSQL pool: ${error.message}`);
    }
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