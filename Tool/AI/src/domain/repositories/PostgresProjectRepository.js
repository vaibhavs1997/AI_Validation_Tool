const { getPool, checkConnection } = require("../../db/pool");
const { DEFAULT_PROJECT, createProjectIdentity } = require("../ProjectIdentity");

function toIdentity(row) {
  return createProjectIdentity({
    id: row.id,
    name: row.name || row.id,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  });
}

async function createProject(input) {
  const candidate = createProjectIdentity({
    id: input && input.id,
    name: input && input.name,
    createdAt: input && input.createdAt,
    updatedAt: input && input.updatedAt,
  });
  const result = await getPool().query(
    `INSERT INTO projects (id, name)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, name, created_at, updated_at`,
    [candidate.id, candidate.name]
  );
  if (result.rows.length === 0) {
    throw new Error(`Project already exists: ${candidate.id}`);
  }
  return toIdentity(result.rows[0]);
}

async function getProject(id) {
  const safeId = String(id || "").trim();
  if (!safeId) return null;
  const result = await getPool().query(
    `SELECT id, name, created_at, updated_at
     FROM projects
     WHERE id = $1
     LIMIT 1`,
    [safeId]
  );
  if (result.rows.length === 0) return null;
  return toIdentity(result.rows[0]);
}

async function projectExists(id) {
  const safeId = String(id || "").trim();
  if (!safeId) return false;
  const result = await getPool().query(
    `SELECT 1
     FROM projects
     WHERE id = $1
     LIMIT 1`,
    [safeId]
  );
  return result.rows.length > 0;
}

async function listProjects(options) {
  const search = (options && options.search) || "";
  const sort = (options && options.sort) || "id";
  const order = (options && options.order) || "asc";
  const limit = (options && options.limit) || 100;
  const offset = (options && options.offset) || 0;

  const params = [];
  let where = "1=1";
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (id ILIKE $${params.length} OR name ILIKE $${params.length})`;
  }

  const orderMap = {
    id: "id",
    name: "name",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };
  const sortColumn = orderMap[sort] || "id";
  const sortOrder = order === "desc" ? "DESC" : "ASC";

  const result = await getPool().query(
    `SELECT id, name, created_at, updated_at
     FROM projects
     WHERE ${where}
     ORDER BY ${sortColumn} ${sortOrder}
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name || row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function updateProject(id, updates) {
  const result = await getPool().query(
    `UPDATE projects
     SET name = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, name, created_at, updated_at`,
    [(updates && updates.name) || null, id]
  );
  if (result.rows.length === 0) {
    throw new Error(`Project not found: ${id}`);
  }
  return toIdentity(result.rows[0]);
}

async function deleteProject(id) {
  if (id === DEFAULT_PROJECT.id) {
    throw new Error("Cannot delete the default project");
  }
  const result = await getPool().query(
    `DELETE FROM projects WHERE id = $1 RETURNING id`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new Error(`Project not found: ${id}`);
  }
}

async function searchProjects(query) {
  const safeQuery = String(query || "").trim();
  if (!safeQuery) return listProjects();
  const result = await getPool().query(
    `SELECT id, name, created_at, updated_at
     FROM projects
     WHERE id ILIKE $1 OR name ILIKE $1
     ORDER BY id ASC`,
    [`%${safeQuery}%`]
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name || row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function seedDefaultProject() {
  await getPool().query(
    `INSERT INTO projects (id, name)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_PROJECT.id, DEFAULT_PROJECT.name]
  );
  const project = await getProject(DEFAULT_PROJECT.id);
  return project || createProjectIdentity(DEFAULT_PROJECT);
}

function getBackendName() {
  return "postgres";
}

async function ensureReady() {
  await checkConnection();
  await getPool().query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'projects'
       AND column_name IN ('id','name','created_at','updated_at')`
  );
  return true;
}

module.exports = {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  searchProjects,
  projectExists,
  seedDefaultProject,
  getBackendName,
  ensureReady,
};
