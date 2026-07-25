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

function listProjects(options) {
  ensureStorage();
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  let projects = fs
    .readdirSync(PROJECTS_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(PROJECTS_DIR, file);
      const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      return {
        id: data.id,
        name: data.name,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

  const search = (options && options.search) || "";
  const sort = (options && options.sort) || "id";
  const order = (options && options.order) || "asc";
  const limit = (options && options.limit) || 100;
  const offset = (options && options.offset) || 0;

  if (search) {
    const query = search.toLowerCase();
    projects = projects.filter(
      (p) =>
        String(p.id).toLowerCase().includes(query) ||
        String(p.name).toLowerCase().includes(query)
    );
  }

  projects = projects.slice(offset, offset + limit);

  if (sort) {
    const sorted = [...projects].sort((a, b) => {
      let aVal = a[sort] || a.id;
      let bVal = b[sort] || b.id;
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return order === "asc" ? -1 : 1;
      if (aVal > bVal) return order === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  return projects;
}

function updateProject(id, updates) {
  ensureStorage();
  const file = projectFile(id);
  if (!fs.existsSync(file)) {
    throw new Error(`Project not found: ${id}`);
  }

  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const updated = createProjectIdentity({
    id: data.id,
    name: (updates && updates.name) || data.name,
    createdAt: data.createdAt,
    updatedAt: new Date().toISOString(),
  });

  fs.writeFileSync(file, JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

function deleteProject(id) {
  ensureStorage();
  if (id === DEFAULT_PROJECT.id) {
    throw new Error("Cannot delete the default project");
  }
  const file = projectFile(id);
  if (!fs.existsSync(file)) {
    throw new Error(`Project not found: ${id}`);
  }
  fs.unlinkSync(file);
}

function searchProjects(query) {
  ensureStorage();
  const projects = listProjects();
  const lowerQuery = String(query || "").toLowerCase();
  if (!lowerQuery) return projects;

  return projects.filter((p) => {
    const idMatch = String(p.id).toLowerCase().includes(lowerQuery);
    const nameMatch = String(p.name).toLowerCase().includes(lowerQuery);
    return idMatch || nameMatch;
  });
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
  updateProject,
  deleteProject,
  searchProjects,
  projectExists,
  seedDefaultProject,
  getBackendName,
  ensureReady,
};
