/**
 * ProjectKnowledge
 *
 * Minimal project-scoped knowledge foundation.
 * Stores raw user instructions about API workflows and project behavior.
 */

/**
 * @param {{ projectId: string, instructions?: string, relationships?: Array, createdAt?: Date, updatedAt?: Date }} input
 * @returns {{ projectId: string, instructions: string, relationships: Array, createdAt: Date, updatedAt: Date }}
 */
function createProjectKnowledge(input = {}) {
  if (!input || typeof input.projectId !== 'string' || input.projectId.trim().length === 0) {
    throw new Error('ProjectKnowledge projectId must be a non-empty string.');
  }
  if (input.instructions !== undefined && typeof input.instructions !== 'string') {
    throw new Error('ProjectKnowledge instructions must be a string when provided.');
  }
  if (input.relationships !== undefined && !Array.isArray(input.relationships)) {
    throw new Error('ProjectKnowledge relationships must be an array when provided.');
  }

  const now = new Date();
  return {
    projectId: input.projectId.trim(),
    instructions: input.instructions !== undefined ? String(input.instructions) : '',
    relationships: input.relationships || [],
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt instanceof Date ? new Date(input.updatedAt) : now,
  };
}

module.exports = {
  createProjectKnowledge,
};
