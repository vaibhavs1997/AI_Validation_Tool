/**
 * ExecutableTestService
 *
 * Service layer for ExecutableTest CRUD operations.
 */

const repo = require("./ExecutableTestRepository");
const { createExecutableTest, validateTestReadiness } = require("./ExecutableTest");

class ExecutableTestService {
  async create(projectId, input) {
    if (!projectId) throw new Error("Project ID is required.");
    try {
      return repo.createTestForProject(projectId, input);
    } catch (error) {
      throw new Error(`Failed to create executable test: ${error.message}`);
    }
  }

  async get(projectId, testId) {
    if (!projectId || !testId) throw new Error("Project ID and Test ID are required.");
    const test = repo.getTest(projectId, testId);
    if (!test) throw new Error(`ExecutableTest not found: ${testId}`);
    return test;
  }

  async list(projectId, options = {}) {
    if (!projectId) throw new Error("Project ID is required.");
    try {
      return repo.listTests(projectId, options);
    } catch (error) {
      throw new Error(`Failed to list executable tests: ${error.message}`);
    }
  }

  async update(projectId, testId, updates) {
    if (!projectId || !testId) throw new Error("Project ID and Test ID are required.");
    if (!updates || Object.keys(updates).length === 0) throw new Error("Updates object is required.");
    try {
      return repo.updateTest(projectId, testId, updates);
    } catch (error) {
      if (error.message.includes("not found")) throw error;
      throw new Error(`Failed to update executable test: ${error.message}`);
    }
  }

  async delete(projectId, testId) {
    if (!projectId || !testId) throw new Error("Project ID and Test ID are required.");
    try {
      repo.deleteTest(projectId, testId);
    } catch (error) {
      if (error.message.includes("not found")) throw error;
      throw new Error(`Failed to delete executable test: ${error.message}`);
    }
  }

  async getReadiness(projectId, testId) {
    const test = await this.get(projectId, testId);
    return validateTestReadiness(test);
  }

  async getStats(projectId) {
    const all = await this.list(projectId);
    const total = all.length;
    const ready = all.filter((t) => t.status === "ready").length;
    const draft = all.filter((t) => t.status === "draft").length;
    const needsReview = all.filter((t) => t.status === "needs-review").length;
    const approved = all.filter((t) => t.status === "approved").length;
    const rejected = all.filter((t) => t.status === "rejected").length;

    let lastUpdated = null;
    if (all.length > 0) {
      const sorted = [...all].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      lastUpdated = sorted[0].updatedAt;
    }

    return { total, ready, draft, needsReview, approved, rejected, lastUpdated };
  }

  async bulkApprove(projectId, testIds) {
    if (!projectId || !Array.isArray(testIds) || testIds.length === 0) {
      throw new Error("Project ID and test IDs array are required.");
    }
    const results = [];
    for (const testId of testIds) {
      try {
        const updated = await this.update(projectId, testId, { status: "approved" });
        results.push(updated);
      } catch (error) {
        // Skip individual failures
      }
    }
    return results;
  }

  async bulkReject(projectId, testIds) {
    if (!projectId || !Array.isArray(testIds) || testIds.length === 0) {
      throw new Error("Project ID and test IDs array are required.");
    }
    const results = [];
    for (const testId of testIds) {
      try {
        const updated = await this.update(projectId, testId, { status: "rejected" });
        results.push(updated);
      } catch (error) {
        // Skip individual failures
      }
    }
    return results;
  }
}

let serviceInstance = null;

function getExecutableTestService() {
  if (!serviceInstance) {
    serviceInstance = new ExecutableTestService();
  }
  return serviceInstance;
}

function resetExecutableTestService() {
  serviceInstance = null;
}

module.exports = {
  ExecutableTestService,
  getExecutableTestService,
  resetExecutableTestService,
};