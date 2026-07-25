const ProjectRepository = require('./ProjectRepository');
const { validateProjectId, validateProjectName, DEFAULT_PROJECT } = require('./ProjectIdentity');

class ProjectService {
  constructor(repository) {
    this.repository = repository;
  }

  async createProject(input) {
    const id = String(input && input.id || '').trim();
    const name = input && input.name;

    if (!id) {
      throw new Error('Project id is required.');
    }

    validateProjectId(id);

    if (name !== undefined && name !== null) {
      validateProjectName(name);
    }

    const existing = await this.repository.projectExists(id);
    if (existing) {
      throw new Error(`Project already exists: ${id}`);
    }

    try {
      return await this.repository.createProject({
        id,
        name: name || id,
        createdAt: input && input.createdAt,
        updatedAt: input && input.updatedAt,
      });
    } catch (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }
  }

  async getProject(id) {
    if (!id) {
      throw new Error('Project id is required.');
    }

    const project = await this.repository.getProject(id);
    if (!project) {
      throw new Error(`Project not found: ${id}`);
    }

    return project;
  }

  async listProjects(options) {
    try {
      return await this.repository.listProjects(options);
    } catch (error) {
      throw new Error(`Failed to list projects: ${error.message}`);
    }
  }

  async searchProjects(query) {
    if (!query) {
      return this.repository.listProjects();
    }

    try {
      return await this.repository.searchProjects(query);
    } catch (error) {
      throw new Error(`Failed to search projects: ${error.message}`);
    }
  }

  async updateProject(id, updates) {
    if (!id) {
      throw new Error('Project id is required.');
    }

    if (!updates || updates.name === undefined || updates.name === null) {
      throw new Error('Project name is required for update.');
    }

    validateProjectName(updates.name);

    const existing = await this.repository.getProject(id);
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }

    try {
      return await this.repository.updateProject(id, updates);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to update project: ${error.message}`);
    }
  }

  async deleteProject(id) {
    if (!id) {
      throw new Error('Project id is required.');
    }

    if (id === DEFAULT_PROJECT.id) {
      throw new Error('Cannot delete the default project');
    }

    const existing = await this.repository.getProject(id);
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }

    try {
      await this.repository.deleteProject(id);
    } catch (error) {
      if (error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }
}

let serviceInstance = null;

function getProjectService() {
  if (!serviceInstance) {
    const repository = require('./repositories/FileProjectRepository');
    serviceInstance = new ProjectService(repository);
  }
  return serviceInstance;
}

function resetProjectService() {
  serviceInstance = null;
}

module.exports = {
  ProjectService,
  getProjectService,
  resetProjectService,
};