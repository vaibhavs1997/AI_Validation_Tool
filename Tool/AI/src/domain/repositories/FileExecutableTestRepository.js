/**
 * FileExecutableTestRepository
 *
 * File-based persistence for ExecutableTest domain objects.
 */

const fs = require("fs");
const path = require("path");
const config = require("../../config");
const { createExecutableTest, VALID_STATUSES, VALID_PRIORITIES } = require("../ExecutableTest");

const TESTS_DIR = path.join(config.dataDir, "executable-tests");

function ensureDir(projectId) {
  const dir = path.join(TESTS_DIR, projectId);
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

function testFilePath(projectId, testId) {
  return path.join(TESTS_DIR, safeName(projectId), `${safeName(testId)}.json`);
}

function createTestForProject(projectId, input) {
  const test = createExecutableTest({ ...input, projectId });
  const dir = ensureDir(projectId);
  const file = path.join(dir, `${safeName(test.id)}.json`);

  if (fs.existsSync(file)) {
    throw new Error(`ExecutableTest already exists: ${test.id}`);
  }

  fs.writeFileSync(file, JSON.stringify(test, null, 2), "utf8");
  return test;
}

function getTest(projectId, testId) {
  const file = testFilePath(projectId, testId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listTests(projectId, options = {}) {
  const dir = ensureDir(projectId);

  let tests = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));

  if (options.status && VALID_STATUSES.includes(options.status)) {
    tests = tests.filter((t) => t.status === options.status);
  }

  if (options.mappingId) {
    tests = tests.filter((t) => t.mappingId === options.mappingId);
  }

  if (options.scenarioId) {
    tests = tests.filter((t) => t.scenarioId === options.scenarioId);
  }

  if (options.requirementId) {
    tests = tests.filter((t) => t.requirementId === options.requirementId);
  }

  if (options.search) {
    const query = options.search.toLowerCase();
    tests = tests.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
    );
  }

  const sortField = options.sort || "updatedAt";
  const order = options.order === "asc" ? 1 : -1;

  tests.sort((a, b) => {
    const aVal = a[sortField] || "";
    const bVal = b[sortField] || "";
    if (aVal < bVal) return -1 * order;
    if (aVal > bVal) return 1 * order;
    return 0;
  });

  return tests;
}

function updateTest(projectId, testId, updates) {
  const file = testFilePath(projectId, testId);
  if (!fs.existsSync(file)) {
    throw new Error(`ExecutableTest not found: ${testId}`);
  }

  const existing = JSON.parse(fs.readFileSync(file, "utf8"));

  const merged = {
    ...existing,
    ...updates,
    id: existing.id,
    projectId: existing.projectId,
    mappingId: existing.mappingId,
    scenarioId: existing.scenarioId,
    requirementId: existing.requirementId,
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  };

  const validated = createExecutableTest(merged);
  fs.writeFileSync(file, JSON.stringify(validated, null, 2), "utf8");
  return validated;
}

function deleteTest(projectId, testId) {
  const file = testFilePath(projectId, testId);
  if (!fs.existsSync(file)) {
    throw new Error(`ExecutableTest not found: ${testId}`);
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
  createTestForProject,
  getTest,
  listTests,
  updateTest,
  deleteTest,
  getBackendName,
  ensureReady,
};