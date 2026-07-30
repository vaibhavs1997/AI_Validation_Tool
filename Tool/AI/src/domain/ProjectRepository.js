const fileRepository = require("./repositories/FileProjectRepository");
const postgresRepository = require("./repositories/PostgresProjectRepository");

function selectedRepository() {
  try {
    const config = require("../config");
    const usePg = Boolean((config.features && config.features.pgEnabled) || (config.pg && config.pg.enabled));
    return usePg ? postgresRepository : fileRepository;
  } catch {
    return fileRepository;
  }
}

function createProject(input) {
  return selectedRepository().createProject(input);
}

function getProject(id) {
  return selectedRepository().getProject(id);
}

function listProjects(options) {
  return selectedRepository().listProjects(options);
}

function updateProject(id, updates) {
  return selectedRepository().updateProject(id, updates);
}

function deleteProject(id) {
  return selectedRepository().deleteProject(id);
}

function searchProjects(query) {
  return selectedRepository().searchProjects(query);
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
  updateProject,
  deleteProject,
  searchProjects,
  projectExists,
  seedDefaultProject,
  getBackendName,
  ensureReady,
};
