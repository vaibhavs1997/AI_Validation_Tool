const { getPool, checkConnection } = require("../../db/pool");
const { safeRunId, summarizeRun } = require("./FileRunRepository");

function normalizeProjectId(projectId) {
  const safe = String(projectId || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  if (!safe) throw new Error("Invalid projectId");
  return safe;
}

async function ensureProjectRow(projectId) {
  await getPool().query(
    `INSERT INTO projects (id, name)
     VALUES ($1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [projectId]
  );
}

function buildRunFromRow(row) {
  const doc = row.data && typeof row.data === "object" ? row.data : {};
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title || doc.title || "",
    description: row.description || doc.description || "",
    status: row.status || doc.status || "pending",
    testSpecification: doc.testSpecification || {},
    executionPlanSummary: doc.executionPlanSummary || {},
    targetOperation: row.target_operation || doc.targetOperation || {},
    results: Array.isArray(row.results) ? row.results : doc.results || [],
    errors: Array.isArray(doc.errors) ? doc.errors : [],
    startedAt: row.started_at || doc.startedAt || "",
    completedAt: row.completed_at || doc.completedAt || "",
    durationMs: Number.isFinite(row.duration_ms) ? row.duration_ms : doc.durationMs || 0,
  };
}

async function saveRun(projectId, runData) {
  const normalizedProjectId = normalizeProjectId(projectId);
  await ensureProjectRow(normalizedProjectId);
  const runId = runData.id || `run-${Date.now()}`;
  const safeId = safeRunId(runId);

  const run = {
    id: safeId,
    projectId: normalizedProjectId,
    ...runData,
    id: safeId,
  };

  await getPool().query(
    `INSERT INTO runs (
      id, project_id, title, description, status, target_operation, results, execution_plan,
      started_at, completed_at, duration_ms, data
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::timestamptz, $10::timestamptz, $11, $12::jsonb)
     ON CONFLICT (project_id, id)
     DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       status = EXCLUDED.status,
       target_operation = EXCLUDED.target_operation,
       results = EXCLUDED.results,
       execution_plan = EXCLUDED.execution_plan,
       started_at = EXCLUDED.started_at,
       completed_at = EXCLUDED.completed_at,
       duration_ms = EXCLUDED.duration_ms,
       data = EXCLUDED.data`,
    [
      safeId,
      normalizedProjectId,
      run.title || "",
      run.description || "",
      run.status || "pending",
      JSON.stringify(run.targetOperation || {}),
      JSON.stringify(run.results || []),
      JSON.stringify(run.executionPlanSummary || {}),
      run.startedAt || null,
      run.completedAt || null,
      run.durationMs || 0,
      JSON.stringify(run),
    ]
  );

  return { id: safeId, projectId: normalizedProjectId };
}

async function getRun(projectId, runId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  const safeId = safeRunId(runId);
  const result = await getPool().query(
    `SELECT id, project_id, title, description, status, target_operation, results, execution_plan,
            started_at, completed_at, duration_ms, data
     FROM runs
     WHERE project_id = $1 AND id = $2
     LIMIT 1`,
    [normalizedProjectId, safeId]
  );
  if (result.rows.length === 0) return null;
  return buildRunFromRow(result.rows[0]);
}

async function listRuns(projectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  const result = await getPool().query(
    `SELECT id, project_id, title, description, status, target_operation, results, execution_plan,
            started_at, completed_at, duration_ms, data
     FROM runs
     WHERE project_id = $1
     ORDER BY id DESC`,
    [normalizedProjectId]
  );
  return result.rows.map((row) => summarizeRun(buildRunFromRow(row)));
}

async function deleteRun(projectId, runId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  const safeId = safeRunId(runId);
  const result = await getPool().query(
    `DELETE FROM runs
     WHERE project_id = $1 AND id = $2`,
    [normalizedProjectId, safeId]
  );
  return result.rowCount > 0;
}

function getBackendName() {
  return "postgres";
}

async function ensureReady() {
  await checkConnection();
  await getPool().query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'runs'
       AND column_name IN ('id','project_id','title','description','status','target_operation','results','execution_plan','started_at','completed_at','duration_ms','data')`
  );
  return true;
}

module.exports = {
  saveRun,
  getRun,
  listRuns,
  deleteRun,
  getBackendName,
  ensureReady,
};
