/**
 * FileRequirementWorkflowRepository
 *
 * File-based persistence for RequirementWorkflow domain objects.
 * Stores workflows as JSON files scoped per project.
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { createWorkflow } = require('../RequirementWorkflow');

const WORKFLOWS_DIR = path.join(config.dataDir, 'workflows');

function ensureDir(projectId) {
  const dir = path.join(WORKFLOWS_DIR, projectId);
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

function workflowFilePath(projectId, workflowId) {
  return path.join(WORKFLOWS_DIR, safeName(projectId), `${safeName(workflowId)}.json`);
}

/**
 * Create a new workflow.
 * @param {string} projectId
 * @param {object} input
 * @returns {object} created workflow
 */
function createWorkflowForProject(projectId, input) {
  const workflow = createWorkflow({ ...input, projectId });
  const dir = ensureDir(projectId);
  const file = path.join(dir, `${safeName(workflow.workflowId)}.json`);

  if (fs.existsSync(file)) {
    throw new Error(`Workflow already exists: ${workflow.workflowId}`);
  }

  fs.writeFileSync(file, JSON.stringify(workflow, null, 2), 'utf8');
  return workflow;
}

/**
 * Get a workflow by ID.
 * @param {string} projectId
 * @param {string} workflowId
 * @returns {object|null}
 */
function getWorkflow(projectId, workflowId) {
  const file = workflowFilePath(projectId, workflowId);
  if (!fs.existsSync(file)) return null;

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return data;
}

/**
 * Get workflow by requirement ID.
 * @param {string} projectId
 * @param {string} requirementId
 * @returns {object|null}
 */
function getWorkflowByRequirementId(projectId, requirementId) {
  const dir = ensureDir(projectId);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    if (data.requirementId === requirementId) {
      return data;
    }
  }
  return null;
}

/**
 * List workflows for a project.
 * @param {string} projectId
 * @param {object} options
 * @returns {object[]}
 */
function listWorkflows(projectId, options = {}) {
  const dir = ensureDir(projectId);

  let workflows = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const fullPath = path.join(dir, file);
      return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    });

  // Filter by status
  if (options.status) {
    workflows = workflows.filter((w) => w.status === options.status);
  }

  // Filter by requirementId
  if (options.requirementId) {
    workflows = workflows.filter((w) => w.requirementId === options.requirementId);
  }

  // Sort
  const sortField = options.sort || 'updatedAt';
  const order = options.order === 'asc' ? 1 : -1;
  workflows.sort((a, b) => {
    const aVal = a[sortField] || '';
    const bVal = b[sortField] || '';
    if (aVal < bVal) return -1 * order;
    if (aVal > bVal) return 1 * order;
    return 0;
  });

  return workflows;
}

/**
 * Update a workflow.
 * @param {string} projectId
 * @param {string} workflowId
 * @param {object} updates
 * @returns {object} updated workflow
 */
function updateWorkflow(projectId, workflowId, updates) {
  const file = workflowFilePath(projectId, workflowId);
  if (!fs.existsSync(file)) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  const existing = JSON.parse(fs.readFileSync(file, 'utf8'));

  const merged = {
    ...existing,
    ...updates,
    workflowId: existing.workflowId,
    projectId: existing.projectId,
    requirementId: existing.requirementId,
    startedAt: existing.startedAt,
    updatedAt: new Date().toISOString(),
  };

  const validated = createWorkflow(merged);
  fs.writeFileSync(file, JSON.stringify(validated, null, 2), 'utf8');
  return validated;
}

/**
 * Delete a workflow.
 * @param {string} projectId
 * @param {string} workflowId
 */
function deleteWorkflow(projectId, workflowId) {
  const file = workflowFilePath(projectId, workflowId);
  if (!fs.existsSync(file)) {
    throw new Error(`Workflow not found: ${workflowId}`);
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
  createWorkflowForProject,
  getWorkflow,
  getWorkflowByRequirementId,
  listWorkflows,
  updateWorkflow,
  deleteWorkflow,
  getBackendName,
  ensureReady,
};