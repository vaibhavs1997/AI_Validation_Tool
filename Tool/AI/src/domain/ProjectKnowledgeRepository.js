const config = require("../config");
const fileRepo = require("./repositories/FileProjectKnowledgeRepository");
const pgRepo = require("./repositories/PostgresProjectKnowledgeRepository");

function usePostgres() {
  return Boolean(config.features && config.features.pgEnabled);
}

function getRepository() {
  return usePostgres() ? pgRepo : fileRepo;
}

function getProjectKnowledge(projectId) {
  return getRepository().getProjectKnowledge(projectId);
}

function saveProjectKnowledge(projectId, instructions, relationships) {
  return getRepository().saveProjectKnowledge(projectId, instructions, relationships);
}

function projectKnowledgeExists(projectId) {
  return getRepository().projectKnowledgeExists(projectId);
}

function getRepositoryMode() {
  return getRepository().getBackendName();
}

function ensureReady() {
  return getRepository().ensureReady();
}

module.exports = {
  getProjectKnowledge,
  saveProjectKnowledge,
  projectKnowledgeExists,
  getRepositoryMode,
  ensureReady,
};
