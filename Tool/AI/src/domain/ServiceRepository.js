const config = require("../config");
const fileRepo = require("./repositories/FileServiceRepository");
const pgRepo = require("./repositories/PostgresServiceRepository");

function usePostgres() {
  return Boolean(config.features && config.features.pgEnabled);
}

function getRepository() {
  return usePostgres() ? pgRepo : fileRepo;
}

function createService(projectId, input) {
  return getRepository().createService(projectId, input);
}

function getService(projectId, serviceId) {
  return getRepository().getService(projectId, serviceId);
}

function listServices(projectId) {
  return getRepository().listServices(projectId);
}

function saveApiModel(projectId, serviceId, input) {
  return getRepository().saveApiModel(projectId, serviceId, input);
}

function getApiModel(projectId, serviceId) {
  return getRepository().getApiModel(projectId, serviceId);
}

function listApiModels(projectId) {
  return getRepository().listApiModels(projectId);
}

function serviceExists(projectId, serviceId) {
  return getRepository().serviceExists(projectId, serviceId);
}

function registerServiceWithApiModel(projectId, serviceInput, apiModelInput) {
  return getRepository().registerServiceWithApiModel(projectId, serviceInput, apiModelInput);
}

function validateProjectId(projectId) {
  return getRepository().validateProjectId(projectId);
}

function getRepositoryMode() {
  return getRepository().getBackendName();
}

function ensureReady() {
  return getRepository().ensureReady();
}

module.exports = {
  createService,
  getService,
  listServices,
  saveApiModel,
  getApiModel,
  listApiModels,
  serviceExists,
  registerServiceWithApiModel,
  validateProjectId,
  getRepositoryMode,
  ensureReady,
};
