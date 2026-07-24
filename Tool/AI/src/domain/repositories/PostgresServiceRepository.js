const { getPool, checkConnection } = require("../../db/pool");
const { DEFAULT_PROJECT } = require("../ProjectIdentity");
const { createServiceDefinition } = require("../ServiceDefinition");
const { createApiModel } = require("../ApiModel");
const { projectExists: projectExistsInProjectRepo } = require("../ProjectRepository");

async function resolveProjectExistence(projectId) {
  const resolved = typeof projectId === "string" ? projectId.trim() : "";
  if (!resolved) {
    throw new Error("projectId must be a non-empty string.");
  }
  if (resolved === DEFAULT_PROJECT.id) return resolved;
  const exists = await Promise.resolve(projectExistsInProjectRepo(resolved));
  if (!exists) {
    throw new Error(`Unknown projectId: ${resolved}`);
  }
  return resolved;
}

async function ensureProjectRow(projectId) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO projects (id, name)
     VALUES ($1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [projectId]
  );
}

function mapServiceRow(row, projectId) {
  const fallback = {
    id: row.id,
    name: row.name || row.id,
    protocol: row.protocol || "rest",
    description: row.description || "",
  };
  const fromData = row.data && typeof row.data === "object" ? row.data : null;
  const service = createServiceDefinition(fromData ? { ...fallback, ...fromData } : fallback);
  return { ...service, projectId };
}

function mapApiModelRow(row, projectId, serviceId) {
  const fromData = row.data && typeof row.data === "object" ? row.data : null;
  const fallback = {
    service: {
      id: serviceId,
      name: serviceId,
      protocol: "rest",
      description: "",
    },
    sourceType: row.source_type || "openapi",
    title: row.title || serviceId,
    baseUrl: row.base_url || "",
    operations: Array.isArray(row.operations) ? row.operations : [],
  };
  const model = createApiModel(fromData ? { ...fallback, ...fromData } : fallback);
  return { ...model, projectId, serviceId };
}

async function createService(projectId, input, client) {
  const resolvedProjectId = await resolveProjectExistence(projectId);
  const service = createServiceDefinition({
    id: input.id,
    name: input.name,
    protocol: input.protocol,
    description: input.description,
  });

  const db = client || getPool();
  if (!client) {
    await ensureProjectRow(resolvedProjectId);
  }
  try {
    await db.query(
      `INSERT INTO services (id, project_id, name, protocol, description, data)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        service.id,
        resolvedProjectId,
        service.name,
        service.protocol,
        service.description,
        JSON.stringify(service),
      ]
    );
  } catch (error) {
    if (error && error.code === "23505") {
      throw new Error(`Service already exists in project ${resolvedProjectId}: ${service.id}`);
    }
    throw error;
  }
  return { ...service, projectId: resolvedProjectId };
}

async function getService(projectId, serviceId) {
  const resolvedProjectId = await resolveProjectExistence(projectId);
  const result = await getPool().query(
    `SELECT id, name, protocol, description, data
     FROM services
     WHERE project_id = $1 AND id = $2
     LIMIT 1`,
    [resolvedProjectId, serviceId]
  );
  if (result.rows.length === 0) return null;
  return mapServiceRow(result.rows[0], resolvedProjectId);
}

async function listServices(projectId) {
  const resolvedProjectId = await resolveProjectExistence(projectId);
  const result = await getPool().query(
    `SELECT id, name, protocol, description, data
     FROM services
     WHERE project_id = $1`,
    [resolvedProjectId]
  );
  return result.rows.map((row) => mapServiceRow(row, resolvedProjectId)).sort((a, b) => a.id.localeCompare(b.id));
}

async function saveApiModel(projectId, serviceId, input, client) {
  const resolvedProjectId = await resolveProjectExistence(projectId);
  const db = client || getPool();

  const serviceResult = await db.query(
    `SELECT id, protocol
     FROM services
     WHERE project_id = $1 AND id = $2
     LIMIT 1`,
    [resolvedProjectId, serviceId]
  );
  if (serviceResult.rows.length === 0) {
    throw new Error(`Service not found in project ${resolvedProjectId}: ${serviceId}`);
  }

  const model = createApiModel({
    service: {
      id: serviceId,
      name: serviceId,
      protocol: input.service?.protocol || serviceResult.rows[0].protocol || "rest",
      description: input.service?.description || "",
    },
    sourceType: input.sourceType,
    title: input.title,
    baseUrl: input.baseUrl,
    operations: input.operations || [],
  });

  await db.query(
    `INSERT INTO api_models (service_id, project_id, title, base_url, source_type, operations, data)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     ON CONFLICT (project_id, service_id)
     DO UPDATE SET
       title = EXCLUDED.title,
       base_url = EXCLUDED.base_url,
       source_type = EXCLUDED.source_type,
       operations = EXCLUDED.operations,
       data = EXCLUDED.data`,
    [
      serviceId,
      resolvedProjectId,
      model.title,
      model.baseUrl,
      model.sourceType,
      JSON.stringify(model.operations || []),
      JSON.stringify(model),
    ]
  );

  return { ...model, projectId: resolvedProjectId, serviceId };
}

async function getApiModel(projectId, serviceId) {
  const resolvedProjectId = await resolveProjectExistence(projectId);
  const result = await getPool().query(
    `SELECT service_id, title, base_url, source_type, operations, data
     FROM api_models
     WHERE project_id = $1 AND service_id = $2
     LIMIT 1`,
    [resolvedProjectId, serviceId]
  );
  if (result.rows.length === 0) return null;
  return mapApiModelRow(result.rows[0], resolvedProjectId, serviceId);
}

async function listApiModels(projectId) {
  const resolvedProjectId = await resolveProjectExistence(projectId);
  const result = await getPool().query(
    `SELECT service_id, title, base_url, source_type, operations, data
     FROM api_models
     WHERE project_id = $1`,
    [resolvedProjectId]
  );
  return result.rows
    .map((row) => mapApiModelRow(row, resolvedProjectId, row.service_id))
    .sort((a, b) => a.service.id.localeCompare(b.service.id));
}

async function serviceExists(projectId, serviceId) {
  const resolvedProjectId = await resolveProjectExistence(projectId);
  const result = await getPool().query(
    `SELECT 1
     FROM services
     WHERE project_id = $1 AND id = $2
     LIMIT 1`,
    [resolvedProjectId, serviceId]
  );
  return result.rows.length > 0;
}

async function registerServiceWithApiModel(projectId, serviceInput, apiModelInput) {
  const resolvedProjectId = await resolveProjectExistence(projectId);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await ensureProjectRow(resolvedProjectId);
    const service = await createService(resolvedProjectId, serviceInput, client);
    const apiModel = await saveApiModel(resolvedProjectId, service.id, apiModelInput, client);
    await client.query("COMMIT");
    return { service, apiModel };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

function getBackendName() {
  return "postgres";
}

async function ensureReady() {
  await checkConnection();
  await getPool().query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'services' AND column_name IN ('id','project_id','name','protocol','description','data')`
  );
  await getPool().query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'api_models' AND column_name IN ('service_id','project_id','title','base_url','source_type','operations','data')`
  );
  return true;
}

module.exports = {
  createService,
  getService,
  listServices,
  saveApiModel,
  getApiModel,
  listApiModels,
  serviceExists,
  registerServiceWithApiModel,
  validateProjectId: resolveProjectExistence,
  getBackendName,
  ensureReady,
};
