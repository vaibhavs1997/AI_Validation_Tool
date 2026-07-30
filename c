/**
 * ExecutionWorkspaceService
 *
 * Orchestrates the Execution Workspace: creates runs, builds plans, and executes
 * approved Executable Tests using the existing execution engine.
 *
 * Reuses:
 *   - ExecutionRun (domain model)
 *   - ExecutionRunRepository (persistence)
 *   - ExecutionPlannerService (plan building)
 *   - DependencyResolver (dependency resolution)
 *   - ExecutionPlan (plan validation)
 *   - RuntimeContext (value binding)
 *   - DependencyAwareOrchestrator (STEP_STATUS constants)
 *   - httpExecutor (executeHttpRequest)
 */

const { createExecutionRun } = require("./ExecutionRun");
const repo = require("./ExecutionRunRepository");
const { getExecutionPlannerService } = require("./ExecutionPlannerService");
const { createRuntimeContext } = require("./RuntimeContext");
const { STEP_STATUS } = require("../execution/DependencyAwareOrchestrator");
const { executeHttpRequest, redactHeaders, redactSecretsFromObject } = require("../execution/httpExecutor");

const RUN_STATUS = Object.freeze(["pending", "running", "passed", "failed", "blocked", "skipped", "cancelled"]);

/**
 * Build a full HTTP request from a plan step and apiModels.
 *
 * @param {object} step - Plan step with operation, variables, headers, authentication
 * @param {Array} apiModels
 * @param {object} environment
 * @returns {{ method: string, url: string, headers: object, body: any }}
 */
function buildHttpRequestFromStep(step, apiModels, environment) {
  const op = step.operation;
  const apiModel = apiModels.find((m) => m && m.service && m.service.id === op.serviceId);

  const baseUrl = (apiModel && apiModel.baseUrl) || "http://localhost";
  const method = (op.method || "GET").toUpperCase();
  let path = op.path || "/";

  // Resolve path params from variables
  const variables = { ...(environment.variables || {}), ...(step.variables || {}) };
  if (path && typeof path === "string") {
    path = path.replace(/\{([^}]+)\}/g, (_, key) => {
      return variables[key] !== undefined ? variables[key] : `{${key}}`;
    });
  }

  let url = baseUrl.replace(/\/$/, "") + path;

  // Merge headers: step headers + authentication + environment
  const headers = {
    ...(step.headers || {}),
    ...(step.authentication || {}),
  };

  // Apply authentication headers
  if (step.authentication) {
    for (const [key, value] of Object.entries(step.authentication)) {
      headers[key] = value;
    }
  }

  // Build body from requestBody
  let body = step.requestBody || null;

  return { method, url, headers, body };
}

/**
 * Determine the final status of a run from its step results.
 *
 * @param {Array} results
 * @returns {string}
 */
function determineRunStatus(results) {
  if (!results || results.length === 0) return "skipped";

  const hasFailed = results.some((r) => r.status === "failed");
  const hasPassed = results.some((r) => r.status === "passed");
  const allPassed = results.every((r) => r.status === "passed");
  const allSkipped = results.every((r) => r.status === "skipped");

  if (allPassed) return "passed";
  if (hasFailed) return "failed";
  if (allSkipped) return "skipped";
  if (hasPassed) return "passed";
  return "failed";
}

/**
 * Sanitize a step result for storage (redact secrets).
 *
 * @param {object} result
 * @returns {object}
 */
function sanitizeResult(result) {
  return {
    ...result,
    request: result.request
      ? {
          ...result.request,
          headers: redactHeaders(result.request.headers || {}),
          body: result.request.body ? redactSecretsFromObject(result.request.body) : null,
        }
      : null,
    response: result.response
      ? {
          status: result.response.status,
          statusText: result.response.statusText,
          headers: result.response.headers ? redactHeaders(result.response.headers) : {},
          body: result.response.body ? redactSecretsFromObject(result.response.body) : null,
        }
      : null,
  };
}

class ExecutionWorkspaceService {
  /**
   * Create a new execution run in 'draft' planStatus.
   *
   * @param {string} projectId
   * @param {object} options - { title, description, testIds, variables, authentication, environment }
   * @returns {object} Created run
   */
  async createRun(projectId, options = {}) {
    if (!projectId) throw new Error("Project ID is required.");

    const run = createExecutionRun({
      projectId,
      title: options.title || "Execution Run",
      description: options.description || "",
      testIds: Array.isArray(options.testIds) ? options.testIds : [],
      variables: options.variables || {},
      authentication: options.authentication || {},
      environment: options.environment || {},
      status: "pending",
      planStatus: "draft",
    });

    const persisted = repo.saveRun(projectId, run);
    return repo.getRun(projectId, persisted.id);
  }

  /**
   * Get a single execution run.
   *
   * @param {string} projectId
   * @param {string} runId
   * @returns {object|null}
   */
  async getRun(projectId, runId) {
    if (!projectId || !runId) throw new Error("Project ID and Run ID are required.");
    return repo.getRun(projectId, runId);
  }

  /**
   * List execution runs for a project.
   *
   * @param {string} projectId
   * @returns {Array}
   */
  async listRuns(projectId) {
    if (!projectId) throw new Error("Project ID is required.");
    return repo.listRuns(projectId);
  }

  /**
   * Delete an execution run.
   *
   * @param {string} projectId
   * @param {string} runId
   * @returns {boolean}
   */
  async deleteRun(projectId, runId) {
    if (!projectId || !runId) throw new Error("Project ID and Run ID are required.");
    return repo.deleteRun(projectId, runId);
  }

  /**
   * Build (or rebuild) the execution plan for a run.
   *
   * @param {string} projectId
   * @param {string} runId
   * @param {object} options - { tests, apiModels, relationships, services, variables, authentication, environment }
   * @returns {object} Updated run with plan
   */
  async buildPlan(projectId, runId, options = {}) {
    if (!projectId || !runId) throw new Error("Project ID and Run ID are required.");

    const run = repo.getRun(projectId, runId);
    if (!run) throw new Error(`ExecutionRun not found: ${runId}`);

    const planner = getExecutionPlannerService();
    const plan = planner.buildPlan({
      tests: options.tests || [],
      apiModels: options.apiModels || [],
      relationships: options.relationships || [],
      services: options.services || [],
      variables: { ...(run.variables || {}), ...(options.variables || {}) },
      authentication: { ...(run.authentication || {}), ...(options.authentication || {}) },
      environment: { ...(run.environment || {}), ...(options.environment || {}) },
    });

    const updated = repo.updateRun(projectId, runId, {
      executionPlan: plan,
      planStatus: "ready",
      testIds: (options.tests || []).map((t) => t.id),
      warnings: plan.warnings,
      variables: plan.variables,
      authentication: plan.authentication,
      environment: plan.environment,
    });

    return updated;
  }

  /**
   * Rebuild the execution plan for a run (alias for buildPlan).
   *
   * @param {string} projectId
   * @param {string} runId
   * @param {object} options
   * @returns {object} Updated run with plan
   */
  async rebuildPlan(projectId, runId, options = {}) {
    return this.buildPlan(projectId, runId, options);
  }

  /**
   * Execute a run (or dry run).
   *
   * Reuses the existing execution engine:
   *   - RuntimeContext for value binding
   *   - executeHttpRequest for HTTP execution
   *   - STEP_STATUS from DependencyAwareOrchestrator
   *
   * @param {string} projectId
   * @param {string} runId
   * @param {object} options - { dryRun, environment, apiModels }
   * @returns {object} Updated run with results
   */
  async executeRun(projectId, runId, options = {}) {
    if (!projectId || !runId) throw new Error("Project ID and Run ID are required.");

    const run = repo.getRun(projectId, runId);
    if (!run) throw new Error(`ExecutionRun not found: ${runId}`);

    const plan = run.executionPlan;
    if (!plan || !plan.steps || plan.steps.length === 0) {
      throw new Error("No execution plan found. Build a plan before executing.");
    }

    const { dryRun = false, environment = {}, apiModels = [] } = options;

    // Update run status
    repo.updateRun(projectId, runId, {
      status: "running",
      planStatus: "running",
      startedAt: new Date().toISOString(),
    });

    const context = createRuntimeContext();
    const results = [];
    const stepResults = new Map();
    const envVars = { ...(run.variables || {}), ...(environment.variables || {}) };

    for (const step of plan.steps) {
      const op = step.operation;
      const opKey = `${op.serviceId}::${op.operationId}`;

      // Check prerequisites (same pattern as DependencyAwareOrchestrator.executePlan)
      const blockedPrereq = step.prerequisites.find((p) => {
        const prereqKey = `${p.serviceId}::${p.operationId}`;
        const prereqResult = stepResults.get(prereqKey);
        return prereqResult && prereqResult.status !== STEP_STATUS.PASSED;
      });

      if (blockedPrereq) {
        const result = {
          order: step.order,
          testId: step.testId,
          testTitle: step.testTitle,
          operation: op,
          status: "blocked",
          response: null,
          error: `Blocked due to failed prerequisite ${blockedPrereq.serviceId}::${blockedPrereq.operationId}`,
          request: null,
        };
        results.push(result);
        stepResults.set(opKey, { status: "blocked" });
        continue;
      }

      // Build HTTP request from step data
      const request = buildHttpRequestFromStep(step, apiModels, { variables: envVars });

      // Execute using the shared HTTP executor
      let stepResult;
      if (dryRun) {
        stepResult = await executeHttpRequest(request, {
          dryRun: true,
          variables: envVars,
        });
      } else {
        stepResult = await executeHttpRequest(request, {
          dryRun: false,
          variables: envVars,
        });
      }

      // Store response for downstream steps
      if (stepResult.response) {
        context.setResponse(opKey, stepResult.response);
      }

      // Apply bindings for downstream steps
      for (const binding of step.bindings || []) {
        const sourceResponse = context.getResponse(`${binding.from?.serviceId}::${binding.from?.operationId}`);
        if (sourceResponse) {
          const value = sourceResponse;
          if (value !== undefined) {
            context.addBinding({
              relationship: binding.relationship || { type: binding.type, transform: binding.transform },
              from: binding.from || { serviceId: binding.from?.serviceId, operationId: binding.from?.operationId, location: binding.source },
              to: binding.to || { serviceId: binding.to?.serviceId, operationId: binding.to?.operationId, location: binding.target },
            });
          }
        }
      }

      const status = stepResult.status === "passed" ? "passed" :
                     stepResult.status === "failed" ? "failed" :
                     stepResult.status === "blocked" ? "blocked" :
                     stepResult.status === "dry_run" ? "passed" : "failed";

      const result = {
        order: step.order,
        testId: step.testId,
        testTitle: step.testTitle,
        operation: op,
        status,
        response: stepResult.response,
        error: stepResult.error || null,
        request: stepResult.request,
        validation: stepResult.validation,
        responseTimeMs: stepResult.responseTimeMs,
      };

      results.push(result);
      stepResults.set(opKey, { status });
    }

    const finalStatus = determineRunStatus(results);
    const sanitizedResults = results.map(sanitizeResult);

    const updated = repo.updateRun(projectId, runId, {
      status: finalStatus,
      planStatus: "completed",
      results: sanitizedResults,
      completedAt: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * Cancel a running execution run.
   *
   * @param {string} projectId
   * @param {string} runId
   * @returns {object} Updated run
   */
  async cancelRun(projectId, runId) {
    if (!projectId || !runId) throw new Error("Project ID and Run ID are required.");

    const run = repo.getRun(projectId, runId);
    if (!run) throw new Error(`ExecutionRun not found: ${runId}`);

    if (run.status !== "running" && run.status !== "pending") {
      throw new Error(`Cannot cancel run with status: ${run.status}`);
    }

    return repo.updateRun(projectId, runId, {
      status: "cancelled",
      planStatus: "cancelled",
      completedAt: new Date().toISOString(),
    });
  }

  /**
   * Get stats for execution runs.
   *
   * @param {string} projectId
   * @returns {object}
   */
  async getStats(projectId) {
    if (!projectId) throw new Error("Project ID is required.");
    const runs = repo.listRuns(projectId);
    const total = runs.length;
    const pending = runs.filter((r) => r.status === "pending").length;
    const running = runs.filter((r) => r.status === "running").length;
    const passed = runs.filter((r) => r.status === "passed").length;
    const failed = runs.filter((r) => r.status === "failed").length;
    const blocked = runs.filter((r) => r.status === "blocked").length;
    const skipped = runs.filter((r) => r.status === "skipped").length;
    const cancelled = runs.filter((r) => r.status === "cancelled").length;

    let lastUpdated = null;
    if (runs.length > 0) {
      const sorted = [...runs].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
      lastUpdated = sorted[0].updatedAt || sorted[0].createdAt || null;
    }

    return { total, pending, running, passed, failed, blocked, skipped, cancelled, lastUpdated };
  }

  /**
   * Ensure the repository is ready.
   */
  async ensureReady() {
    return repo.ensureReady();
  }
}

let serviceInstance = null;

function getExecutionWorkspaceService() {
  if (!serviceInstance) {
    serviceInstance = new ExecutionWorkspaceService();
  }
  return serviceInstance;
}

function resetExecutionWorkspaceService() {
  serviceInstance = null;
}

module.exports = {
  ExecutionWorkspaceService,
  getExecutionWorkspaceService,
  resetExecutionWorkspaceService,
  RUN_STATUS,
  buildHttpRequestFromStep,
  determineRunStatus,
  sanitizeResult,
};
