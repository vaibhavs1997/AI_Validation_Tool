/**
 * RunRepository
 *
 * STEP 5.8 — File-based persistence for the active TestCase-first workflow.
 *
 * Stores canonical Run data in the context of a project.
 *
 * Architecture:
 *   - Project-scoped: data/runs/{projectId}/{runId}.json
 *   - Self-contained: each run stores enough info to render without live project state
 *   - Does NOT mix with legacy run storage (data/runs/*.json)
 *   - Newest runs returned first
 *   - Secret redaction must happen BEFORE persistence (backend does this already)
 */

const fs = require("fs");
const path = require("path");
const config = require("../config");

const RUNS_DIR = path.join(config.dataDir, "runs");

function projectDir(projectId) {
  const safe = String(projectId || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  if (!safe) throw new Error("Invalid projectId");
  return path.join(RUNS_DIR, safe);
}

function ensureProjectDir(projectId) {
  const dir = projectDir(projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function safeRunId(value) {
  const str = String(value || `run-${Date.now()}`);
  const sanitized = str
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return sanitized || `run-${Date.now()}`;
}

function runFilePath(projectId, runId) {
  const dir = projectDir(projectId);
  const safe = safeRunId(runId);
  return path.join(dir, `${safe}.json`);
}

/**
 * Save a run.
 * @param {string} projectId
 * @param {Object} runData - Fully constructed run object
 * @returns {{ id: string, projectId: string }}
 */
function saveRun(projectId, runData) {
  const dir = ensureProjectDir(projectId);
  const runId = runData.id || `run-${Date.now()}`;
  const safe = safeRunId(runId);
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

/**
 * Get a full run by projectId and runId.
 * @param {string} projectId
 * @param {string} runId
 * @returns {Object|null}
 */
function getRun(projectId, runId) {
  const filePath = runFilePath(projectId, runId);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * List runs for a project, newest first.
 * @param {string} projectId
 * @returns {Array} Array of run summaries
 */
function listRuns(projectId) {
  const dir = projectDir(projectId);
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .sort()
    .reverse(); // newest first by filename convention (timestamp-based)

  const runs = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const run = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const results = run.results || [];
      const total = results.length;
      const passed = results.filter(r => r.status === "passed").length;
      const failed = results.filter(r => r.status === "failed").length;
      const blocked = results.filter(r => r.status === "blocked").length;

      runs.push({
        id: run.id,
        projectId: run.projectId,
        testSpecificationId: run.testSpecification?.id || "",
        title: run.title || run.testSpecification?.title || "Untitled",
        description: run.description || run.testSpecification?.description || "",
        status: run.status || "unknown",
        targetServiceId: run.targetOperation?.serviceId || "",
        targetOperationId: run.targetOperation?.operationId || "",
        stepCount: total,
        passedSteps: passed,
        failedSteps: failed,
        blockedSteps: blocked,
        startedAt: run.startedAt || "",
        completedAt: run.completedAt || "",
        durationMs: run.durationMs || 0,
      });
    } catch {
      // skip unreadable files
    }
  }

  return runs;
}

/**
 * Delete a run.
 * @param {string} projectId
 * @param {string} runId
 * @returns {boolean}
 */
function deleteRun(projectId, runId) {
  const filePath = runFilePath(projectId, runId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

module.exports = {
  saveRun,
  getRun,
  listRuns,
  deleteRun,
};