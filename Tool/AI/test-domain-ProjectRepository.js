const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const config = require("./src/config");

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {}
}

function clearProjectModules() {
  clearModule("./src/config");
  clearModule("./src/db/pool");
  clearModule("./src/domain/ProjectRepository");
  clearModule("./src/domain/repositories/FileProjectRepository");
  clearModule("./src/domain/repositories/PostgresProjectRepository");
}

function createMockProjectPool() {
  const state = new Map();
  return {
    async query(sqlText, params = []) {
      const sql = String(sqlText || "").trim().toLowerCase();
      if (sql === "select 1") return { rows: [{ "?column?": 1 }] };
      if (sql.includes("from information_schema.columns")) return { rows: [{ "?column?": 1 }] };
      if (sql.startsWith("insert into projects") && sql.includes("returning")) {
        const id = params[0];
        if (state.has(id)) return { rows: [] };
        const row = { id, name: params[1], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        state.set(id, row);
        return { rows: [row] };
      }
      if (sql.startsWith("insert into projects")) {
        const id = params[0];
        if (!state.has(id)) {
          state.set(id, { id, name: params[1], created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        }
        return { rows: [] };
      }
      if (sql.startsWith("select id, name, created_at, updated_at") && sql.includes("where id")) {
        const row = state.get(params[0]);
        return { rows: row ? [row] : [] };
      }
      if (sql.startsWith("select 1") && sql.includes("from projects")) {
        return { rows: state.has(params[0]) ? [{ exists: 1 }] : [] };
      }
      if (sql.startsWith("select id, name, created_at, updated_at") && sql.includes("order by")) {
        return { rows: Array.from(state.values()).sort((a, b) => a.id.localeCompare(b.id)) };
      }
      throw new Error("Unhandled SQL in project mock: " + sqlText);
    },
    async end() {},
  };
}

function loadProjectRepo({ pgEnabled, mockPool } = {}) {
  process.env.PG_ENABLED = pgEnabled ? "true" : "false";
  clearProjectModules();
  const poolModule = require("./src/db/pool");
  if (mockPool) {
    poolModule.__setPoolFactoryForTests(() => mockPool);
  } else {
    poolModule.__resetPoolForTests();
  }
  return require("./src/domain/ProjectRepository");
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
  await test("file repo create/get/list/projectExists", async () => {
    const repo = loadProjectRepo({ pgEnabled: false });
    const projectId = "proj_repo_" + Date.now().toString(36);
    const projectFile = path.join(config.dataDir, "projects", `${projectId}.json`);
    if (fs.existsSync(projectFile)) fs.unlinkSync(projectFile);

    const created = await Promise.resolve(repo.createProject({ id: projectId, name: "Project Repo Test" }));
    assert.strictEqual(created.id, projectId);
    assert.strictEqual(await Promise.resolve(repo.projectExists(projectId)), true);
    const fetched = await Promise.resolve(repo.getProject(projectId));
    assert.strictEqual(fetched.id, projectId);
    const listed = await Promise.resolve(repo.listProjects());
    assert.ok(listed.some((p) => p.id === projectId));
    if (fs.existsSync(projectFile)) fs.unlinkSync(projectFile);
  });

  await test("postgres repo selection and behavior", async () => {
    const repo = loadProjectRepo({ pgEnabled: true, mockPool: createMockProjectPool() });
    assert.strictEqual(repo.getBackendName(), "postgres");
    await repo.ensureReady();
    const created = await repo.createProject({ id: "pg-proj-1", name: "PG One" });
    assert.strictEqual(created.id, "pg-proj-1");
    const exists = await repo.projectExists("pg-proj-1");
    assert.strictEqual(exists, true);
    const listed = await repo.listProjects();
    assert.strictEqual(listed.length, 1);
  });

  console.log(`\nProjectRepository tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

run();
