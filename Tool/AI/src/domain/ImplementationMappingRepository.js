/**
 * ImplementationMappingRepository
 *
 * Repository selector for ImplementationMapping domain objects.
 */

const fileRepo = require("./repositories/FileImplementationMappingRepository");

function getRepository() {
  return fileRepo;
}

function createMappingForProject(projectId, input) {
  return getRepository().createMappingForProject(projectId, input);
}

function getMapping(projectId, mappingId) {
  return getRepository().getMapping(projectId, mappingId);
}

function listMappings(projectId, options) {
  return getRepository().listMappings(projectId, options);
}

function updateMapping(projectId, mappingId, updates) {
  return getRepository().updateMapping(projectId, mappingId, updates);
}

function deleteMapping(projectId, mappingId) {
  return getRepository().deleteMapping(projectId, mappingId);
}

function getRepositoryMode() {
  return getRepository().getBackendName();
}

function ensureReady() {
  return getRepository().ensureReady();
}

module.exports = {
  createMappingForProject,
  getMapping,
  listMappings,
  updateMapping,
  deleteMapping,
  getRepositoryMode,
  ensureReady,
};