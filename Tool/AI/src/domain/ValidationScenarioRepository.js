/**
 * ValidationScenarioRepository
 *
 * Repository selector for ValidationScenario domain objects.
 * Follows the same pattern as RequirementRepository.
 */

const fileRepo = require("./repositories/FileValidationScenarioRepository");

function getRepository() {
  return fileRepo;
}

function createValidationScenarioForProject(projectId, input) {
  return getRepository().createValidationScenarioForProject(projectId, input);
}

function getValidationScenario(projectId, scenarioId) {
  return getRepository().getValidationScenario(projectId, scenarioId);
}

function listValidationScenarios(projectId, options) {
  return getRepository().listValidationScenarios(projectId, options);
}

function updateValidationScenario(projectId, scenarioId, updates) {
  return getRepository().updateValidationScenario(projectId, scenarioId, updates);
}

function deleteValidationScenario(projectId, scenarioId) {
  return getRepository().deleteValidationScenario(projectId, scenarioId);
}

function getRepositoryMode() {
  return getRepository().getBackendName();
}

function ensureReady() {
  return getRepository().ensureReady();
}

module.exports = {
  createValidationScenarioForProject,
  getValidationScenario,
  listValidationScenarios,
  updateValidationScenario,
  deleteValidationScenario,
  getRepositoryMode,
  ensureReady,
};