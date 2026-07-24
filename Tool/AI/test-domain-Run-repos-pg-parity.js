const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const config = require("./src/config");

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {}
}

function clearRunRepoModules() {
  clearModule("./src/config");
  clearModule("./src/db/pool");
  clearModule("./src/domain/ProjectRepository");
  clearModule("./src/domain/repositories/FileProjectRepository");
  clearModule("./src/domain/repositories/PostgresProjectRepository");
  clearModule("./src/domain/RunRepository");
  clearModule("./src/domain/repositories/FileRunRepository");
  clearModule("./src/domain/repositories/PostgresRunRepository");
}

function ensureProjectFileMode(projectId) {
  const fileRepo = require("./src/domain/repositories/FileProjectRepository");
  const existing = fileRepo.getProject(projectId);
  if (!existing) {
    fileRepo.createProject({ id: projectId, name: projectId });
  }
}

function cleanFileRuns(projectId) {
  const dir = path.join(config.dataDir, "runs", projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function createMockRunPool() {
  const state = {
    projects: new Set(),
    runs: new Map(),
  };
  const keyOf = (projectId, runId) => `${projectId}::${runId}`;

  return {
    async query(sqlText, params = []) {
      const sql = String(sqlText || "").trim().toLowerCase();
      if (sql === "select 1") return { rows: [{ "?column?": 1 }] };
      if (sql.includes("from information_schema.columns")) return { rows: [{ "?column?": 1 }] };
      if (sql.startsWith("insert into projects")) {
        state.projects.add(params[0]);
        return { rows: [] };
      }
      if (sql.startsWith("select 1") && sql.includes("from projects")) {
        return { rows: [{ exists: 1 }] };
      }
      if (sql.startsWith("select id, name, created_at, updated_at") && sql.includes("from projects")) {
        const id = params[0];
        return { rows: state.projects.has(id) ? [{ id, name: id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] : [] };
      }
      if (sql.startsWith("insert into runs")) {
        const [id, projectId, title, description, status, targetOperation, results, executionPlan, startedAt, completedAt, durationMs, data] = params;
        state.runs.set(keyOf(projectId, id), {
          id,
          project_id: projectId,
          title,
          description,
          status,
          target_operation: JSON.parse(targetOperation),
          results: JSON.parse(results),
          execution_plan: JSON.parse(executionPlan),
          started_at: startedAt,
          completed_at: completedAt,
          duration_ms: durationMs,
          data: JSON.parse(data),
        });
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("select id, project_id, title, description, status, target_operation, results, execution_plan") && sql.includes("from runs") && sql.includes("limit 1")) {
        const row = state.runs.get(keyOf(params[0], params[1]));
        return { rows: row ? [row] : [] };
      }
      if (sql.startsWith("select id, project_id, title, description, status, target_operation, results, execution_plan") && sql.includes("from runs") && sql.includes("order by")) {
        const projectId = params[0];
        const rows = [];
        for (const row of state.runs.values()) {
          if (row.project_id === projectId) rows.push(row);
        }
        rows.sort((a, b) => String(b.id).localeCompare(String(a.id)));
        return { rows };
      }
      if (sql.startsWith("delete from runs")) {
        const existed = state.runs.delete(keyOf(params[0], params[1]));
        return { rows: [], rowCount: existed ? 1 : 0 };
      }
      throw new Error("Unhandled SQL in run mock: " + sqlText);
    },
    async end() {},
  };
}

function loadRunRepo({ pgEnabled, mockPool } = {}) {
  process.env.PG_ENABLED = pgEnabled ? "true" : "false";
  clearRunRepoModules();
  const poolModule = require("./src/db/pool");
  if (mockPool) {
    poolModule.__setPoolFactoryForTests(() => mockPool);
  } else {
    poolModule.__resetPoolForTests();
  }
  const repo = require("./src/domain/RunRepository");
  return { repo };
}

function sampleRun(id, projectId, status) {
  return {
    id,
    projectId,
    title: `Run ${id}`,
    description: `Execution ${id}`,
    status,
    testSpecification: { id: `spec-${id}`, title: "Spec", description: "Spec Desc" },
    executionPlanSummary: { target: { serviceId: "svc", operationId: "op" }, stepCount: 2, operations: [] },
    targetOperation: { serviceId: "svc", operationId: "op" },
    results: [
      {
        status,
        request: { headers: { Authorization: "[REDACTED]" }, body: { safe: true } },
        response: { headers: { "x-safe": "ok" }, body: { ok: true } },
      },
      { status: "blocked", request: null, response: null, error: "dependency failed" },
    ],
    errors: status === "failed" ? ["step failed"] : [],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 12,
  };
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
  } catch (error) {
    failed++;
    console.error("FAIL:", name);
    console.error(error && error.stack ? error.stack : error);
  }
}

async function run() {
  await test("PG false selects file repository", async () => {
    const { repo } = loadRunRepo({ pgEnabled: false });
    assert.strictEqual(repo.getRepositoryMode(), "file");
  });

  await test("PG true selects postgres repository", async () => {
    const { repo } = loadRunRepo({ pgEnabled: true, mockPool: createMockRunPool() });
    assert.strictEqual(repo.getRepositoryMode(), "postgres");
    await repo.ensureReady();
  });

  await test("save/get/list run in file repository", async () => {
    const projectId = "run_file_" + Date.now().toString(36);
    ensureProjectFileMode(projectId);
    cleanFileRuns(projectId);
    const { repo } = loadRunRepo({ pgEnabled: false });

    const run = sampleRun("spec-a-1000", projectId, "passed");
    const persisted = await repo.saveRun(projectId, run);
    const fetched = await repo.getRun(projectId, persisted.id);
    assert.strictEqual(fetched.id, persisted.id);
    await repo.saveRun(projectId, sampleRun("spec-a-1001", projectId, "failed"));
    const list = await repo.listRuns(projectId);
    assert.strictEqual(list.length, 2);
  });

  await test("project isolation + same run id across projects", async () => {
    const projectA = "run_pg_a_" + Date.now().toString(36);
    const projectB = "run_pg_b_" + Date.now().toString(36);
    const { repo } = loadRunRepo({ pgEnabled: true, mockPool: createMockRunPool() });

    await repo.saveRun(projectA, sampleRun("same-run-id", projectA, "passed"));
    await repo.saveRun(projectB, sampleRun("same-run-id", projectB, "failed"));

    const a = await repo.getRun(projectA, "same-run-id");
    const b = await repo.getRun(projectB, "same-run-id");
    assert.strictEqual(a.status, "passed");
    assert.strictEqual(b.status, "failed");
  });

  await test("failed and blocked run evidence persists unchanged", async () => {
    const projectId = "run_pg_fail_" + Date.now().toString(36);
    const { repo } = loadRunRepo({ pgEnabled: true, mockPool: createMockRunPool() });
    const run = sampleRun("failed-run", projectId, "failed");
    run.errors = ["upstream unavailable"];
    await repo.saveRun(projectId, run);
    const fetched = await repo.getRun(projectId, "failed-run");
    assert.strictEqual(fetched.errors[0], "upstream unavailable");
    assert.strictEqual(fetched.results[0].request.headers.Authorization, "[REDACTED]");
  });

  await test("missing run returns null and delete respects scope", async () => {
    const projectId = "run_pg_missing_" + Date.now().toString(36);
    const { repo } = loadRunRepo({ pgEnabled: true, mockPool: createMockRunPool() });
    const missing = await repo.getRun(projectId, "missing-run");
    assert.strictEqual(missing, null);
    const deleted = await repo.deleteRun(projectId, "missing-run");
    assert.strictEqual(deleted, false);
  });

  console.log(`\nRun PG parity tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

run();
