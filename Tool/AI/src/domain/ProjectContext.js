/**
 * ProjectContext
 *
 * Lightweight mechanism to resolve the current project identity.
 * Uses the existing ProjectIdentity default when no project is specified.
 *
 * Backward-compatible: does not change existing API behavior.
 */

const { createProjectIdentity, getDefaultProjectIdentity, DEFAULT_PROJECT } = require('./ProjectIdentity');
const { getProject, projectExists } = require('./ProjectRepository');

/**
 * Resolve a project identity from an optional project identifier.
 *
 * Resolution rules:
 * - If projectId is undefined/null/empty string, return the default project identity.
 * - If projectId is "default", return the default project identity.
 * - If projectId matches a persisted project, return that persisted project.
 * - If projectId is unknown, throw a validation error.
 *
 * @param {{ projectId?: string }} [options={}]
 * @returns {{ id: string, name: string, createdAt: Date, updatedAt: Date, toString(): string }}
 */
function resolveProject(options = {}, fallbackToDefault = true) {
  const projectId = options && options.projectId;

  if (typeof projectId === 'string' && projectId.trim().length > 0) {
    const trimmed = projectId.trim();
    if (trimmed === 'default') {
      return getDefaultProjectIdentity();
    }

    if (projectExists(trimmed)) {
      return getProject(trimmed);
    }
  }

  if (fallbackToDefault) {
    return getDefaultProjectIdentity();
  }

  throw new Error(`Unknown projectId: ${projectId && projectId.trim()}`);
}

function resolveProjectStrict(options = {}) {
  return resolveProject(options, false);
}

/**
 * Create an isolated project context for a given project identifier.
 *
 * @param {{ projectId?: string, strict?: boolean }} [options={}]
 * @returns {{ project: { id: string, name: string, createdAt: Date, updatedAt: Date, toString(): string }, projectId: string, isDefault: boolean, error?: string }}
 */
function createProjectContext(options = {}) {
  const projectId = options && options.projectId;
  const strict = options && options.strict;
  let error;

  if (typeof projectId === 'string' && projectId.trim().length > 0) {
    const trimmed = projectId.trim();
    if (trimmed !== 'default' && !projectExists(trimmed)) {
      error = `Unknown projectId: ${trimmed}`;
    }
  }

  const project = error
    ? getDefaultProjectIdentity()
    : strict
      ? resolveProjectStrict(options)
      : resolveProject(options);
  const effectiveProjectId = projectId && String(projectId).trim() ? String(projectId).trim() : project.id;

  return {
    project,
    projectId: effectiveProjectId,
    isDefault: project.id === 'default' && project.name === 'Default Project',
    ...(error ? { error } : {}),
  };
}

module.exports = {
  createProjectContext,
  resolveProject,
};