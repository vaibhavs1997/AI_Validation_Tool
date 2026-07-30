/**
 * RequirementService
 *
 * Service layer for Requirement CRUD operations.
 * No AI, no mapping, no test generation — pure CRUD.
 */

const repo = require('./RequirementRepository');
const { createRequirement, validateRequirementReadiness } = require('./Requirement');

class RequirementService {
  /**
   * Create a new requirement.
   * @param {string} projectId
   * @param {object} input
   * @returns {object}
   */
  async create(projectId, input) {
    if (!projectId) {
      throw new Error('Project ID is required.');
    }
    try {
      return repo.createRequirementForProject(projectId, input);
    } catch (error) {
      throw new Error(`Failed to create requirement: ${error.message}`);
    }
  }

  /**
   * Get a requirement by ID.
   * @param {string} projectId
   * @param {string} reqId
   * @returns {object|null}
   */
  async get(projectId, reqId) {
    if (!projectId || !reqId) {
      throw new Error('Project ID and Requirement ID are required.');
    }
    const req = repo.getRequirement(projectId, reqId);
    if (!req) {
      throw new Error(`Requirement not found: ${reqId}`);
    }
    return req;
  }

  /**
   * List requirements for a project.
   * @param {string} projectId
   * @param {object} options
   * @returns {object[]}
   */
  async list(projectId, options = {}) {
    if (!projectId) {
      throw new Error('Project ID is required.');
    }
    try {
      return repo.listRequirements(projectId, options);
    } catch (error) {
      throw new Error(`Failed to list requirements: ${error.message}`);
    }
  }

  /**
   * Update a requirement.
   * @param {string} projectId
   * @param {string} reqId
   * @param {object} updates
   * @returns {object}
   */
  async update(projectId, reqId, updates) {
    if (!projectId || !reqId) {
      throw new Error('Project ID and Requirement ID are required.');
    }
    if (!updates || Object.keys(updates).length === 0) {
      throw new Error('Updates object is required.');
    }
    try {
      return repo.updateRequirement(projectId, reqId, updates);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to update requirement: ${error.message}`);
    }
  }

  /**
   * Delete a requirement.
   * @param {string} projectId
   * @param {string} reqId
   */
  async delete(projectId, reqId) {
    if (!projectId || !reqId) {
      throw new Error('Project ID and Requirement ID are required.');
    }
    try {
      repo.deleteRequirement(projectId, reqId);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to delete requirement: ${error.message}`);
    }
  }

  /**
   * Get readiness validation for a requirement.
   * @param {string} projectId
   * @param {string} reqId
   * @returns {object}
   */
  async getReadiness(projectId, reqId) {
    const req = await this.get(projectId, reqId);
    return validateRequirementReadiness(req);
  }

  /**
   * Get summary stats for a project's requirements.
   * @param {string} projectId
   * @returns {{ total: number, ready: number, draft: number, needsReview: number, lastUpdated: string|null }}
   */
  async getStats(projectId) {
    const all = await this.list(projectId);
    const total = all.length;
    const ready = all.filter((r) => r.status === 'ready').length;
    const draft = all.filter((r) => r.status === 'draft').length;
    const needsReview = all.filter((r) => r.status === 'needs-review').length;

    let lastUpdated = null;
    if (all.length > 0) {
      const sorted = [...all].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      lastUpdated = sorted[0].updatedAt;
    }

    return { total, ready, draft, needsReview, lastUpdated };
  }
}

let serviceInstance = null;

function getRequirementService() {
  if (!serviceInstance) {
    serviceInstance = new RequirementService();
  }
  return serviceInstance;
}

function resetRequirementService() {
  serviceInstance = null;
}

module.exports = {
  RequirementService,
  getRequirementService,
  resetRequirementService,
};