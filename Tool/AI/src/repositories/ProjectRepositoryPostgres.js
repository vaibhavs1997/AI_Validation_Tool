/**
 * PostgreSQL ProjectRepository
 *
 * STEP 7.3B — PostgreSQL-backed implementation of the ProjectRepository interface.
 *
 * Preserves exact same public API as the file-based ProjectRepository:
 *   createProject(input)
 *   getProject(id)
 *   listProjects()
 *   projectExists(id)
 *   seedDefaultProject()
 *
 * All methods are async (return Promises) to match pg query pattern.
 * The file-based repo is sync — callers must handle both.
 */

const { DEFAULT_PROJECT, createProjectIdentity } = require('../domain/ProjectIdentity');

// Test override — allows injecting a mock pool without require.cache manipulation
let _poolOverride = null;

// Lazy require pool — allows test mocking via require.cache injection
function getPool() {
  if (_poolOverride) return _poolOverride;
  return require('../db/pool');
}

/**
 * Test helper: inject a mock pool module.
 * @param {object|null} mockPool
 */
function _setPoolOverride(mockPool) {
  _poolOverride = mockPool;
}

/**
 * Normalize a raw DB row into a ProjectIdentity shape.
 */
function rowToIdentity(row) {
  return createProjectIdentity({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/**
 * Normalize a raw DB row into a list-project shape.
 */
function rowToListShape(row) {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

/**
 * Create a new persisted project identity.
 * @param {{ id: string, name: string, createdAt?: Date | string | number, updatedAt?: Date | string | number }} input
 * @returns {Promise<{ id: string, name: string, createdAt: Date, updatedAt: Date, toString(): string }>}
 */
async function createProject(input) {
  const identity = createProjectIdentity({
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });

  try {
    const { rows } = await getPool().query(
      `INSERT INTO projects (id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, created_at, updated_at`,
      [identity.id, identity.name, identity.createdAt, identity.updatedAt]
    );
    return rowToIdentity(rows[0]);
  } catch (err) {
    // PostgreSQL unique violation code
    if (err.code === '23505') {
      throw new Error(`Project already exists: ${identity.id}`);
    }
    throw err;
  }
}

/**
 * Get a persisted project identity by ID.
 * @param {string} id
 * @returns {Promise<{ id: string, name: string, createdAt: Date, updatedAt: Date, toString(): string } | null>}
 */
async function getProject(id) {
  const { rows } = await getPool().query(
    'SELECT id, name, created_at, updated_at FROM projects WHERE id = $1',
    [id]
  );
  if (rows.length === 0) return null;
  return rowToIdentity(rows[0]);
}

/**
 * Check whether a project exists.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function projectExists(id) {
  const { rows } = await getPool().query(
    'SELECT 1 FROM projects WHERE id = $1',
    [id]
  );
  return rows.length > 0;
}

/**
 * List persisted projects.
 * @returns {Promise<{ id: string, name: string, updatedAt: string }[]>}
 */
async function listProjects() {
  const { rows } = await getPool().query(
    'SELECT id, name, updated_at FROM projects ORDER BY id ASC'
  );
  return rows.map(rowToListShape);
}

/**
 * Seed the default project if it does not already exist.
 * @returns {Promise<{ id: string, name: string, createdAt: Date, updatedAt: Date, toString(): string }>}
 */
async function seedDefaultProject() {
  const exists = await projectExists(DEFAULT_PROJECT.id);
  if (exists) {
    return getProject(DEFAULT_PROJECT.id);
  }

  const identity = createProjectIdentity({
    id: DEFAULT_PROJECT.id,
    name: DEFAULT_PROJECT.name,
    createdAt: DEFAULT_PROJECT.createdAt,
    updatedAt: DEFAULT_PROJECT.updatedAt,
  });

  try {
    const { rows } = await getPool().query(
      `INSERT INTO projects (id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, created_at, updated_at`,
      [identity.id, identity.name, identity.createdAt, identity.updatedAt]
    );
    return rowToIdentity(rows[0]);
  } catch (err) {
    // Handle race condition where default was created between check and insert
    if (err.code === '23505') {
      return getProject(DEFAULT_PROJECT.id);
    }
    throw err;
  }
}

module.exports = {
  createProject,
  getProject,
  listProjects,
  projectExists,
  seedDefaultProject,
  _setPoolOverride,
};
