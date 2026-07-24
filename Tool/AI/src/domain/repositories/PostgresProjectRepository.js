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

async function listProjects() {
  const result = await getPool().query(
    `SELECT id, name, created_at, updated_at
     FROM projects
     ORDER BY id ASC`
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name || row.id,
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
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
  projectExists,
  seedDefaultProject,
  getBackendName,
  ensureReady,
};
