/**
 * ImplementationMappingService
 *
 * Service layer for ImplementationMapping CRUD operations.
 */

const repo = require("./ImplementationMappingRepository");
const { createImplementationMapping, validateMappingReadiness } = require("./ImplementationMapping");

class ImplementationMappingService {
  async create(projectId, input) {
    if (!projectId) throw new Error("Project ID is required.");
    try {
      return repo.createMappingForProject(projectId, input);
    } catch (error) {
      throw new Error(`Failed to create implementation mapping: ${error.message}`);
    }
  }

  async get(projectId, mappingId) {
    if (!projectId || !mappingId) throw new Error("Project ID and Mapping ID are required.");
    const mapping = repo.getMapping(projectId, mappingId);
    if (!mapping) throw new Error(`ImplementationMapping not found: ${mappingId}`);
    return mapping;
  }

  async list(projectId, options = {}) {
    if (!projectId) throw new Error("Project ID is required.");
    try {
      return repo.listMappings(projectId, options);
    } catch (error) {
      throw new Error(`Failed to list implementation mappings: ${error.message}`);
    }
  }

  async update(projectId, mappingId, updates) {
    if (!projectId || !mappingId) throw new Error("Project ID and Mapping ID are required.");
    if (!updates || Object.keys(updates).length === 0) throw new Error("Updates object is required.");
    try {
      return repo.updateMapping(projectId, mappingId, updates);
    } catch (error) {
      if (error.message.includes("not found")) throw error;
      throw new Error(`Failed to update implementation mapping: ${error.message}`);
    }
  }

  async delete(projectId, mappingId) {
    if (!projectId || !mappingId) throw new Error("Project ID and Mapping ID are required.");
    try {
      repo.deleteMapping(projectId, mappingId);
    } catch (error) {
      if (error.message.includes("not found")) throw error;
      throw new Error(`Failed to delete implementation mapping: ${error.message}`);
    }
  }

  async getReadiness(projectId, mappingId) {
    const mapping = await this.get(projectId, mappingId);
    return validateMappingReadiness(mapping);
  }

  async getStats(projectId) {
    const all = await this.list(projectId);
    const total = all.length;
    const ready = all.filter((m) => m.status === "ready").length;
    const draft = all.filter((m) => m.status === "draft").length;
    const needsReview = all.filter((m) => m.status === "needs-review").length;
    const approved = all.filter((m) => m.status === "approved").length;
    const rejected = all.filter((m) => m.status === "rejected").length;

    let lastUpdated = null;
    if (all.length > 0) {
      const sorted = [...all].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      lastUpdated = sorted[0].updatedAt;
    }

    return { total, ready, draft, needsReview, approved, rejected, lastUpdated };
  }

  async bulkApprove(projectId, mappingIds) {
    if (!projectId || !Array.isArray(mappingIds) || mappingIds.length === 0) {
      throw new Error("Project ID and mapping IDs array are required.");
    }
    const results = [];
    for (const mappingId of mappingIds) {
      try {
        const updated = await this.update(projectId, mappingId, { status: "approved" });
        results.push(updated);
      } catch (error) {
        // Skip individual failures
      }
    }
    return results;
  }

  async bulkReject(projectId, mappingIds) {
    if (!projectId || !Array.isArray(mappingIds) || mappingIds.length === 0) {
      throw new Error("Project ID and mapping IDs array are required.");
    }
    const results = [];
    for (const mappingId of mappingIds) {
      try {
        const updated = await this.update(projectId, mappingId, { status: "rejected" });
        results.push(updated);
      } catch (error) {
        // Skip individual failures
      }
    }
    return results;
  }
}

let serviceInstance = null;

function getImplementationMappingService() {
  if (!serviceInstance) {
    serviceInstance = new ImplementationMappingService();
  }
  return serviceInstance;
}

function resetImplementationMappingService() {
  serviceInstance = null;
}

module.exports = {
  ImplementationMappingService,
  getImplementationMappingService,
  resetImplementationMappingService,
};