/**
 * FileExecutionRunRepository
 *
 * File-based persistence for ExecutionRun domain objects.
 */

const fs = require("fs");
const path = require("path");
const config = require("../../config");
const { createExecutionRun, VALID_STATUSES, VALID_PLAN_STATUSES } = require("../ExecutionRun");

const RUNS_DIR = path.join(config.dataDir, "execution-runs");

function ensureDir(projectId) {
  const dir = path.join(RUNS_DIR, projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function safeName(value) {
  const str = String(value || "unnamed");
  const sanitized = str
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return sanitized || "unnamed";
}

function runFilePath(projectId, runId) {
  return path.join(RUNS_DIR, safeName(projectId), `${safeName(runId)}.json`);
}

function summarizeRun(run) {
  const results = run.results || [];
  const total = results.length;
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const blocked = results.filter((r) => r.status === "blocked").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  const plan = run.executionPlan || {};
  const steps = plan.steps || [];

  return {
    id: run.id,
    projectId: run.projectId,
    title: run.title || "Execution Run",
    description: run.description || "",
    status: run.status || "pending",
    planStatus: run.planStatus || "draft",
    testIds: run.testIds || [],
    stepCount: steps.length,
    passedSteps: passed,
    failedSteps: failed,
    blockedSteps: blocked,
    skippedSteps: skipped,
    warnings: run.warnings || [],
    variables: run.variables || {},
    authentication: run.authentication || {},
    startedAt: run.startedAt || "",
    completedAt: run.completedAt || "",
    createdAt: run.createdAt || "",
    updatedAt: run.updatedAt || "",
  };
}

function saveRun(projectId, runData) {
  const dir = ensureDir(projectId);
  const runId = runData.id || `run-${Date.now()}`;
  const safe = safeName(runId);
  const filePath = path.join(dir, `${safe}.json`);

  const run = {
    id: safe,
    projectId,
    ...runData,
    id: safe,
  };

  fs.writeFileSync(filePath, JSON.stringify(run, null, 2), "utf8");
  return { id: safe, projectId };
}

function getRun(projectId, runId) {
  const filePath = runFilePath(projectId, runId);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listRuns(projectId) {
  const dir = path.join(RUNS_DIR, safeName(projectId));
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  const runs = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const run = JSON.parse(fs.readFileSync(filePath, "utf8"));
      runs.push(summarizeRun(run));
    } catch {
      // skip unreadable files
    }
  }
  return runs;
}

function updateRun(projectId, runId, updates) {
  const filePath = runFilePath(projectId, runId);
  if (!fs.existsSync(filePath)) {
    throw new Error(`ExecutionRun not found: ${runId}`);
  }

  const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const merged = {
    ...existing,
    ...updates,
    id: existing.id,
    projectId: existing.projectId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const validated = createExecutionRun(merged);
  fs.writeFileSync(filePath, JSON.stringify(validated, null, 2), "utf8");
  return validated;
}

function deleteRun(projectId, runId) {
  const filePath = runFilePath(projectId, runId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

function getBackendName() {
  return "file";
}

async function ensureReady() {
  if (!fs.existsSync(RUNS_DIR)) {
    fs.mkdirSync(RUNS_DIR, { recursive: true });
  }
  return true;
}

module.exports = {
  saveRun,
  getRun,
  listRuns,
  updateRun,
  deleteRun,
  getBackendName,
  ensureReady,
  safeName,
  summarizeRun,
};
