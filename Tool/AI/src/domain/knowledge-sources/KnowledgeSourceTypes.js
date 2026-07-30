/**
 * Knowledge Source Types
 *
 * Defines supported knowledge source types and their constants.
 */

const SOURCE_TYPES = Object.freeze([
  'confluence',
  'local-documents',
  'project-notes',
  // Future sources:
  // 'sharepoint',
  // 'google-drive',
  // 'git-repository',
  // 'internal-wiki',
]);

const SOURCE_STATUSES = Object.freeze([
  'available',
  'connected',
  'not-connected',
  'syncing',
  'error',
]);

const SYNC_STATUSES = Object.freeze([
  'idle',
  'running',
  'completed',
  'failed',
]);

const KNOWLEDGE_TYPES = Object.freeze([
  'business-rule',
  'architecture',
  'authentication',
  'workflow',
  'documentation',
  'api-spec',
]);

module.exports = {
  SOURCE_TYPES,
  SOURCE_STATUSES,
  SYNC_STATUSES,
  KNOWLEDGE_TYPES,
};