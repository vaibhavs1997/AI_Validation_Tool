const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const config = require("./src/config");

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {}
}

function clearKnowledgeModules() {
  clearModule("./src/config");
  clearModule("./src/db/pool");
  clearModule("./src/domain/ProjectRepository");
  clearModule("./src/domain/repositories/FileProjectRepository");
  clearModule("./src/domain/repositories/PostgresProjectRepository");
  clearModule("./src/domain/ProjectKnowledgeRepository");
  clearModule("./src/domain/repositories/FileProjectKnowledgeRepository");
  clearModule("./src/domain/repositories/PostgresProjectKnowledgeRepository");
  clearModule("./src/domain/ProjectKnowledgeService");
}

function ensureProjectFileMode(projectId) {
  const fileRepo = require("./src/domain/repositories/FileProjectRepository");
  const existing = fileRepo.getProject(projectId);
  if (!existing) {
    fileRepo.createProject({ id: projectId, name: projectId });
  }
}

function cleanFileKnowledge(projectId) {
  const file = path.join(config.dataDir, "project-knowledge", `${projectId}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function createMockKnowledgePool() {
  const state = {
    projects: new Set(),
    rows: new Map(),
  };

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
      if (sql.startsWith("select project_id, instructions, relationships, data, updated_at") && sql.includes("from project_knowledge")) {
        const row = state.rows.get(params[0]);
        return { rows: row ? [row] : [] };
      }
      if (sql.startsWith("insert into project_knowledge")) {
        state.rows.set(params[0], {
          project_id: params[0],
          instructions: params[1],
          relationships: JSON.parse(params[2]),
          data: JSON.parse(params[3]),
          updated_at: new Date().toISOString(),
        });
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith("select 1") && sql.includes("from project_knowledge")) {
        return { rows: state.rows.has(params[0]) ? [{ exists: 1 }] : [] };
      }
      throw new Error("Unhandled SQL in mock knowledge pool: " + sqlText);
    },
    async end() {},
  };
}

function loadKnowledgeRepo({ pgEnabled, mockPool } = {}) {
  process.env.PG_ENABLED = pgEnabled ? "true" : "false";
  clearKnowledgeModules();
  const poolModule = require("./src/db/pool");
  if (mockPool) {
    poolModule.__setPoolFactoryForTests(() => mockPool);
  } else {
    poolModule.__resetPoolForTests();
  }
  const repo = require("./src/domain/ProjectKnowledgeRepository");
  const service = require("./src/domain/ProjectKnowledgeService");
  return { repo, service };
}

const rel = (status) => ({
  type: "data_dependency",
  source: { serviceId: "auth", operationId: "login", location: "body.token" },
  target: { serviceId: "payments", operationId: "createPayment", location: "header.Authorization" },
  transform: "******",
  status,
  confidence: 0.9,
  evidence: "auth token chain",
});

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
  await test("PG false selects file knowledge storage", async () => {
    const projectId = "pk_file_" + Date.now().toString(36);
    ensureProjectFileMode(projectId);
    cleanFileKnowledge(projectId);
    const { repo } = loadKnowledgeRepo({ pgEnabled: false });
    assert.strictEqual(repo.getRepositoryMode(), "file");
    const saved = await repo.saveProjectKnowledge(projectId, "Use auth flow", [rel("proposed")]);
    assert.strictEqual(saved.instructions, "Use auth flow");
  });

  await test("PG true selects postgres knowledge storage", async () => {
    const { repo } = loadKnowledgeRepo({ pgEnabled: true, mockPool: createMockKnowledgePool() });
    assert.strictEqual(repo.getRepositoryMode(), "postgres");
    await repo.ensureReady();
  });

  await test("save/get knowledge preserves instructions and relationships", async () => {
    const projectId = "pk_pg_" + Date.now().toString(36);
    const { repo } = loadKnowledgeRepo({ pgEnabled: true, mockPool: createMockKnowledgePool() });
    await repo.saveProjectKnowledge(projectId, "Initial instructions", [rel("proposed")]);
    const fetched = await repo.getProjectKnowledge(projectId);
    assert.strictEqual(fetched.instructions, "Initial instructions");
    assert.strictEqual(fetched.relationships[0].status, "proposed");
  });

  await test("relationship status updates via service preserve behavior", async () => {
    const projectId = "pk_status_" + Date.now().toString(36);
    const { service, repo } = loadKnowledgeRepo({ pgEnabled: true, mockPool: createMockKnowledgePool() });
    await repo.saveProjectKnowledge(projectId, "Instruction", [rel("proposed")]);
    const proposed = await service.listRelationshipsByStatus(projectId, "proposed");
    const key = `${proposed[0].source.serviceId}::${proposed[0].source.operationId}::${proposed[0].source.location}::${proposed[0].target.serviceId}::${proposed[0].target.operationId}::${proposed[0].target.location}`;
    await service.confirmRelationship(projectId, key);
    const confirmed = await service.listRelationshipsByStatus(projectId, "confirmed");
    assert.strictEqual(confirmed.length, 1);
  });

  await test("project isolation for knowledge", async () => {
    const projectA = "pk_a_" + Date.now().toString(36);
    const projectB = "pk_b_" + Date.now().toString(36);
    const { repo } = loadKnowledgeRepo({ pgEnabled: true, mockPool: createMockKnowledgePool() });

    await repo.saveProjectKnowledge(projectA, "A instructions", [rel("proposed")]);
    await repo.saveProjectKnowledge(projectB, "B instructions", []);

    const a = await repo.getProjectKnowledge(projectA);
    const b = await repo.getProjectKnowledge(projectB);
    assert.strictEqual(a.instructions, "A instructions");
    assert.strictEqual(b.instructions, "B instructions");
  });

  await test("missing knowledge returns null/false", async () => {
    const projectId = "pk_missing_" + Date.now().toString(36);
    const { repo } = loadKnowledgeRepo({ pgEnabled: true, mockPool: createMockKnowledgePool() });
    const missing = await repo.getProjectKnowledge(projectId);
    assert.strictEqual(missing, null);
    const exists = await repo.projectKnowledgeExists(projectId);
    assert.strictEqual(exists, false);
  });

  console.log(`\nProjectKnowledge PG parity tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

run();
