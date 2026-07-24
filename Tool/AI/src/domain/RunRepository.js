const config = require("../config");
const fileRepo = require("./repositories/FileRunRepository");
const pgRepo = require("./repositories/PostgresRunRepository");

function usePostgres() {
  return Boolean(config.features && config.features.pgEnabled);
}

function getRepository() {
  return usePostgres() ? pgRepo : fileRepo;
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
  deleteRun,
  getRepositoryMode,
  ensureReady,
};
