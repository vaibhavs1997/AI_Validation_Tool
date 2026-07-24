const config = require("../config");
const fileRepository = require("./repositories/FileProjectRepository");
const postgresRepository = require("./repositories/PostgresProjectRepository");

function usePostgres() {
  return Boolean(
    (config.features && config.features.pgEnabled) ||
    (config.pg && config.pg.enabled)
  );
}

function selectedRepository() {
  return usePostgres() ? postgresRepository : fileRepository;
}

function createProject(input) {
  return selectedRepository().createProject(input);
}

function getProject(id) {
  return selectedRepository().getProject(id);
}

function listProjects() {
  return selectedRepository().listProjects();
}

function projectExists(id) {
  return selectedRepository().projectExists(id);
}

function seedDefaultProject() {
  return selectedRepository().seedDefaultProject();
}

function getBackendName() {
  return selectedRepository().getBackendName();
}

function ensureReady() {
  return selectedRepository().ensureReady();
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
