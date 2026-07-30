/**
 * ValidationScenarioService
 *
 * Service layer for ValidationScenario CRUD operations.
 * No AI, no mapping, no test generation — pure CRUD.
 */

const repo = require("./ValidationScenarioRepository");
const { createValidationScenario, validateScenarioReadiness } = require("./ValidationScenario");

class ValidationScenarioService {
  /**
   * Create a new validation scenario.
   * @param {string} projectId
   * @param {object} input
   * @returns {object}
   */
  async create(projectId, input) {
    if (!projectId) {
      throw new Error("Project ID is required.");
    }
    try {
      return repo.createValidationScenarioForProject(projectId, input);
    } catch (error) {
      throw new Error(`Failed to create validation scenario: ${error.message}`);
    }
  }

  /**
   * Get a validation scenario by ID.
   * @param {string} projectId
   * @param {string} scenarioId
   * @returns {object|null}
   */
  async get(projectId, scenarioId) {
    if (!projectId || !scenarioId) {
      throw new Error("Project ID and Scenario ID are required.");
    }
    const scenario = repo.getValidationScenario(projectId, scenarioId);
    if (!scenario) {
      throw new Error(`ValidationScenario not found: ${scenarioId}`);
    }
    return scenario;
  }

  /**
   * List validation scenarios for a project.
   * @param {string} projectId
   * @param {object} options
   * @returns {object[]}
   */
  async list(projectId, options = {}) {
    if (!projectId) {
      throw new Error("Project ID is required.");
    }
    try {
      return repo.listValidationScenarios(projectId, options);
    } catch (error) {
      throw new Error(`Failed to list validation scenarios: ${error.message}`);
    }
  }

  /**
   * Update a validation scenario.
   * @param {string} projectId
   * @param {string} scenarioId
   * @param {object} updates
   * @returns {object}
   */
  async update(projectId, scenarioId, updates) {
    if (!projectId || !scenarioId) {
      throw new Error("Project ID and Scenario ID are required.");
    }
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error("Updates object is required.");
    }
    try {
      return repo.updateValidationScenario(projectId, scenarioId, updates);
    } catch (error) {
      if (error.message.includes("not found")) {
        throw error;
      }
      throw new Error(`Failed to update validation scenario: ${error.message}`);
    }
  }

  /**
   * Delete a validation scenario.
   * @param {string} projectId
   * @param {string} scenarioId
   */
  async delete(projectId, scenarioId) {
    if (!projectId || !scenarioId) {
      throw new Error("Project ID and Scenario ID are required.");
    }
    try {
      repo.deleteValidationScenario(projectId, scenarioId);
    } catch (error) {
      if (error.message.includes("not found")) {
        throw error;
      }
      throw new Error(`Failed to delete validation scenario: ${error.message}`);
    }
  }

  /**
   * Get readiness validation for a scenario.
   * @param {string} projectId
   * @param {string} scenarioId
   * @returns {object}
   */
  async getReadiness(projectId, scenarioId) {
    const scenario = await this.get(projectId, scenarioId);
    return validateScenarioReadiness(scenario);
  }

  /**
   * Get summary stats for a project's validation scenarios.
   * @param {string} projectId
   * @returns {{ total: number, ready: number, draft: number, needsReview: number, approved: number, rejected: number, lastUpdated: string|null }}
   */
  async getStats(projectId) {
    const all = await this.list(projectId);
    const total = all.length;
    const ready = all.filter((s) => s.status === "ready").length;
    const draft = all.filter((s) => s.status === "draft").length;
    const needsReview = all.filter((s) => s.status === "needs-review").length;
    const approved = all.filter((s) => s.status === "approved").length;
    const rejected = all.filter((s) => s.status === "rejected").length;

    let lastUpdated = null;
    if (all.length > 0) {
      const sorted = [...all].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      lastUpdated = sorted[0].updatedAt;
    }

    return { total, ready, draft, needsReview, approved, rejected, lastUpdated };
  }

  /**
   * Bulk approve scenarios.
   * @param {string} projectId
   * @param {string[]} scenarioIds
   * @returns {object[]} updated scenarios
   */
  async bulkApprove(projectId, scenarioIds) {
    if (!projectId || !Array.isArray(scenarioIds) || scenarioIds.length === 0) {
      throw new Error("Project ID and scenario IDs array are required.");
    }
    const results = [];
    for (const scenarioId of scenarioIds) {
      try {
        const updated = await this.update(projectId, scenarioId, { status: "approved" });
        results.push(updated);
      } catch (error) {
        // Skip individual failures
      }
    }
    return results;
  }

  /**
   * Bulk reject scenarios.
   * @param {string} projectId
   * @param {string[]} scenarioIds
   * @returns {object[]} updated scenarios
   */
  async bulkReject(projectId, scenarioIds) {
    if (!projectId || !Array.isArray(scenarioIds) || scenarioIds.length === 0) {
      throw new Error("Project ID and scenario IDs array are required.");
    }
    const results = [];
    for (const scenarioId of scenarioIds) {
      try {
        const updated = await this.update(projectId, scenarioId, { status: "rejected" });
        results.push(updated);
      } catch (error) {
        // Skip individual failures
      }
    }
    return results;
  }
}

let serviceInstance = null;

function getValidationScenarioService() {
  if (!serviceInstance) {
    serviceInstance = new ValidationScenarioService();
  }
  return serviceInstance;
}

function resetValidationScenarioService() {
  serviceInstance = null;
}

module.exports = {
  ValidationScenarioService,
  getValidationScenarioService,
  resetValidationScenarioService,
};