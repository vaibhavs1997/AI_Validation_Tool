/**
 * ProjectKnowledgeRepository
 *
 * Project-scoped persistence for ProjectKnowledge.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const { DEFAULT_PROJECT } = require("./ProjectIdentity");
const { createProjectKnowledge } = require("./ProjectKnowledge");
const { createKnowledgeRelationship } = require("./KnowledgeRelationship");
const { projectExists: projectExistsInProjectRepo } = require("./ProjectRepository");

const PROJECT_KNOWLEDGE_DIR = path.join(config.dataDir, "project-knowledge");

function ensureStorage() {
  if (!fs.existsSync(PROJECT_KNOWLEDGE_DIR)) fs.mkdirSync(PROJECT_KNOWLEDGE_DIR, { recursive: true });
}

function safeName(value) {
  const str = String(value || crypto.randomUUID());
  const hasSpecial = /[^a-zA-Z0-9._-]/.test(str);
  const sanitized = str
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  if (hasSpecial && !str.startsWith(sanitized)) {
    const hash = crypto.createHash("md5").update(str).digest("hex").slice(0, 6);
    return `${sanitized}-${hash}`;
  }
  return sanitized || crypto.randomUUID().slice(0, 12);
}

function resolveProjectExistence(projectId) {
  const resolved = typeof projectId === 'string' ? projectId.trim() : '';
  if (resolved.length === 0) {
    throw new Error('projectId must be a non-empty string.');
  }
  if (resolved === DEFAULT_PROJECT.id) return;
  if (!projectExistsInProjectRepo(resolved)) {
    throw new Error(`Unknown projectId: ${resolved}`);
  }
}

/**
 * Get project knowledge by projectId.
 * Returns null when no knowledge exists yet.
 */
function getProjectKnowledge(projectId) {
  ensureStorage();
  resolveProjectExistence(projectId);
  const file = path.join(PROJECT_KNOWLEDGE_DIR, `${safeName(projectId)}.json`);
  if (!fs.existsSync(file)) return null;

  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return createProjectKnowledge({
    projectId: data.projectId,
    instructions: data.instructions,
    relationships: data.relationships,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });
}

/**
 * Create or update project instructions.
 * If knowledge already exists, updates instructions and updatedAt.
 */
function saveProjectKnowledge(projectId, instructions, relationships) {
  ensureStorage();
  resolveProjectExistence(projectId);
  const existing = getProjectKnowledge(projectId);
  const now = new Date();

  const normalizedRelationships = Array.isArray(relationships)
    ? relationships.map((rel) => createKnowledgeRelationship(rel))
    : [];

  const knowledge = {
    projectId: String(projectId).trim(),
    instructions: instructions !== undefined ? String(instructions) : existing ? existing.instructions : '',
    relationships: normalizedRelationships,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };

  const file = path.join(PROJECT_KNOWLEDGE_DIR, `${safeName(projectId)}.json`);
  fs.writeFileSync(file, JSON.stringify(knowledge, null, 2), "utf8");
  return knowledge;
}

/**
 * Check whether project knowledge exists.
 */
function projectKnowledgeExists(projectId) {
  ensureStorage();
  resolveProjectExistence(projectId);
  return fs.existsSync(path.join(PROJECT_KNOWLEDGE_DIR, `${safeName(projectId)}.json`));
}

module.exports = {
  getProjectKnowledge,
  saveProjectKnowledge,
  projectKnowledgeExists,
};