/**
 * KnowledgeSource
 *
 * Domain model representing a configured knowledge source.
 */

const { SOURCE_TYPES, SOURCE_STATUSES, SYNC_STATUSES } = require('./KnowledgeSourceTypes');

/**
 * @param {{ id?: string, projectId: string, type: string, name: string, description?: string, status?: string, config?: object, syncConfig?: object, lastSync?: { status: string, timestamp: string, pagesIndexed: number, pagesChanged: number, errors: string[] }, metadata?: object, createdAt?: Date, updatedAt?: Date }} input
 * @returns {{ id: string, projectId: string, type: string, name: string, description: string, status: string, config: object, syncConfig: object, lastSync: object, metadata: object, createdAt: Date, updatedAt: Date }}
 */
function createKnowledgeSource(input = {}) {
  if (!input || typeof input.projectId !== 'string' || input.projectId.trim().length === 0) {
    throw new Error('KnowledgeSource projectId must be a non-empty string.');
  }
  if (!input || typeof input.type !== 'string' || input.type.trim().length === 0) {
    throw new Error('KnowledgeSource type must be a non-empty string.');
  }
  if (!input || typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new Error('KnowledgeSource name must be a non-empty string.');
  }

  const type = String(input.type).toLowerCase().trim();
  if (!SOURCE_TYPES.includes(type)) {
    throw new Error(`KnowledgeSource type must be one of: ${SOURCE_TYPES.join(', ')}.`);
  }

  const status = input.status ? String(input.status).toLowerCase().trim() : 'not-connected';
  if (!SOURCE_STATUSES.includes(status)) {
    throw new Error(`KnowledgeSource status must be one of: ${SOURCE_STATUSES.join(', ')}.`);
  }

  const now = new Date();
  const config = input.config || {};
  const syncConfig = input.syncConfig || { autoSync: false, interval: 3600 };
  const lastSync = input.lastSync || { status: 'idle', timestamp: null, pagesIndexed: 0, pagesChanged: 0, errors: [] };
  const metadata = input.metadata || {};

  return {
    id: input.id ? String(input.id).trim() : generateId(type),
    projectId: String(input.projectId).trim(),
    type,
    name: String(input.name).trim(),
    description: input.description ? String(input.description) : '',
    status,
    config,
    syncConfig,
    lastSync,
    metadata,
    createdAt: input.createdAt instanceof Date ? new Date(input.createdAt) : now,
    updatedAt: input.updatedAt instanceof Date ? new Date(input.updatedAt) : now,
  };
}

function generateId(type) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${type}-${timestamp}-${random}`;
}

module.exports = {
  createKnowledgeSource,
};