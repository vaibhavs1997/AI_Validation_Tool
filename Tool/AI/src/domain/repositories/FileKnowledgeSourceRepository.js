const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../../config");
const { DEFAULT_PROJECT } = require("../ProjectIdentity");
const { createKnowledgeSource } = require("../knowledge-sources/KnowledgeSource");

const KNOWLEDGE_SOURCES_DIR = path.join(config.dataDir, "knowledge-sources");
const REPOSITORY_DIR = path.join(config.dataDir, "knowledge-repository");

function ensureStorage() {
  if (!fs.existsSync(KNOWLEDGE_SOURCES_DIR)) fs.mkdirSync(KNOWLEDGE_SOURCES_DIR, { recursive: true });
  if (!fs.existsSync(REPOSITORY_DIR)) fs.mkdirSync(REPOSITORY_DIR, { recursive: true });
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
    const hash = crypto.createHash("sha256").update(str).digest("hex").slice(0, 6);
    return `${sanitized}-${hash}`;
  }
  return sanitized || crypto.randomUUID().slice(0, 12);
}

function resolveProjectExistence(projectId) {
  const resolved = typeof projectId === "string" ? projectId.trim() : "";
  if (resolved.length === 0) {
    throw new Error("projectId must be a non-empty string.");
  }
  if (resolved === DEFAULT_PROJECT.id) return;
  if (!fs.existsSync(path.join(KNOWLEDGE_SOURCES_DIR, `${safeName(projectId)}.json`))) {
    // Project doesn't have knowledge sources, but that's OK - treat as empty
  }
}

function getKnowledgeSourcesPath(projectId) {
  return path.join(KNOWLEDGE_SOURCES_DIR, `${safeName(projectId)}.json`);
}

function getRepositoryPath(projectId) {
  return path.join(REPOSITORY_DIR, `${safeName(projectId)}.json`);
}

// ─── Knowledge Sources CRUD ───────────────────────────────────────────────────

function getKnowledgeSources(projectId) {
  ensureStorage();
  const file = getKnowledgeSourcesPath(projectId);
  if (!fs.existsSync(file)) return [];

  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(data.sources) ? data.sources.map(s => createKnowledgeSource(s)) : [];
}

function saveKnowledgeSources(projectId, sources) {
  ensureStorage();
  const file = getKnowledgeSourcesPath(projectId);
  const normalized = Array.isArray(sources) ? sources.map(s => createKnowledgeSource(s)) : [];
  const payload = { projectId, sources: normalized, updatedAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  return normalized;
}

function getKnowledgeSource(projectId, sourceId) {
  const sources = getKnowledgeSources(projectId);
  return sources.find(s => s.id === sourceId) || null;
}

function addKnowledgeSource(projectId, sourceInput) {
  const sources = getKnowledgeSources(projectId);
  const newSource = createKnowledgeSource({ ...sourceInput, projectId });
  sources.push(newSource);
  saveKnowledgeSources(projectId, sources);
  return newSource;
}

function updateKnowledgeSource(projectId, sourceId, updates) {
  const sources = getKnowledgeSources(projectId);
  const idx = sources.findIndex(s => s.id === sourceId);
  if (idx === -1) return null;

  sources[idx] = createKnowledgeSource({ ...sources[idx], ...updates, id: sourceId, projectId });
  saveKnowledgeSources(projectId, sources);
  return sources[idx];
}

function deleteKnowledgeSource(projectId, sourceId) {
  const sources = getKnowledgeSources(projectId);
  const filtered = sources.filter(s => s.id !== sourceId);
  saveKnowledgeSources(projectId, filtered);
  return filtered;
}

// ─── Knowledge Repository (Aggregated) ───────────────────────────────────────

function getRepositoryItems(projectId) {
  ensureStorage();
  const file = getRepositoryPath(projectId);
  if (!fs.existsSync(file)) return [];

  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(data.items) ? data.items.map(i => createKnowledgeRepositoryItem(i)) : [];
}

function saveRepositoryItems(projectId, items) {
  ensureStorage();
  const file = getRepositoryPath(projectId);
  const normalized = Array.isArray(items) ? items.map(i => createKnowledgeRepositoryItem(i)) : [];
  const payload = { projectId, items: normalized, updatedAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  return normalized;
}

function getRepositoryItem(projectId, itemId) {
  const items = getRepositoryItems(projectId);
  return items.find(i => i.id === itemId) || null;
}

function addRepositoryItem(projectId, itemInput) {
  const items = getRepositoryItems(projectId);
  const newItem = createKnowledgeRepositoryItem({ ...itemInput, projectId });
  items.push(newItem);
  saveRepositoryItems(projectId, items);
  return newItem;
}

function updateRepositoryItem(projectId, itemId, updates) {
  const items = getRepositoryItems(projectId);
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) return null;

  items[idx] = createKnowledgeRepositoryItem({ ...items[idx], ...updates, id: itemId, projectId });
  saveRepositoryItems(projectId, items);
  return items[idx];
}

function deleteRepositoryItem(projectId, itemId) {
  const items = getRepositoryItems(projectId);
  const filtered = items.filter(i => i.id !== itemId);
  saveRepositoryItems(projectId, filtered);
  return filtered;
}

function getAggregatedRepository(projectId) {
  const sources = getKnowledgeSources(projectId);
  const items = getRepositoryItems(projectId);

  // Enrich items with source metadata
  const enriched = items.map(item => {
    const source = sources.find(s => s.id === item.sourceId);
    return {
      ...item,
      sourceName: source ? source.name : 'Unknown Source',
      sourceStatus: source ? source.status : 'unknown',
    };
  });

  return {
    sources,
    items: enriched,
    stats: {
      totalSources: sources.length,
      connectedSources: sources.filter(s => s.status === 'connected' || s.status === 'available').length,
      totalItems: items.length,
      bySource: sources.map(s => ({
        ...s,
        itemCount: items.filter(i => i.sourceId === s.id).length,
      })),
    }
  };
}

// ─── Helper Dependencies ─────────────────────────────────────────────────────

function createKnowledgeRepositoryItem(input) {
  // Import here to avoid circular dependency
  const { createKnowledgeRepositoryItem: createItem } = require("../knowledge-sources/KnowledgeRepositoryItem");
  return createItem(input);
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function getBackendName() {
  return "file";
}

async function ensureReady() {
  ensureStorage();
  return true;
}

module.exports = {
  // Knowledge Sources
  getKnowledgeSources,
  saveKnowledgeSources,
  getKnowledgeSource,
  addKnowledgeSource,
  updateKnowledgeSource,
  deleteKnowledgeSource,

  // Knowledge Repository
  getRepositoryItems,
  saveRepositoryItems,
  getRepositoryItem,
  addRepositoryItem,
  updateRepositoryItem,
  deleteRepositoryItem,
  getAggregatedRepository,

  // Utility
  getBackendName,
  ensureReady,
};