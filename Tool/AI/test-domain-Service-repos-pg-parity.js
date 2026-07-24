const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const config = require("./src/config");
const { adaptContractToApiModel } = require("./src/domain/contractAdapter");

const uid = () => "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {}
}

function clearServiceRepoModules() {
  clearModule("./src/config");
  clearModule("./src/db/pool");
  clearModule("./src/domain/ProjectRepository");
  clearModule("./src/domain/repositories/FileProjectRepository");
  clearModule("./src/domain/repositories/PostgresProjectRepository");
  clearModule("./src/domain/ServiceRepository");
  clearModule("./src/domain/repositories/FileServiceRepository");
  clearModule("./src/domain/repositories/PostgresServiceRepository");
}

function ensureProjectFileMode(projectId) {
  const fileRepo = require("./src/domain/repositories/FileProjectRepository");
  const existing = fileRepo.getProject(projectId);
  if (existing) return;
  fileRepo.createProject({ id: projectId, name: projectId });
}

function removeDirIfExists(targetDir) {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
}

function cleanFileStorageForProject(projectId) {
  removeDirIfExists(path.join(config.dataDir, "services", projectId));
  removeDirIfExists(path.join(config.dataDir, "api-models", projectId));
}

function createMockPgPool(options = {}) {
  const state = {
    projects: new Set(),
    services: new Map(),
    apiModels: new Map(),
  };
  const failApiModelInsert = Boolean(options.failApiModelInsert);
  const keyOf = (projectId, serviceId) => `${projectId}::${serviceId}`;
  const cloneMap = (map) => new Map(Array.from(map.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
  const cloneSet = (set) => new Set(Array.from(set.values()));

  function runAgainst(target, sqlText, params = []) {
    const sql = String(sqlText || "").trim().toLowerCase();

    if (sql === "select 1") return { rows: [{ "?column?": 1 }] };
    if (sql.includes("from information_schema.columns")) return { rows: [{ "?column?": 1 }] };
    if (sql.startsWith("insert into projects")) {
      target.projects.add(params[0]);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("select 1") && sql.includes("from projects")) {
      return { rows: [{ exists: 1 }] };
    }
    if (sql.startsWith("select id, name, created_at, updated_at") && sql.includes("from projects")) {
      const id = params[0];
      return { rows: target.projects.has(id) ? [{ id, name: id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] : [] };
    }
    if (sql.startsWith("insert into services")) {
      const [serviceId, projectId, name, protocol, description, data] = params;
      const key = keyOf(projectId, serviceId);
      if (target.services.has(key)) {
        const error = new Error("duplicate key");
        error.code = "23505";
        throw error;
      }
      target.services.set(key, {
        id: serviceId,
        project_id: projectId,
        name,
        protocol,
        description,
        data: JSON.parse(data),
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("select id, name, protocol, description, data") && sql.includes("from services") && sql.includes("limit 1")) {
      const key = keyOf(params[0], params[1]);
      const row = target.services.get(key);
      return { rows: row ? [row] : [] };
    }
    if (sql.startsWith("select id, name, protocol, description, data") && sql.includes("from services") && !sql.includes("limit 1")) {
      const projectId = params[0];
      const rows = [];
      for (const row of target.services.values()) {
        if (row.project_id === projectId) rows.push(row);
      }
      return { rows };
    }
    if (sql.startsWith("select id, protocol") && sql.includes("from services")) {
      const key = keyOf(params[0], params[1]);
      const row = target.services.get(key);
      return { rows: row ? [{ id: row.id, protocol: row.protocol }] : [] };
    }
    if (sql.startsWith("insert into api_models")) {
      if (failApiModelInsert) throw new Error("Simulated api_models failure");
      const [serviceId, projectId, title, baseUrl, sourceType, operations, data] = params;
      target.apiModels.set(keyOf(projectId, serviceId), {
        service_id: serviceId,
        project_id: projectId,
        title,
        base_url: baseUrl,
        source_type: sourceType,
        operations: JSON.parse(operations),
        data: JSON.parse(data),
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("select service_id, title, base_url, source_type, operations, data") && sql.includes("from api_models") && sql.includes("limit 1")) {
      const row = target.apiModels.get(keyOf(params[0], params[1]));
      return { rows: row ? [row] : [] };
    }
    if (sql.startsWith("select service_id, title, base_url, source_type, operations, data") && sql.includes("from api_models") && !sql.includes("limit 1")) {
      const projectId = params[0];
      const rows = [];
      for (const row of target.apiModels.values()) {
        if (row.project_id === projectId) rows.push(row);
      }
      return { rows };
    }
    if (sql.startsWith("select 1") && sql.includes("from services")) {
      return { rows: target.services.has(keyOf(params[0], params[1])) ? [{ exists: 1 }] : [] };
    }
    throw new Error("Unhandled SQL in service mock: " + sqlText);
  }

  return {
    async query(sql, params = []) {
      return runAgainst(state, sql, params);
    },
    async connect() {
      const txState = {
        projects: cloneSet(state.projects),
        services: cloneMap(state.services),
        apiModels: cloneMap(state.apiModels),
      };
      return {
        async query(sql, params = []) {
          const lower = String(sql || "").trim().toLowerCase();
          if (lower === "begin" || lower === "rollback") return { rows: [] };
          if (lower === "commit") {
            state.projects = txState.projects;
            state.services = txState.services;
            state.apiModels = txState.apiModels;
            return { rows: [] };
          }
          return runAgainst(txState, sql, params);
        },
        release() {},
      };
    },
    async end() {},
  };
}

function loadServiceRepo({ pgEnabled, mockPool } = {}) {
  process.env.PG_ENABLED = pgEnabled ? "true" : "false";
  clearServiceRepoModules();
  const poolModule = require("./src/db/pool");
  if (mockPool) {
    poolModule.__setPoolFactoryForTests(() => mockPool);
  } else {
    poolModule.__resetPoolForTests();
  }
  const repo = require("./src/domain/ServiceRepository");
  return { repo, poolModule };
}

async function createProjectInCurrentRepo(projectId) {
  const projectRepo = require("./src/domain/ProjectRepository");
  const exists = await Promise.resolve(projectRepo.projectExists(projectId));
  if (!exists) {
    await Promise.resolve(projectRepo.createProject({ id: projectId, name: projectId }));
  }
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
  await test("PG false selects file storage", async () => {
    const { repo } = loadServiceRepo({ pgEnabled: false });
    assert.strictEqual(repo.getRepositoryMode(), "file");
  });

  await test("PG true selects PostgreSQL storage", async () => {
    const { repo } = loadServiceRepo({ pgEnabled: true, mockPool: createMockPgPool() });
    assert.strictEqual(repo.getRepositoryMode(), "postgres");
    await repo.ensureReady();
  });

  await test("File repo parity: create/get/list, duplicate, missing, api model", async () => {
    const projectId = "proj_file_" + uid();
    ensureProjectFileMode(projectId);
    cleanFileStorageForProject(projectId);

    const { repo } = loadServiceRepo({ pgEnabled: false });
    const serviceInput = { id: "users-service", name: "Users API", protocol: "rest", description: "desc" };
    const created = await repo.createService(projectId, serviceInput);
    assert.strictEqual(created.id, "users-service");
    assert.strictEqual(created.projectId, projectId);

    const fetched = await repo.getService(projectId, "users-service");
    assert.strictEqual(fetched.name, "Users API");

    const listed = await repo.listServices(projectId);
    assert.strictEqual(listed.length, 1);

    await assert.rejects(async () => repo.createService(projectId, serviceInput), /Service already exists/);

    const missing = await repo.getService(projectId, "missing");
    assert.strictEqual(missing, null);
    const missingExists = await repo.serviceExists(projectId, "missing");
    assert.strictEqual(missingExists, false);

    const apiModel = adaptContractToApiModel({
      title: "Users API",
      baseUrl: "https://api.example.com",
      endpoints: [{ id: "listUsers", method: "GET", path: "/users", summary: "List users" }],
    });
    await repo.saveApiModel(projectId, "users-service", {
      sourceType: apiModel.sourceType,
      title: apiModel.title,
      baseUrl: apiModel.baseUrl,
      operations: apiModel.operations,
    });
    const model = await repo.getApiModel(projectId, "users-service");
    assert.strictEqual(model.baseUrl, "https://api.example.com");
    assert.strictEqual(model.operations[0].id, "listUsers");
    const allModels = await repo.listApiModels(projectId);
    assert.strictEqual(allModels.length, 1);
  });

  await test("PG repo parity: project isolation and same service id across projects", async () => {
    const projectA = "proj_pg_a_" + uid();
    const projectB = "proj_pg_b_" + uid();
    const { repo } = loadServiceRepo({ pgEnabled: true, mockPool: createMockPgPool() });
    await createProjectInCurrentRepo(projectA);
    await createProjectInCurrentRepo(projectB);
    await repo.createService(projectA, { id: "shared-id", name: "A service", protocol: "rest" });
    await repo.createService(projectB, { id: "shared-id", name: "B service", protocol: "rest" });

    const a = await repo.getService(projectA, "shared-id");
    const b = await repo.getService(projectB, "shared-id");
    assert.strictEqual(a.name, "A service");
    assert.strictEqual(b.name, "B service");
  });

  await test("PG repo preserves operation IDs and baseUrl", async () => {
    const projectId = "proj_pg_meta_" + uid();
    const { repo } = loadServiceRepo({ pgEnabled: true, mockPool: createMockPgPool() });
    await createProjectInCurrentRepo(projectId);
    await repo.createService(projectId, { id: "payments", name: "Payments", protocol: "rest" });
    await repo.saveApiModel(projectId, "payments", {
      sourceType: "openapi",
      title: "Payments API",
      baseUrl: "https://api.payments.local",
      operations: [{ id: "refundPayment", method: "POST", path: "/payments/{id}/refund", summary: "Refund payment" }],
    });
    const model = await repo.getApiModel(projectId, "payments");
    assert.strictEqual(model.baseUrl, "https://api.payments.local");
    assert.strictEqual(model.operations[0].id, "refundPayment");
  });

  await test("PG registration transaction rolls back on api model failure", async () => {
    const projectId = "proj_pg_tx_" + uid();
    const { repo } = loadServiceRepo({
      pgEnabled: true,
      mockPool: createMockPgPool({ failApiModelInsert: true }),
    });
    await createProjectInCurrentRepo(projectId);

    await assert.rejects(
      async () =>
        repo.registerServiceWithApiModel(
          projectId,
          { id: "orders", name: "Orders API", protocol: "rest" },
          { sourceType: "openapi", title: "Orders API", baseUrl: "https://orders.local", operations: [] }
        ),
      /Simulated api_models failure/
    );

    const service = await repo.getService(projectId, "orders");
    assert.strictEqual(service, null);
  });

  console.log(`\nService/API model PG parity tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

run();
