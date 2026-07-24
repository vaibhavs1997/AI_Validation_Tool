/**
 * ProjectRepository — Centralized Repository Selection
 *
 * STEP 7.3B — Selects between file-based and PostgreSQL implementations
 * based on PG_ENABLED configuration.
 *
 * PG_ENABLED=false → FileProjectRepository (existing behavior)
 * PG_ENABLED=true  → PostgresProjectRepository
 *
 * Existing callers continue using the same import path and API.
 * No PG_ENABLED conditionals scattered across server/domain code.
 */

const config = require("../config");
const { DEFAULT_PROJECT, createProjectIdentity, getDefaultProjectIdentity } = require("./ProjectIdentity");

// ============================================================
// File-based implementation (existing, unchanged behavior)
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PROJECTS_DIR = path.join(config.dataDir, "projects");

function ensureStorage() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

function safeName(value) {
  const str = String(value || crypto.randomUUID());
  const hasSpecial = /[^a-zA-Z0-9._-]/.test(str);
  const sanitized = str
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  if (hasSpecial && !str.startsWith(sanitized)) {
    const hash = crypto.createHash("md5").update(str).digest("hex").slice(0, 6);
    return `${sanitized}-${hash}`;
  }
  return sanitized || crypto.randomUUID().slice(0, 12);
}

function projectFile(id) {
  return path.join(PROJECTS_DIR, `${safeName(id)}.json`);
}

const fileRepo = {
  createProject(input) {
    ensureStorage();
    const identity = createProjectIdentity({
      id: input.id,
      name: input.name,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    });

    const file = projectFile(identity.id);
    if (fs.existsSync(file)) {
      throw new Error(`Project already exists: ${identity.id}`);
    }

    fs.writeFileSync(file, JSON.stringify(identity, null, 2), "utf8");
    return identity;
  },

  getProject(id) {
    ensureStorage();
    const file = projectFile(id);
    if (!fs.existsSync(file)) return null;

    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return createProjectIdentity({
      id: data.id,
      name: data.name,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  },

  projectExists(id) {
    ensureStorage();
    return fs.existsSync(projectFile(id));
  },

  listProjects() {
    ensureStorage();
    if (!fs.existsSync(PROJECTS_DIR)) return [];

    return fs
      .readdirSync(PROJECTS_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        const fullPath = path.join(PROJECTS_DIR, file);
        const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        return {
          id: data.id,
          name: data.name,
          updatedAt: data.updatedAt,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  },

  seedDefaultProject() {
    ensureStorage();
    if (fs.existsSync(projectFile(DEFAULT_PROJECT.id))) {
      return this.getProject(DEFAULT_PROJECT.id);
    }

    const identity = createProjectIdentity({
      id: DEFAULT_PROJECT.id,
      name: DEFAULT_PROJECT.name,
      createdAt: DEFAULT_PROJECT.createdAt,
      updatedAt: DEFAULT_PROJECT.updatedAt,
    });

    fs.writeFileSync(projectFile(identity.id), JSON.stringify(identity, null, 2), "utf8");
    return identity;
  },
};

// ============================================================
// PostgreSQL implementation (delegates to ProjectRepositoryPostgres)
// ============================================================

let postgresRepo = null;

function getPostgresRepo() {
  if (!postgresRepo) {
    postgresRepo = require("../repositories/ProjectRepositoryPostgres");
  }
  return postgresRepo;
}

// ============================================================
// Active repository selection
// ============================================================

const activeRepo = config.pg.enabled ? getPostgresRepo() : fileRepo;

/**
 * Create a new persisted project identity.
 * @param {{ id: string, name: string, createdAt?: Date | string | number, updatedAt?: Date | string | number }} input
 * @returns {{ id: string, name: string, createdAt: Date, updatedAt: Date, toString(): string }}
 */
function createProject(input) {
  return activeRepo.createProject(input);
}

/**
 * Get a persisted project identity by ID.
 * @param {string} id
 * @returns {{ id: string, name: string, createdAt: Date, updatedAt: Date, toString(): string } | null}
 */
function getProject(id) {
  return activeRepo.getProject(id);
}

/**
 * Check whether a project exists.
 * @param {string} id
 * @returns {boolean}
 */
function projectExists(id) {
  return activeRepo.projectExists(id);
}

/**
 * List persisted projects.
 * @returns {{ id: string, name: string, updatedAt: string }[]}
 */
function listProjects() {
  return activeRepo.listProjects();
}

/**
 * Seed the default project if it does not already exist.
 * @returns {{ id: string, name: string, createdAt: Date, updatedAt: Date, toString(): string }}
 */
function seedDefaultProject() {
  return activeRepo.seedDefaultProject();
}

module.exports = {
  createProject,
  getProject,
  listProjects,
  projectExists,
  seedDefaultProject,
};