/**
 * ExecutableTestRepository
 *
 * Repository selector for ExecutableTest domain objects.
 */

const fileRepo = require("./repositories/FileExecutableTestRepository");

function getRepository() {
  return fileRepo;
}

function createTestForProject(projectId, input) {
  return getRepository().createTestForProject(projectId, input);
}

function getTest(projectId, testId) {
  return getRepository().getTest(projectId, testId);
}

function listTests(projectId, options) {
  return getRepository().listTests(projectId, options);
}

function updateTest(projectId, testId, updates) {
  return getRepository().updateTest(projectId, testId, updates);
}

function deleteTest(projectId, testId) {
  return getRepository().deleteTest(projectId, testId);
}

function getRepositoryMode() {
  return getRepository().getBackendName();
}

function ensureReady() {
  return getRepository().ensureReady();
}

module.exports = {
  createTestForProject,
  getTest,
  listTests,
  updateTest,
  deleteTest,
  getRepositoryMode,
  ensureReady,
};