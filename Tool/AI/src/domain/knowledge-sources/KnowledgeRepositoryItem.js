/**
 * KnowledgeRepositoryItem
 *
 * Domain model representing an item in the aggregated Knowledge Repository.
 * Each item combines knowledge from any enabled source.
 */

const { KNOWLEDGE_TYPES, SOURCE_TYPES } = require('./KnowledgeSourceTypes');

/**
 * @param {{ id?: string, projectId: string, sourceId: string, sourceType: string, title: string, content?: string, contentType?: string, knowledgeType?: string, version?: number, lastUpdated?: string, status?: string, metadata?: object, syncVersion?: string, createdAt?: Date, updatedAt?: Date }} input
 * @returns {{ id: string, projectId: string, sourceId: string, sourceType: string, title: string, content: string, contentType: string, knowledgeType: string, version: number, lastUpdated: string, status: string, metadata: object, syncVersion: string, createdAt: Date, updatedAt: Date }}
 */
function createKnowledgeRepositoryItem(input = {}) {
  if (!input || typeof input.projectId !== 'string' || input.projectId.trim().length === 0) {
    throw new Error('KnowledgeRepositoryItem projectId must be a non-empty string.');
  }
  if (!input || typeof input.sourceId !== 'string' || input.sourceId.trim().length === 0) {
    throw new Error('KnowledgeRepositoryItem sourceId must be a non-empty string.');
  }
  if (!input || typeof input.sourceType !== 'string' || input.sourceType.trim().length === 0) {
    throw new Error('KnowledgeRepositoryItem sourceType must be a non-empty string.');
  }
  if (!input || typeof input.title !== 'string' || input.title.trim().length === 0) {
    throw new Error('KnowledgeRepositoryItem title must be a non-empty string.');
  }

  const sourceType = String(input.sourceType).toLowerCase().trim();
  if (!SOURCE_TYPES.includes(sourceType)) {
    throw new Error(`KnowledgeRepositoryItem sourceType must be one of: ${SOURCE_TYPES.join(', ')}.`);
  }

  const knowledgeType = input.knowledgeType ? String(input.knowledgeType).toLowerCase().trim() : 'documentation';
  if (!KNOWLEDGE_TYPES.includes(knowledgeType)) {
    throw new Error(`KnowledgeRepositoryItem knowledgeType must be one of: ${KNOWLEDGE_TYPES.join(', ')}.`);
  }

  const now = new Date();
  const timestamp = input.lastUpdated || now.toISOString();

  return {
    id: input.id ? String(input.id).trim() : generateItemId(sourceType, input.sourceId, input.title),
    projectId: String(input.projectId).trim(),
    sourceId: String(input.sourceId).trim(),
    sourceType,
    title: String(input.title).trim(),
    content: input.content || '',
    contentType: input.contentType || 'text/plain',
    knowledgeType,
    version: typeof input.version === 'number' ? input.version : 1,
    lastUpdated: timestamp,
    status: input.status || 'indexed',
    metadata: input.metadata || {},
    syncVersion: input.syncVersion || generateSyncVersion(),
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt instanceof Date ? new Date(input.updatedAt) : now,
  };
}

function generateItemId(sourceType, sourceId, title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40);
  const hash = Buffer.from(`${sourceType}:${sourceId}:${title}`).toString('base64url').slice(0, 8);
  return `${sourceType}-${slug}-${hash}`;
}

function generateSyncVersion() {
  return `sync-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

module.exports = {
  createKnowledgeRepositoryItem,
};