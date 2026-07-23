/**
 * ProjectIdentity
 *
 * Minimal ownership boundary concept for the AI Validation Tool.
 * Backward-compatible: does not change existing pipeline behavior.
 */

const DEFAULT_PROJECT = Object.freeze({
  id: 'default',
  name: 'Default Project',
  createdAt: new Date('1970-01-01T00:00:00.000Z'),
  updatedAt: new Date('1970-01-01T00:00:00.000Z'),
});

/**
 * Validate ProjectIdentity fields.
 * @param {{id:string, name:string, createdAt:Date, updatedAt:Date}} project
 * @returns {void}
 * @throws {Error}
 */
function validateProjectIdentity(project) {
  if (typeof project.id !== 'string' || project.id.trim().length === 0) {
    throw new Error('Project identity id must be a non-empty string.');
  }

  if (typeof project.name !== 'string' || project.name.trim().length === 0) {
    throw new Error('Project identity name must be a non-empty string.');
  }

  const createdAt = new Date(project.createdAt);
  const updatedAt = new Date(project.updatedAt);

  if (Number.isNaN(createdAt.getTime())) {
    throw new Error('Project identity createdAt must be a valid date timestamp.');
  }

  if (Number.isNaN(updatedAt.getTime())) {
    throw new Error('Project identity updatedAt must be a valid date timestamp.');
  }
}

/**
 * Create a ProjectIdentity instance with runtime validation.
 *
 * @param {{ id?: string, name?: string, createdAt?: Date | string | number, updatedAt?: Date | string | number }} input
 * @returns {{ id: string, name: string, createdAt: Date, updatedAt: Date, toString(): string }}
 */
function createProjectIdentity(input = {}) {
  const project = {
    id: input.id === undefined ? DEFAULT_PROJECT.id : input.id,
    name: input.name === undefined ? DEFAULT_PROJECT.name : input.name,
    createdAt: input.createdAt === undefined ? DEFAULT_PROJECT.createdAt : input.createdAt,
    updatedAt: input.updatedAt === undefined ? DEFAULT_PROJECT.updatedAt : input.updatedAt,
  };

  validateProjectIdentity(project);

  return {
    id: String(project.id).trim(),
    name: String(project.name).trim(),
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt),

    toString() {
      return JSON.stringify({
        id: this.id,
        name: this.name,
        createdAt: this.createdAt.toISOString(),
        updatedAt: this.updatedAt.toISOString(),
      });
    },
  };
}

/**
 * Return the safe default project identity.
 * @returns {{ id: string, name: string, createdAt: Date, updatedAt: Date, toString(): string }}
 */
function getDefaultProjectIdentity() {
  return createProjectIdentity({
    id: DEFAULT_PROJECT.id,
    name: DEFAULT_PROJECT.name,
    createdAt: DEFAULT_PROJECT.createdAt,
    updatedAt: DEFAULT_PROJECT.updatedAt,
  });
}

module.exports = {
  DEFAULT_PROJECT,
  createProjectIdentity,
  getDefaultProjectIdentity,
  validateProjectIdentity,
};