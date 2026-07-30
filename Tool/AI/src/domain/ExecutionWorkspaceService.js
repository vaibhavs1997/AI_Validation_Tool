/**
 * ExecutionWorkspaceService
 *
 * Service layer for Execution Workspace operations.
 * Wires existing REST endpoints to the new execution engine.
 */

const { createExecutionRun } = require('./ExecutionRun');
const repo = require('./ExecutionRunRepository');
const { buildExecutionPlan, validatePlan } = require('./ExecutionPlan');
const { resolveDependencies } = require('./DependencyResolver');
const { executeTestSpecification } = require('../execution/dependencyAwareExecutor');
const { getService, listServices, getApiModel } = require('./ServiceRepository');
const { getProjectKnowledge } = require('./ProjectKnowledgeRepository');
const { getExecutableTestService } = require('./ExecutableTestService');
const { createExecutionRunService } = require('./ExecutionRunService');
const { createExecutionContext } = require('./ExecutionContext');

/**
 * Map a backend ExecutionRun to the frontend ExecutionRun shape.
 */
function toFrontendShape(run) {
  if (!run) return null;
  const plan = run.executionPlan || run.plan || null;
  const steps = plan && Array.isArray(plan.steps) ? plan.steps : [];
  return {
    id: run.id,
    projectId: run.projectId,
    name: run.title || run.name || 'Execution Run',
    status: run.status || 'pending',
    plan: plan
      ? {
          steps: steps.map((s) => ({
            id: s.id || `${s.order}`,
            testId: s.testId || '',
            title: s.title || (s.operation ? `${s.operation.serviceId}::${s.operation.operationId}` : `Step ${s.order}`),
            description: s.description || (s.operation ? s.operation.summary || '' : ''),
            order: s.order,
            status: s.status || 'pending',
            dependencies: s.dependencies || (s.prerequisites || []).map((p) => `${p.serviceId}::${p.operationId}`),
            request: s.request || null,
            operationRef: s.operationRef || s.operation || null,
          })),
          totalSteps: steps.length,
          executionOrder: plan.executionOrder || steps.map((s) => `${s.order}`),
          warnings: run.warnings || [],
          variables: run.variables || {},
          authentication: run.authentication || {},
          environment: run.environment || {},
          estimatedSteps: steps.length,
          dependencies: steps.reduce((acc, s) => {
            acc[s.id || `${s.order}`] = s.dependencies || (s.prerequisites || []).map((p) => `${p.serviceId}::${p.operationId}`);
            return acc;
          }, {}),
        }
      : null,
    steps: (run.results || []).map((r) => ({
      id: r.stepId || `${r.step}`,
      testId: r.testId || '',
      title: r.title || (r.operation ? `${r.operation.serviceId}::${r.operation.operationId}` : `Step ${r.step}`),
      description: r.description || (r.operation ? r.operation.summary || '' : ''),
      order: r.step || r.order,
      status: r.status || 'pending',
      dependencies: [],
      executionTime: r.durationMs ? `${r.durationMs}ms` : undefined,
      log: r.error || undefined,
      error: r.error || undefined,
      startedAt: r.startedAt || undefined,
      completedAt: r.completedAt || undefined,
      statusCode: r.statusCode || undefined,
      responseBody: r.responseBody || undefined,
    })),
    logs: (run.results || []).map((r) => r.error).filter(Boolean),
    variables: run.variables || {},
    authentication: run.authentication || {},
    environment: run.environment || {},
    warnings: run.warnings || [],
    results: run.results || [],
    createdAt: run.createdAt ? new Date(run.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: run.updatedAt ? new Date(run.updatedAt).toISOString() : new Date().toISOString(),
    startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : undefined,
    completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : undefined,
    approved: run.planStatus === 'completed' || run.status === 'passed' || run.status === 'completed',
  };
}

class ExecutionWorkspaceService {
  constructor() {
    // Use the new ExecutionRunService as the execution engine
    this.engine = createExecutionRunService();
  }

  /**
   * List execution runs for a project (summary form).
   */
  async listRuns(projectId) {
    if (!projectId) throw new Error('Project ID is required.');
    // Use repo to list runs (backward compatible)
    const runs = repo.listRuns(projectId);
    return runs.map((r) => {
      const full = repo.getRun(projectId, r.id);
      return toFrontendShape(full) || toFrontendShape(r);
    });
  }

  /**
   * Get execution run stats for a project.
   */
  async getStats(projectId) {
    if (!projectId) throw new Error('Project ID is required.');
    const runs = repo.listRuns(projectId);
    return {
      total: runs.length,
      pending: runs.filter((r) => r.status === 'pending').length,
      planned: runs.filter((r) => r.planStatus === 'ready' || r.planStatus === 'draft').length,
      running: runs.filter((r) => r.status === 'running').length,
      passed: runs.filter((r) => r.status === 'passed').length,
      failed: runs.filter((r) => r.status === 'failed').length,
      blocked: runs.filter((r) => r.status === 'blocked').length,
      skipped: runs.filter((r) => r.status === 'skipped').length,
      cancelled: runs.filter((r) => r.status === 'cancelled').length,
      completed: runs.filter((r) => r.status === 'passed' || r.status === 'failed' || r.status === 'completed').length,
      lastUpdated: runs.length > 0
        ? runs.map((r) => r.updatedAt).sort().reverse()[0]
        : null,
    };
  }

  /**
   * Get a single execution run by ID.
   */
  async getRun(projectId, runId) {
    if (!projectId || !runId) throw new Error('Project ID and Run ID are required.');
    // Check engine first (new runs), then repo (existing runs)
    const engineRun = this.engine.getRun(runId);
    if (engineRun) return toFrontendShape(engineRun);
    
    const run = repo.getRun(projectId, runId);
    if (!run) throw new Error(`ExecutionRun not found: ${runId}`);
    return toFrontendShape(run);
  }

  /**
   * Create a new execution run.
   */
  async createRun(projectId, data = {}) {
    if (!projectId) throw new Error('Project ID is required.');
    // Use the new engine
    const run = this.engine.createRun({
      projectId,
      name: data.name || data.title || `Run ${new Date().toLocaleString()}`,
      description: data.description || '',
      plan: data.plan || null,
    });
    
    // Also persist via repo for backward compatibility
    repo.saveRun(projectId, run);
    
    return toFrontendShape(run);
  }

  /**
   * Delete an execution run.
   */
  async deleteRun(projectId, runId) {
    if (!projectId || !runId) throw new Error('Project ID and Run ID are required.');
    const deleted = repo.deleteRun(projectId, runId);
    if (!deleted) throw new Error(`ExecutionRun not found: ${runId}`);
    return true;
  }

  /**
   * Build or rebuild the execution plan for a run.
   */
  async buildPlan(projectId, runId, data = {}) {
    if (!projectId || !runId) throw new Error('Project ID and Run ID are required.');
    const existing = repo.getRun(projectId, runId);
    if (!existing) throw new Error(`ExecutionRun not found: ${runId}`);

    // Gather approved executable tests
    const testService = getExecutableTestService();
    const tests = await testService.list(projectId, { status: 'approved' });
    const services = await listServices(projectId);
    const apiModels = await Promise.all(services.map((s) => getApiModel(projectId, s.id)));
    const knowledge = await getProjectKnowledge(projectId);
    const relationships = knowledge && knowledge.relationships
      ? knowledge.relationships.filter((r) => r.status === 'confirmed')
      : [];

    let executionPlan = null;
    let warnings = [];

    if (tests.length === 0) {
      warnings.push('No approved executable tests found. Add and approve tests first.');
    } else {
      const test = tests[0];
      const mappedApis = test.mappedApis || [];
      if (mappedApis.length === 0) {
        warnings.push('Selected test has no mapped APIs.');
      } else {
        const targetApi = mappedApis[0];
        try {
          const plan = buildExecutionPlan({
            targetServiceId: targetApi.serviceId,
            targetOperationId: targetApi.operationId,
            services,
            apiModels,
            relationships,
          });
          if (plan.errors.length > 0) {
            warnings = warnings.concat(plan.errors);
          }
          executionPlan = plan;
        } catch (error) {
          warnings.push(`Plan build failed: ${error.message}`);
        }
      }
    }

    const updated = repo.updateRun(projectId, runId, {
      executionPlan,
      planStatus: executionPlan && executionPlan.isValid ? 'ready' : 'draft',
      warnings,
      variables: data.variables || existing.variables || {},
      authentication: data.authentication || existing.authentication || {},
      environment: data.environment || existing.environment || {},
    });

    return toFrontendShape(updated);
  }

  /**
   * Rebuild the execution plan.
   */
  async rebuildPlan(projectId, runId, data = {}) {
    return this.buildPlan(projectId, runId, data);
  }

  /**
   * Execute a run using the new execution engine.
   */
  async executeRun(projectId, runId, data = {}) {
    if (!projectId || !runId) throw new Error('Project ID and Run ID are required.');
    const existing = repo.getRun(projectId, runId);
    if (!existing) throw new Error(`ExecutionRun not found: ${runId}`);

    const dryRun = Boolean(data.dryRun);
    const plan = existing.executionPlan;

    if (!plan || !validatePlan(plan)) {
      throw new Error('No valid execution plan. Build a plan first.');
    }

    // Create context from run data
    const context = createExecutionContext({
      environment: {
        ...(existing.environment || {}),
        dryRun,
        ...(data.environment || {}),
      },
      authentication: data.authentication || existing.authentication || {},
      variables: data.variables || existing.variables || {},
    });

    // Use the new engine to execute
    const result = await this.engine.executeRun(runId, context, { dryRun, continueOnFailure: data.continueOnFailure });

    const allPassed = result.success;
    const newStatus = dryRun ? existing.status : (allPassed ? 'passed' : 'failed');

    const updated = repo.updateRun(projectId, runId, {
      status: newStatus,
      planStatus: 'completed',
      results: result.collector ? result.collector.results : [],
      startedAt: result.collector?.startedAt ? result.collector.startedAt.toISOString() : new Date().toISOString(),
      completedAt: result.collector?.completedAt ? result.collector.completedAt.toISOString() : new Date().toISOString(),
      summary: result.summary || null,
    });

    return toFrontendShape(updated);
  }

  /**
   * Dry run a run (no actual execution).
   */
  async dryRun(projectId, runId, data = {}) {
    return this.executeRun(projectId, runId, { ...data, dryRun: true });
  }

  /**
   * Cancel a running execution run.
   */
  async cancelRun(projectId, runId) {
    if (!projectId || !runId) throw new Error('Project ID and Run ID are required.');
    const existing = repo.getRun(projectId, runId);
    if (!existing) throw new Error(`ExecutionRun not found: ${runId}`);

    // Cancel via engine
    this.engine.cancelRun(runId);

    const updated = repo.updateRun(projectId, runId, {
      status: 'cancelled',
      planStatus: 'cancelled',
      completedAt: new Date().toISOString(),
    });

    return toFrontendShape(updated);
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

async function ensureReady() {
  return repo.ensureReady();
}

module.exports = {
  ExecutionWorkspaceService,
  getExecutionWorkspaceService,
  resetExecutionWorkspaceService,
  ensureReady,
  toFrontendShape,
};