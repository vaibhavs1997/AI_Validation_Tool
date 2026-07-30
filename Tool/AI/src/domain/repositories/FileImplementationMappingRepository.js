/**
 * FileImplementationMappingRepository
 *
 * File-based persistence for ImplementationMapping domain objects.
 */

const fs = require("fs");
const path = require("path");
const config = require("../../config");
const { createImplementationMapping, VALID_STATUSES, VALID_EXECUTION_ORDERS } = require("../ImplementationMapping");

const MAPPINGS_DIR = path.join(config.dataDir, "implementation-mappings");

function ensureDir(projectId) {
  const dir = path.join(MAPPINGS_DIR, projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function safeName(value) {
  const str = String(value || "unnamed");
  const sanitized = str
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return sanitized || "unnamed";
}

function mappingFilePath(projectId, mappingId) {
  return path.join(MAPPINGS_DIR, safeName(projectId), `${safeName(mappingId)}.json`);
}

function createMappingForProject(projectId, input) {
  const mapping = createImplementationMapping({ ...input, projectId });
  const dir = ensureDir(projectId);
  const file = path.join(dir, `${safeName(mapping.id)}.json`);

  if (fs.existsSync(file)) {
    throw new Error(`ImplementationMapping already exists: ${mapping.id}`);
  }

  fs.writeFileSync(file, JSON.stringify(mapping, null, 2), "utf8");
  return mapping;
}

function getMapping(projectId, mappingId) {
  const file = mappingFilePath(projectId, mappingId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listMappings(projectId, options = {}) {
  const dir = ensureDir(projectId);

  let mappings = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));

  if (options.status && VALID_STATUSES.includes(options.status)) {
    mappings = mappings.filter((m) => m.status === options.status);
  }

  if (options.scenarioId) {
    mappings = mappings.filter((m) => m.scenarioId === options.scenarioId);
  }

  if (options.requirementId) {
    mappings = mappings.filter((m) => m.requirementId === options.requirementId);
  }

  if (options.search) {
    const query = options.search.toLowerCase();
    mappings = mappings.filter(
      (m) =>
        m.title.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query)
    );
  }

  const sortField = options.sort || "updatedAt";
  const order = options.order === "asc" ? 1 : -1;

  mappings.sort((a, b) => {
    const aVal = a[sortField] || "";
    const bVal = b[sortField] || "";
    if (aVal < bVal) return -1 * order;
    if (aVal > bVal) return 1 * order;
    return 0;
  });

  return mappings;
}

function updateMapping(projectId, mappingId, updates) {
  const file = mappingFilePath(projectId, mappingId);
  if (!fs.existsSync(file)) {
    throw new Error(`ImplementationMapping not found: ${mappingId}`);
  }

  const existing = JSON.parse(fs.readFileSync(file, "utf8"));

  const merged = {
    ...existing,
    ...updates,
    id: existing.id,
    projectId: existing.projectId,
    scenarioId: existing.scenarioId,
    requirementId: existing.requirementId,
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  };

  const validated = createImplementationMapping(merged);
  fs.writeFileSync(file, JSON.stringify(validated, null, 2), "utf8");
  return validated;
}

function deleteMapping(projectId, mappingId) {
  const file = mappingFilePath(projectId, mappingId);
  if (!fs.existsSync(file)) {
    throw new Error(`ImplementationMapping not found: ${mappingId}`);
  }
  fs.unlinkSync(file);
}

function getBackendName() {
  return "file";
}

async function ensureReady() {
  return true;
}

module.exports = {
  createMappingForProject,
  getMapping,
  listMappings,
  updateMapping,
  deleteMapping,
  getBackendName,
  ensureReady,
};