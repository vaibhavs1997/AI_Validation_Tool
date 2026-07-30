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
  getProject,
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
const { getRequirementService } = require("./domain/RequirementService");
const { getRequirementWorkflowService } = require("./domain/RequirementWorkflowService");
const { extractRequirements } = require("./domain/RequirementExtractionService");
const { extractText } = require("./domain/DocumentExtractor");
const { getImplementationMappingService } = require("./domain/ImplementationMappingService");
const { analyzeMappings } = require("./domain/MappingAnalysisService");
const { getExecutableTestService } = require("./domain/ExecutableTestService");
const { ensureReady: ensureExecutableTestRepositoryReady } = require("./domain/ExecutableTestRepository");
const { generateTests } = require("./domain/TestGenerationService");
const { executeTestSpecification } = require("./execution/dependencyAwareExecutor");
const { validatePlan } = require("./domain/ExecutionPlan");
const {
  saveRun,
  getRun,
  listRuns,
  ensureReady: ensureRunRepositoryReady,
} = require("./domain/RunRepository");
const { createGeneration, readGeneration } = require("./domain/GenerationRepository");
const { getExecutionWorkspaceService, ensureReady: ensureExecutionRunRepositoryReady } = require("./domain/ExecutionWorkspaceService");
const { getValidationScenarioService } = require("./domain/ValidationScenarioService");
const { generateScenarios } = require("./domain/ScenarioGenerationService");
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
    headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS";
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
  // ─── Health & Config ─────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, app: "AI API Validation Tool MVP", time: new Date().toISOString() });
  }

  if (req.method === "GET" && url.pathname === "/api/config/status") {
    return sendJson(res, 200, {
      jiraConfigured: jiraClient.isConfigured(),
      aiConfigured: llmClient.isConfigured(),
      aiModel: config.ai.model,
      port: config.port,
    });
  }

  // ─── Runs ────────────────────────────────────────────────────────────────
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

  // ─── Projects ────────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/api/projects") {
    const search = url.searchParams.get("search") || undefined;
    const sort = url.searchParams.get("sort") || undefined;
    const order = url.searchParams.get("order") || undefined;
    const limit = url.searchParams.get("limit") || undefined;
    const offset = url.searchParams.get("offset") || undefined;
    const service = getProjectService();
    const projects = await service.listProjects({ search, sort, order, limit, offset });
    return sendJson(res, 200, { projects, total: projects.length, limit: limit ? Number(limit) : 100, offset: offset ? Number(offset) : 0 });
  }

  const projectIdMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (req.method === "GET" && projectIdMatch) {
    const projectId = projectIdMatch[1];
    const service = getProjectService();
    try {
      const project = await service.getProject(projectId);
      return sendJson(res, 200, { project });
    } catch (error) {
      return sendJson(res, 404, { error: error.message });
    }
  }

  if (req.method === "PATCH" && projectIdMatch) {
    const projectId = projectIdMatch[1];
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
      if (msg.includes("not found")) return sendJson(res, 404, { error: msg });
      return sendJson(res, 400, { error: msg });
    }
  }

  if (req.method === "DELETE" && projectIdMatch) {
    const projectId = projectIdMatch[1];
    const service = getProjectService();
    try {
      await service.deleteProject(projectId);
      return sendJson(res, 200, { success: true, message: "Project deleted successfully", id: projectId });
    } catch (error) {
      const msg = String(error && error.message ? error.message : error);
      if (msg.includes("not found")) return sendJson(res, 404, { error: msg });
      if (msg.includes("Cannot delete the default project")) return sendJson(res, 400, { error: msg });
      return sendJson(res, 500, { error: msg });
    }
  }

  // ─── Services ────────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/api/services") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    return sendJson(res, 200, { services: await listServices(projectId) });
  }

  const serviceDetailMatch = url.pathname.match(/^\/api\/services\/([^/]+)\/([^/]+)$/);
  if (req.method === "GET" && serviceDetailMatch) {
    const projectId = serviceDetailMatch[1];
    const serviceId = serviceDetailMatch[2];
    const service = await getService(projectId, serviceId);
    if (!service) return notFound(res);
    const apiModel = await getApiModel(projectId, serviceId);
    return sendJson(res, 200, { service, apiModel });
  }

  // ─── Knowledge ───────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/api/knowledge") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const knowledge = await getProjectKnowledge(projectId);
    return sendJson(res, 200, { knowledge: knowledge || { relationships: [] } });
  }

  const knowledgeRelMatch = url.pathname.match(/^\/api\/knowledge\/relationships\/([^/]+)$/);
  if (req.method === "GET" && knowledgeRelMatch) {
    const status = knowledgeRelMatch[1];
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    if (!STATUSES.includes(status)) {
      return sendJson(res, 400, { error: "Invalid status. Use: proposed, confirmed, rejected" });
    }
    const relationships = await listRelationshipsByStatus(projectId, status);
    return sendJson(res, 200, { relationships });
  }

  // ─── Active Runs ─────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/api/active/runs") {
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return sendJson(res, 400, { error: "projectId query parameter required" });
    const runs = await listRuns(projectId);
    return sendJson(res, 200, { runs });
  }

  const activeRunMatch = url.pathname.match(/^\/api\/active\/runs\/([^/]+)$/);
  if (req.method === "GET" && activeRunMatch) {
    const runId = activeRunMatch[1];
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return sendJson(res, 400, { error: "projectId query parameter required" });
    const run = await getRun(projectId, runId);
    if (!run) return notFound(res);
    return sendJson(res, 200, { run });
  }

  // ─── Execution Workspace GET ─────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/api/execution-runs") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getExecutionWorkspaceService();
      const runs = await service.listRuns(projectId);
      return sendJson(res, 200, { runs });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "GET" && url.pathname === "/api/execution-runs/stats") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getExecutionWorkspaceService();
      const stats = await service.getStats(projectId);
      return sendJson(res, 200, { stats });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const execRunMatch = url.pathname.match(/^\/api\/execution-runs\/([^/]+)$/);
  if (req.method === "GET" && execRunMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const runId = execRunMatch[1];
    try {
      const service = getExecutionWorkspaceService();
      const run = await service.getRun(projectId, runId);
      if (!run) return notFound(res);
      return sendJson(res, 200, { run });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "DELETE" && execRunMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const runId = execRunMatch[1];
    try {
      const service = getExecutionWorkspaceService();
      const deleted = await service.deleteRun(projectId, runId);
      return sendJson(res, 200, { success: deleted, message: "ExecutionRun deleted successfully" });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  // ─── Requirement CRUD (GET/PATCH/DELETE) ─────────────────────────────────
  if (url.pathname === "/api/requirements" && req.method === "GET") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const search = url.searchParams.get("search") || undefined;
    const sort = url.searchParams.get("sort") || undefined;
    const order = url.searchParams.get("order") || undefined;
    const status = url.searchParams.get("status") || undefined;
    try {
      const service = getRequirementService();
      const requirements = await service.list(projectId, { search, sort, order, status });
      return sendJson(res, 200, { requirements });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/requirements/stats" && req.method === "GET") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getRequirementService();
      const stats = await service.getStats(projectId);
      return sendJson(res, 200, { stats });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const requirementIdMatch = url.pathname.match(/^\/api\/requirements\/([^/]+)$/);
  if (req.method === "GET" && requirementIdMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const reqId = requirementIdMatch[1];
    try {
      const service = getRequirementService();
      const requirement = await service.get(projectId, reqId);
      return sendJson(res, 200, { requirement });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "DELETE" && requirementIdMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const reqId = requirementIdMatch[1];
    try {
      const service = getRequirementService();
      await service.delete(projectId, reqId);
      return sendJson(res, 200, { success: true, message: "Requirement deleted successfully" });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "PATCH" && requirementIdMatch) {
    const body = await readBody(req);
    const reqId = requirementIdMatch[1];
    const projectId = body.projectId || url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getRequirementService();
      const requirement = await service.update(projectId, reqId, body);
      return sendJson(res, 200, { requirement });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  const readinessMatch = url.pathname.match(/^\/api\/requirements\/([^/]+)\/readiness$/);
  if (req.method === "GET" && readinessMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const reqId = readinessMatch[1];
    try {
      const service = getRequirementService();
      const readiness = await service.getReadiness(projectId, reqId);
      return sendJson(res, 200, { readiness });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  // ─── Validation Scenario CRUD (GET/PATCH/DELETE) ─────────────────────────
  if (url.pathname === "/api/validation-scenarios" && req.method === "GET") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const search = url.searchParams.get("search") || undefined;
    const sort = url.searchParams.get("sort") || undefined;
    const order = url.searchParams.get("order") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const requirementId = url.searchParams.get("requirementId") || undefined;
    try {
      const service = getValidationScenarioService();
      const scenarios = await service.list(projectId, { search, sort, order, status, requirementId });
      return sendJson(res, 200, { scenarios });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/validation-scenarios/stats" && req.method === "GET") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getValidationScenarioService();
      const stats = await service.getStats(projectId);
      return sendJson(res, 200, { stats });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const scenarioIdMatch = url.pathname.match(/^\/api\/validation-scenarios\/([^/]+)$/);
  if (req.method === "GET" && scenarioIdMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const scenarioId = scenarioIdMatch[1];
    try {
      const service = getValidationScenarioService();
      const scenario = await service.get(projectId, scenarioId);
      return sendJson(res, 200, { scenario });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "DELETE" && scenarioIdMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const scenarioId = scenarioIdMatch[1];
    try {
      const service = getValidationScenarioService();
      await service.delete(projectId, scenarioId);
      return sendJson(res, 200, { success: true, message: "ValidationScenario deleted successfully" });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "PATCH" && scenarioIdMatch) {
    const body = await readBody(req);
    const scenarioId = scenarioIdMatch[1];
    const projectId = body.projectId || url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getValidationScenarioService();
      const scenario = await service.update(projectId, scenarioId, body);
      return sendJson(res, 200, { scenario });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  const scenarioReadinessMatch = url.pathname.match(/^\/api\/validation-scenarios\/([^/]+)\/readiness$/);
  if (req.method === "GET" && scenarioReadinessMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const scenarioId = scenarioReadinessMatch[1];
    try {
      const service = getValidationScenarioService();
      const readiness = await service.getReadiness(projectId, scenarioId);
      return sendJson(res, 200, { readiness });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  // ─── Implementation Mapping CRUD (GET/PATCH/DELETE) ──────────────────────
  if (url.pathname === "/api/implementation-mappings" && req.method === "GET") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const search = url.searchParams.get("search") || undefined;
    const sort = url.searchParams.get("sort") || undefined;
    const order = url.searchParams.get("order") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const scenarioId = url.searchParams.get("scenarioId") || undefined;
    const requirementId = url.searchParams.get("requirementId") || undefined;
    try {
      const service = getImplementationMappingService();
      const mappings = await service.list(projectId, { search, sort, order, status, scenarioId, requirementId });
      return sendJson(res, 200, { mappings });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/implementation-mappings/stats" && req.method === "GET") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getImplementationMappingService();
      const stats = await service.getStats(projectId);
      return sendJson(res, 200, { stats });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const mappingIdMatch = url.pathname.match(/^\/api\/implementation-mappings\/([^/]+)$/);
  if (req.method === "GET" && mappingIdMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const mappingId = mappingIdMatch[1];
    try {
      const service = getImplementationMappingService();
      const mapping = await service.get(projectId, mappingId);
      return sendJson(res, 200, { mapping });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "DELETE" && mappingIdMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const mappingId = mappingIdMatch[1];
    try {
      const service = getImplementationMappingService();
      await service.delete(projectId, mappingId);
      return sendJson(res, 200, { success: true, message: "ImplementationMapping deleted successfully" });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "PATCH" && mappingIdMatch) {
    const body = await readBody(req);
    const mappingId = mappingIdMatch[1];
    const projectId = body.projectId || url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getImplementationMappingService();
      const mapping = await service.update(projectId, mappingId, body);
      return sendJson(res, 200, { mapping });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  // ─── Executable Tests CRUD (GET/PATCH/DELETE) ────────────────────────────
  if (url.pathname === "/api/executable-tests" && req.method === "GET") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const search = url.searchParams.get("search") || undefined;
    const sort = url.searchParams.get("sort") || undefined;
    const order = url.searchParams.get("order") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const mappingId = url.searchParams.get("mappingId") || undefined;
    const scenarioId = url.searchParams.get("scenarioId") || undefined;
    const requirementId = url.searchParams.get("requirementId") || undefined;
    try {
      const service = getExecutableTestService();
      const tests = await service.list(projectId, { search, sort, order, status, mappingId, scenarioId, requirementId });
      return sendJson(res, 200, { tests });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/executable-tests/stats" && req.method === "GET") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getExecutableTestService();
      const stats = await service.getStats(projectId);
      return sendJson(res, 200, { stats });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const testIdMatch = url.pathname.match(/^\/api\/executable-tests\/([^/]+)$/);
  if (req.method === "GET" && testIdMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const testId = testIdMatch[1];
    try {
      const service = getExecutableTestService();
      const test = await service.get(projectId, testId);
      return sendJson(res, 200, { test });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "DELETE" && testIdMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const testId = testIdMatch[1];
    try {
      const service = getExecutableTestService();
      await service.delete(projectId, testId);
      return sendJson(res, 200, { success: true, message: "ExecutableTest deleted successfully" });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "PATCH" && testIdMatch) {
    const body = await readBody(req);
    const testId = testIdMatch[1];
    const projectId = body.projectId || url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getExecutableTestService();
      const test = await service.update(projectId, testId, body);
      return sendJson(res, 200, { test });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  // ─── Requirement Workflow CRUD (GET/DELETE) ──────────────────────────────
  if (url.pathname === "/api/requirement-workflows" && req.method === "GET") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const status = url.searchParams.get("status") || undefined;
    const requirementId = url.searchParams.get("requirementId") || undefined;
    try {
      const service = getRequirementWorkflowService();
      const workflows = await service.listWorkflows(projectId, { status, requirementId });
      return sendJson(res, 200, { workflows });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const workflowIdMatch = url.pathname.match(/^\/api\/requirement-workflows\/([^/]+)$/);
  if (req.method === "GET" && workflowIdMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const workflowId = workflowIdMatch[1];
    try {
      const service = getRequirementWorkflowService();
      const workflow = await service.getWorkflow(projectId, workflowId);
      return sendJson(res, 200, { workflow });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "DELETE" && workflowIdMatch) {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const workflowId = workflowIdMatch[1];
    try {
      const service = getRequirementWorkflowService();
      await service.deleteWorkflow(projectId, workflowId);
      return sendJson(res, 200, { success: true, message: "Workflow deleted successfully" });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  // ─── POST-only endpoints ─────────────────────────────────────────────────
  if (req.method !== "POST") return notFound(res);

  const body = await readBody(req);

  // Project creation
  if (url.pathname === "/api/projects") {
    const service = getProjectService();
    if (!body || !body.id || String(body.id).trim().length === 0) {
      return sendJson(res, 400, { error: "Project identity id must be a non-empty string." });
    }
    try {
      const project = await service.createProject({
        id: body.id, name: body.name, createdAt: body.createdAt, updatedAt: body.updatedAt,
      });
      return sendJson(res, 201, { project });
    } catch (error) {
      const status = error.message.includes("already exists") ? 409 : 400;
      return sendJson(res, status, { error: error.message });
    }
  }

  // Jira
  if (url.pathname === "/api/jira/ticket") {
    const ticket = await jiraClient.fetchIssue(body.issueKey);
    storage.saveJson("tickets", ticket.key, ticket);
    return sendJson(res, 200, { ticket });
  }

  if (url.pathname === "/api/jira/jql") {
    const result = await jiraClient.searchIssues(body.jql, body.maxResults || 10);
    return sendJson(res, 200, result);
  }

  // Contracts
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

  // Services
  if (url.pathname === "/api/services/register") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const contract = body.contract;
    if (!contract) return sendJson(res, 400, { error: "contract required" });
    try {
      const apiModel = adaptContractToApiModel(contract);
      const registration = await registerServiceWithApiModel(projectId, {
        id: contract.title || body.serviceId || "api-service",
        name: contract.title || "API Service",
        protocol: "rest",
        description: contract.description || "",
      }, {
        service: apiModel.service, title: apiModel.title, baseUrl: apiModel.baseUrl, operations: apiModel.operations,
      });
      return sendJson(res, 200, { service: registration.service, apiModel });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  // Knowledge
  if (url.pathname === "/api/knowledge/instructions") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const instructions = body.instructions || "";
    try {
      const services = await listServices(projectId);
      const apiModels = await Promise.all(services.map((s) => getApiModel(projectId, s.id)));
      const result = await analyzeAndStoreProposals({ projectId, instructions, services, apiModels });
      return sendJson(res, 200, { knowledge: result });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/knowledge/relationships/confirm") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const sourceKey = body.sourceKey;
    if (!sourceKey) return sendJson(res, 400, { error: "sourceKey required" });
    const result = await confirmRelationship(projectId, sourceKey);
    return result ? sendJson(res, 200, { knowledge: result }) : notFound(res);
  }

  if (url.pathname === "/api/knowledge/relationships/reject") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const sourceKey = body.sourceKey;
    if (!sourceKey) return sendJson(res, 400, { error: "sourceKey required" });
    const result = await rejectRelationship(projectId, sourceKey);
    return result ? sendJson(res, 200, { knowledge: result }) : notFound(res);
  }

  // Test Cases
  if (url.pathname === "/api/test-cases/generate") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const ticket = body.ticket || {};
    const project = await getProject(projectId);
    if (!project) return sendJson(res, 400, { error: `Project not found: ${projectId}` });
    try {
      // Create a generation record and run generation in the background so the client can poll.
      const generation = createGeneration({ projectId, requirement: ticket });
      (async () => {
        try {
          const result = await generateTestCases({ projectId, ticket });
          const updated = require("./domain/GenerationRepository").updateGeneration(generation.id, {
            status: "completed",
            testCases: result.testCases,
            diagnostics: result.diagnostics,
            warnings: result.warnings,
            completedAt: new Date().toISOString(),
          });
          // Keep the record around for a short time; do not delete automatically.
        } catch (err) {
          require("./domain/GenerationRepository").updateGeneration(generation.id, {
            status: "failed",
            error: err && err.message ? err.message : String(err),
            completedAt: new Date().toISOString(),
          });
        }
      })();
      return sendJson(res, 202, { projectId, generationId: generation.id, status: generation.status });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (url.pathname === "/api/test-cases/generate/status") {
    const projectId = url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    const generationId = url.searchParams.get("generationId");
    if (!generationId) return sendJson(res, 400, { error: "generationId query parameter is required" });
    const record = readGeneration(generationId);
    if (!record || record.projectId !== projectId) return sendJson(res, 404, { error: "Generation not found" });
    return sendJson(res, 200, {
      generationId: record.id,
      status: record.status,
      testCases: record.testCases || [],
      diagnostics: record.diagnostics || { generated: 0 },
      warnings: record.warnings || [],
      error: record.error,
      startedAt: record.startedAt,
      updatedAt: record.updatedAt,
    });
  }

  if (url.pathname === "/api/test-cases/match") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const testCases = body.testCases || [];
    const recentServiceIds = body.recentServiceIds;
    const project = await getProject(projectId);
    if (!project) return sendJson(res, 400, { error: `Project not found: ${projectId}` });
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return sendJson(res, 400, { error: "testCases array is required and must not be empty" });
    }
    const result = await matchTestCasesToApis({ projectId, testCases, recentServiceIds });
    return sendJson(res, 200, result);
  }

  if (url.pathname === "/api/test-specifications/prepare") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const testCases = body.testCases || [];
    const mappings = body.mappings || [];
    const project = await getProject(projectId);
    if (!project) return sendJson(res, 400, { error: `Project not found: ${projectId}` });
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return sendJson(res, 400, { error: "testCases array is required and must not be empty" });
    }
    if (!Array.isArray(mappings)) return sendJson(res, 400, { error: "mappings array is required" });
    const result = await prepareTestSpecifications({ projectId, testCases, mappings });
    return sendJson(res, 200, result);
  }

  // Execution
  if (url.pathname === "/api/runs/execute-dependent") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const testSpecification = body.testSpecification;
    const executionPlan = body.executionPlan;
    const environment = body.environment || {};
    const project = await getProject(projectId);
    if (!project) return sendJson(res, 400, { error: `Project not found: ${projectId}` });
    if (!testSpecification || !testSpecification.id) {
      return sendJson(res, 400, { error: "testSpecification with id is required" });
    }
    if (!executionPlan || !validatePlan(executionPlan)) {
      return sendJson(res, 400, { error: "Invalid executionPlan", reason: executionPlan?.errors || ["ExecutionPlan validation failed"] });
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
        status: r.response.status, statusText: r.response.statusText,
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
      id: runId, projectId, title: testSpecification.title, description: testSpecification.description,
      status: result.success ? "passed" : "failed",
      testSpecification: { id: testSpecification.id, title: testSpecification.title, description: testSpecification.description, requirementRefs: testSpecification.requirementRefs || [], operationRefs: testSpecification.operationRefs || [], expectedBehavior: testSpecification.expectedBehavior || {} },
      executionPlanSummary: { target: targetOp, stepCount: (executionPlan.steps || []).length, operations: (executionPlan.steps || []).map((s) => s.operation || {}) },
      targetOperation: targetOp, results: safeResults, errors: result.errors,
      startedAt, completedAt: new Date().toISOString(), durationMs,
    };
    const persisted = await saveRun(projectId, runData);
    return sendJson(res, 200, {
      specId: result.specId, spec: result.spec, status: result.success ? "passed" : "failed",
      results: safeResults, errors: result.errors, success: result.success,
      runId: persisted.id, run: { id: persisted.id, projectId: persisted.projectId },
    });
  }

  // Execution Workspace POST
  const execRunActionMatch = url.pathname.match(/^\/api\/execution-runs\/([^/]+)\/(build-plan|rebuild-plan|execute|dry-run|cancel)$/);
  if (url.pathname === "/api/execution-runs") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    try {
      const service = getExecutionWorkspaceService();
      const run = await service.createRun(projectId, body);
      return sendJson(res, 201, { run });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (execRunActionMatch) {
    const runId = execRunActionMatch[1];
    const action = execRunActionMatch[2];
    const projectId = body.projectId || url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getExecutionWorkspaceService();
      let run;
      switch (action) {
        case "build-plan": run = await service.buildPlan(projectId, runId, body); break;
        case "rebuild-plan": run = await service.rebuildPlan(projectId, runId, body); break;
        case "execute": run = await service.executeRun(projectId, runId, body); break;
        case "dry-run": run = await service.dryRun(projectId, runId, body); break;
        case "cancel": run = await service.cancelRun(projectId, runId); break;
        default: return notFound(res);
      }
      return sendJson(res, 200, { run });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  // Requirement POST endpoints
  if (url.pathname === "/api/requirements") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    try {
      const service = getRequirementService();
      const requirement = await service.create(projectId, body);
      return sendJson(res, 201, { requirement });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/requirements/extract") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const text = body.text;
    const fileName = body.fileName || undefined;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return sendJson(res, 400, { error: "text is required." });
    }
    try {
      const result = await extractRequirements({ text, fileName });
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/requirements/from-jira") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    if (!body.ticketKey) return sendJson(res, 400, { error: "ticketKey is required" });
    try {
      const ticket = await jiraClient.fetchIssue(body.ticketKey);
      const requirement = {
        projectId, title: ticket.summary || ticket.key, description: ticket.description || "",
        acceptanceCriteria: [], businessRules: [], priority: "medium",
        notes: `Imported from Jira ticket ${ticket.key}`, status: "draft", source: "manual", fileName: null,
      };
      const service = getRequirementService();
      const created = await service.create(projectId, requirement);
      return sendJson(res, 201, { requirement: created });
    } catch (err) {
      return sendJson(res, 500, { error: err instanceof Error ? err.message : "Failed to fetch Jira ticket" });
    }
  }

  if (url.pathname === "/api/requirements/upload") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const fileName = body.fileName;
    const mimeType = body.mimeType;
    const bufferBase64 = body.buffer;
    if (!fileName || !bufferBase64) return sendJson(res, 400, { error: "fileName and buffer (base64) are required." });
    try {
      const buffer = Buffer.from(bufferBase64, "base64");
      const { text, fileName: extractedFileName, mimeType: extractedMime } = await extractText({ buffer, path: fileName });
      const result = await extractRequirements({ text, fileName: extractedFileName || fileName });
      result.fileName = extractedFileName || fileName;
      result.mimeType = extractedMime || mimeType;
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  // Validation Scenario POST
  if (url.pathname === "/api/validation-scenarios") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    try {
      const service = getValidationScenarioService();
      const scenario = await service.create(projectId, body);
      return sendJson(res, 201, { scenario });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/validation-scenarios/bulk-approve") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const scenarioIds = body.scenarioIds || [];
    try {
      const service = getValidationScenarioService();
      const scenarios = await service.bulkApprove(projectId, scenarioIds);
      return sendJson(res, 200, { scenarios });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/validation-scenarios/bulk-reject") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const scenarioIds = body.scenarioIds || [];
    try {
      const service = getValidationScenarioService();
      const scenarios = await service.bulkReject(projectId, scenarioIds);
      return sendJson(res, 200, { scenarios });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/validation-scenarios/generate") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const requirementIds = body.requirementIds || [];
    try {
      const requirements = await getRequirementService().list(projectId, { status: "ready" });
      const selected = requirements.filter((r) => requirementIds.includes(r.id));
      if (selected.length === 0) {
        return sendJson(res, 400, { error: "No ready requirements found for the provided requirementIds." });
      }
      let scenariosResult;
      try {
        scenariosResult = await generateScenarios({
          requirements: selected.map((r) => ({ id: r.id, title: r.title, description: r.description, acceptanceCriteria: r.acceptanceCriteria, businessRules: r.businessRules })),
        });
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }
      const proposals = scenariosResult.proposals.map((p) => ({ requirementId: p.requirementId, title: p.title, description: p.description, priority: p.priority, confidence: p.confidence }));
      return sendJson(res, 200, { projectId, proposals, warning: scenariosResult.warning, usedAi: scenariosResult.usedAi });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  // Implementation Mapping POST
  if (url.pathname === "/api/implementation-mappings") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    try {
      const service = getImplementationMappingService();
      const mapping = await service.create(projectId, body);
      return sendJson(res, 201, { mapping });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/implementation-mappings/bulk-approve") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const mappingIds = body.mappingIds || [];
    try {
      const service = getImplementationMappingService();
      const mappings = await service.bulkApprove(projectId, mappingIds);
      return sendJson(res, 200, { mappings });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/implementation-mappings/bulk-reject") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const mappingIds = body.mappingIds || [];
    try {
      const service = getImplementationMappingService();
      const mappings = await service.bulkReject(projectId, mappingIds);
      return sendJson(res, 200, { mappings });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/implementation-mappings/analyze") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    try {
      const requirements = await getRequirementService().list(projectId, { status: "ready" });
      const scenarios = await getValidationScenarioService().list(projectId, { status: "ready" });
      const services = await listServices(projectId);
      const apiModels = await Promise.all(services.map((s) => getApiModel(projectId, s.id)));
      if (requirements.length === 0 || scenarios.length === 0) {
        return sendJson(res, 400, { error: "Approved requirements and validation scenarios are required to generate mappings." });
      }
      const result = await analyzeMappings({
        requirements: requirements.map((r) => ({ id: r.id, title: r.title, description: r.description, acceptanceCriteria: r.acceptanceCriteria, businessRules: r.businessRules })),
        scenarios: scenarios.map((s) => ({ id: s.id, requirementId: s.requirementId, title: s.title, description: s.description, priority: s.priority, confidence: s.confidence, status: s.status })),
        apiCatalog: services.reduce((acc, s) => { const apiModel = apiModels.find((m) => m && m.service && m.service.id === s.id); acc[s.id] = { name: s.name, baseUrl: apiModel?.baseUrl, operations: apiModel?.operations || [] }; return acc; }, {}),
      });
      return sendJson(res, 200, { projectId, proposals: result.proposals, warning: result.warning, usedAi: result.usedAi });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  // Executable Tests POST
  if (url.pathname === "/api/executable-tests") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    try {
      const service = getExecutableTestService();
      const test = await service.create(projectId, body);
      return sendJson(res, 201, { test });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/executable-tests/bulk-approve") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const testIds = body.testIds || [];
    try {
      const service = getExecutableTestService();
      const tests = await service.bulkApprove(projectId, testIds);
      return sendJson(res, 200, { tests });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/executable-tests/bulk-reject") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const testIds = body.testIds || [];
    try {
      const service = getExecutableTestService();
      const tests = await service.bulkReject(projectId, testIds);
      return sendJson(res, 200, { tests });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (url.pathname === "/api/executable-tests/generate") {
    const projectId = body.projectId || DEFAULT_PROJECT.id;
    const mappingIds = body.mappingIds || [];
    try {
      const requirements = await getRequirementService().list(projectId, { status: "ready" });
      const scenarios = await getValidationScenarioService().list(projectId, { status: "ready" });
      const mappings = await getImplementationMappingService().list(projectId, { status: "approved" });
      const services = await listServices(projectId);
      const apiModels = await Promise.all(services.map((s) => getApiModel(projectId, s.id)));
      const knowledge = await getProjectKnowledge(projectId);
      if (requirements.length === 0 || scenarios.length === 0 || mappings.length === 0) {
        return sendJson(res, 400, { error: "Approved requirements, scenarios, and mappings are required to generate tests." });
      }
      const selectedMappings = mappingIds.length > 0 ? mappings.filter((m) => mappingIds.includes(m.id)) : mappings;
      if (selectedMappings.length === 0) return sendJson(res, 400, { error: "No approved mappings selected for test generation." });
      const result = await generateTests({
        requirements: requirements.map((r) => ({ id: r.id, title: r.title, description: r.description, acceptanceCriteria: r.acceptanceCriteria, businessRules: r.businessRules })),
        scenarios: scenarios.map((s) => ({ id: s.id, requirementId: s.requirementId, title: s.title, description: s.description, priority: s.priority, confidence: s.confidence })),
        mappings: selectedMappings.map((m) => ({ id: m.id, requirementId: m.requirementId, scenarioId: m.scenarioId, title: m.title, description: m.description, candidateApis: m.candidateApis, executionOrder: m.executionOrder, executionFlow: m.executionFlow, authenticationRequired: m.authenticationRequired, requestDependencies: m.requestDependencies, variablesRequired: m.variablesRequired })),
        knowledge: knowledge || {},
        apiCatalog: services.reduce((acc, s) => { const apiModel = apiModels.find((m) => m && m.service && m.service.id === s.id); acc[s.id] = { name: s.name, baseUrl: apiModel?.baseUrl, operations: apiModel?.operations || [] }; return acc; }, {}),
      });
      return sendJson(res, 200, { projectId, proposals: result.proposals, warning: result.warning, usedAi: result.usedAi });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  // ─── Requirement Workflow POST actions ────────────────────────────────────
  const workflowActionMatch = url.pathname.match(/^\/api\/requirement-workflows\/([^/]+)\/(initialize|analyze|generate-tests|update-selection|approve-tests|match-apis|confirm-mappings|generate-scenarios|summary)$/);
  if (workflowActionMatch) {
    const workflowId = workflowActionMatch[1];
    const action = workflowActionMatch[2];
    const projectId = body.projectId || url.searchParams.get("projectId") || DEFAULT_PROJECT.id;
    try {
      const service = getRequirementWorkflowService();
      let result;
      switch (action) {
        case "initialize": result = await service.initializeWorkflow(projectId, body.requirementId); break;
        case "analyze": result = await service.analyzeRequirement(projectId, workflowId); break;
        case "generate-tests": result = await service.generateTestCases(projectId, workflowId); break;
        case "update-selection": result = await service.updateTestSelection(projectId, workflowId, body.testCaseIds); break;
        case "approve-tests": result = await service.approveTests(projectId, workflowId); break;
        case "match-apis": result = await service.matchApis(projectId, workflowId); break;
        case "confirm-mappings": result = await service.confirmMappings(projectId, workflowId); break;
        case "generate-scenarios": result = await service.generateDraftScenarios(projectId, workflowId); break;
        case "summary": result = await service.getSummary(projectId, workflowId); break;
        default: return notFound(res);
      }
      return sendJson(res, 200, { workflow: result });
    } catch (error) {
      if (error.message.includes("not found")) return sendJson(res, 404, { error: error.message });
      return sendJson(res, 400, { error: error.message });
    }
  }

  return notFound(res);
}

function getProjectIdFromRequest(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const fromQuery = url.searchParams.get("projectId");
  if (typeof fromQuery === "string" && fromQuery.trim().length > 0) return fromQuery.trim();
  return undefined;
}

async function handleRequest(req, res) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === "OPTIONS") {
    return send(res, 204, "", {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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
    if (migrationResult && migrationResult.error) throw new Error(migrationResult.error);
  }
  await ensureProjectRepositoryReady();
  await seedDefaultProject();
  await ensureServiceRepositoryReady();
  await ensureProjectKnowledgeRepositoryReady();
  await ensureRunRepositoryReady();
  await ensureExecutableTestRepositoryReady();
  await ensureExecutionRunRepositoryReady();
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