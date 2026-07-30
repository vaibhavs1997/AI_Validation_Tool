/**
 * ExecutionRunRepository
 *
 * Repository selector for ExecutionRun domain objects.
 */

const fileRepo = require("./repositories/FileExecutionRunRepository");

function getRepository() {
  return fileRepo;
}

function saveRun(projectId, runData) {
  return getRepository().saveRun(projectId, runData);
}

function getRun(projectId, runId) {
  return getRepository().getRun(projectId, runId);
}

function listRuns(projectId) {
  return getRepository().listRuns(projectId);
}

function updateRun(projectId, runId, updates) {
  return getRepository().updateRun(projectId, runId, updates);
}

function deleteRun(projectId, runId) {
  return getRepository().deleteRun(projectId, runId);
}

function getRepositoryMode() {
  return getRepository().getBackendName();
}

function ensureReady() {
  return getRepository().ensureReady();
}

module.exports = {
  saveRun,
  getRun,
  listRuns,
  updateRun,
  deleteRun,
  getRepositoryMode,
  ensureReady,
};
