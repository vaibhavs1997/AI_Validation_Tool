const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../../config");
const { DEFAULT_PROJECT, createProjectIdentity } = require("../ProjectIdentity");

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
    const hash = crypto.createHash("sha256").update(str).digest("hex").slice(0, 6);
    return `${sanitized}-${hash}`;
  }
  return sanitized || crypto.randomUUID().slice(0, 12);
}

function projectFile(id) {
  return path.join(PROJECTS_DIR, `${safeName(id)}.json`);
}

function createProject(input) {
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
}

function getProject(id) {
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
}

function projectExists(id) {
  ensureStorage();
  return fs.existsSync(projectFile(id));
}

function listProjects() {
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
}

function seedDefaultProject() {
  ensureStorage();
  if (fs.existsSync(projectFile(DEFAULT_PROJECT.id))) {
    return getProject(DEFAULT_PROJECT.id);
  }

  const identity = createProjectIdentity({
    id: DEFAULT_PROJECT.id,
    name: DEFAULT_PROJECT.name,
    createdAt: DEFAULT_PROJECT.createdAt,
    updatedAt: DEFAULT_PROJECT.updatedAt,
  });

  fs.writeFileSync(projectFile(identity.id), JSON.stringify(identity, null, 2), "utf8");
  return identity;
}

function getBackendName() {
  return "file";
}

async function ensureReady() {
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
