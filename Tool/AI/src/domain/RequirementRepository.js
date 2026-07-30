/**
 * RequirementRepository
 *
 * Repository selector for Requirement domain objects.
 * Follows the same pattern as ProjectRepository and ServiceRepository.
 */

const fileRepo = require('./repositories/FileRequirementRepository');

function getRepository() {
  return fileRepo;
}

function createRequirementForProject(projectId, input) {
  return getRepository().createRequirementForProject(projectId, input);
}

function getRequirement(projectId, reqId) {
  return getRepository().getRequirement(projectId, reqId);
}

function listRequirements(projectId, options) {
  return getRepository().listRequirements(projectId, options);
}

function updateRequirement(projectId, reqId, updates) {
  return getRepository().updateRequirement(projectId, reqId, updates);
}

function deleteRequirement(projectId, reqId) {
  return getRepository().deleteRequirement(projectId, reqId);
}

function getRepositoryMode() {
  return getRepository().getBackendName();
}

function ensureReady() {
  return getRepository().ensureReady();
}

module.exports = {
  createRequirementForProject,
  getRequirement,
  listRequirements,
  updateRequirement,
  deleteRequirement,
  getRepositoryMode,
  ensureReady,
};