/**
 * FileValidationScenarioRepository
 *
 * File-based persistence for ValidationScenario domain objects.
 * Stores scenarios as JSON files scoped per project.
 */

const fs = require("fs");
const path = require("path");
const config = require("../../config");
const { createValidationScenario, VALID_STATUSES, VALID_PRIORITIES } = require("../ValidationScenario");

const SCENARIOS_DIR = path.join(config.dataDir, "validation-scenarios");

function ensureDir(projectId) {
  const dir = path.join(SCENARIOS_DIR, projectId);
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

function scenarioFilePath(projectId, scenarioId) {
  return path.join(SCENARIOS_DIR, safeName(projectId), `${safeName(scenarioId)}.json`);
}

function createValidationScenarioForProject(projectId, input) {
  const scenario = createValidationScenario({ ...input, projectId });
  const dir = ensureDir(projectId);
  const file = path.join(dir, `${safeName(scenario.id)}.json`);

  if (fs.existsSync(file)) {
    throw new Error(`ValidationScenario already exists: ${scenario.id}`);
  }

  fs.writeFileSync(file, JSON.stringify(scenario, null, 2), "utf8");
  return scenario;
}

function getValidationScenario(projectId, scenarioId) {
  const file = scenarioFilePath(projectId, scenarioId);
  if (!fs.existsSync(file)) return null;

  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return data;
}

function listValidationScenarios(projectId, options = {}) {
  const dir = ensureDir(projectId);

  let scenarios = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(dir, file);
      const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      return data;
    });

  if (options.status && VALID_STATUSES.includes(options.status)) {
    scenarios = scenarios.filter((s) => s.status === options.status);
  }

  if (options.requirementId) {
    scenarios = scenarios.filter((s) => s.requirementId === options.requirementId);
  }

  if (options.search) {
    const query = options.search.toLowerCase();
    scenarios = scenarios.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query)
    );
  }

  const sortField = options.sort || "updatedAt";
  const order = options.order === "asc" ? 1 : -1;

  scenarios.sort((a, b) => {
    const aVal = a[sortField] || "";
    const bVal = b[sortField] || "";
    if (aVal < bVal) return -1 * order;
    if (aVal > bVal) return 1 * order;
    return 0;
  });

  return scenarios;
}

function updateValidationScenario(projectId, scenarioId, updates) {
  const file = scenarioFilePath(projectId, scenarioId);
  if (!fs.existsSync(file)) {
    throw new Error(`ValidationScenario not found: ${scenarioId}`);
  }

  const existing = JSON.parse(fs.readFileSync(file, "utf8"));

  const merged = {
    ...existing,
    ...updates,
    id: existing.id,
    projectId: existing.projectId,
    requirementId: existing.requirementId,
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  };

  const validated = createValidationScenario(merged);
  fs.writeFileSync(file, JSON.stringify(validated, null, 2), "utf8");
  return validated;
}

function deleteValidationScenario(projectId, scenarioId) {
  const file = scenarioFilePath(projectId, scenarioId);
  if (!fs.existsSync(file)) {
    throw new Error(`ValidationScenario not found: ${scenarioId}`);
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
  createValidationScenarioForProject,
  getValidationScenario,
  listValidationScenarios,
  updateValidationScenario,
  deleteValidationScenario,
  getBackendName,
  ensureReady,
};