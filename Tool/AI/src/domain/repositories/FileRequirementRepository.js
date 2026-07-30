/**
 * FileRequirementRepository
 *
 * File-based persistence for Requirement domain objects.
 * Stores requirements as JSON files scoped per project.
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { createRequirement, VALID_STATUSES, VALID_PRIORITIES } = require('../Requirement');

const REQUIREMENTS_DIR = path.join(config.dataDir, 'requirements');

function ensureDir(projectId) {
  const dir = path.join(REQUIREMENTS_DIR, projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function safeName(value) {
  const str = String(value || 'unnamed');
  const sanitized = str
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
  return sanitized || 'unnamed';
}

function requirementFilePath(projectId, reqId) {
  return path.join(REQUIREMENTS_DIR, safeName(projectId), `${safeName(reqId)}.json`);
}

/**
 * Create a new requirement.
 * @param {string} projectId
 * @param {object} input
 * @returns {object} created requirement
 */
function createRequirementForProject(projectId, input) {
  const req = createRequirement({ ...input, projectId });
  const dir = ensureDir(projectId);
  const file = path.join(dir, `${safeName(req.id)}.json`);

  if (fs.existsSync(file)) {
    throw new Error(`Requirement already exists: ${req.id}`);
  }

  fs.writeFileSync(file, JSON.stringify(req, null, 2), 'utf8');
  return req;
}

/**
 * Get a requirement by ID.
 * @param {string} projectId
 * @param {string} reqId
 * @returns {object|null}
 */
function getRequirement(projectId, reqId) {
  const file = requirementFilePath(projectId, reqId);
  if (!fs.existsSync(file)) return null;

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return data;
}

/**
 * List all requirements for a project, with optional sort/filter.
 * @param {string} projectId
 * @param {{ search?: string, sort?: string, order?: string, status?: string }} options
 * @returns {object[]}
 */
function listRequirements(projectId, options = {}) {
  const dir = ensureDir(projectId);

  let requirements = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const fullPath = path.join(dir, file);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      return data;
    });

  // Filter by status
  if (options.status && VALID_STATUSES.includes(options.status)) {
    requirements = requirements.filter((r) => r.status === options.status);
  }

  // Search by title or description
  if (options.search) {
    const query = options.search.toLowerCase();
    requirements = requirements.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.id.toLowerCase().includes(query)
    );
  }

  // Sort
  const sortField = options.sort || 'updatedAt';
  const order = options.order === 'asc' ? 1 : -1;

  requirements.sort((a, b) => {
    const aVal = a[sortField] || '';
    const bVal = b[sortField] || '';
    if (aVal < bVal) return -1 * order;
    if (aVal > bVal) return 1 * order;
    return 0;
  });

  return requirements;
}

/**
 * Update a requirement.
 * @param {string} projectId
 * @param {string} reqId
 * @param {object} updates
 * @returns {object} updated requirement
 */
function updateRequirement(projectId, reqId, updates) {
  const file = requirementFilePath(projectId, reqId);
  if (!fs.existsSync(file)) {
    throw new Error(`Requirement not found: ${reqId}`);
  }

  const existing = JSON.parse(fs.readFileSync(file, 'utf8'));

  // Build merged fields, keeping validation rules
  const merged = {
    ...existing,
    ...updates,
    id: existing.id,
    projectId: existing.projectId,
    createdAt: existing.createdAt,
    updatedAt: new Date(),
  };

  // Re-validate via domain model
  const validated = createRequirement(merged);
  fs.writeFileSync(file, JSON.stringify(validated, null, 2), 'utf8');
  return validated;
}

/**
 * Delete a requirement.
 * @param {string} projectId
 * @param {string} reqId
 */
function deleteRequirement(projectId, reqId) {
  const file = requirementFilePath(projectId, reqId);
  if (!fs.existsSync(file)) {
    throw new Error(`Requirement not found: ${reqId}`);
  }
  fs.unlinkSync(file);
}

function getBackendName() {
  return 'file';
}

async function ensureReady() {
  return true;
}

module.exports = {
  createRequirementForProject,
  getRequirement,
  listRequirements,
  updateRequirement,
  deleteRequirement,
  getBackendName,
  ensureReady,
};