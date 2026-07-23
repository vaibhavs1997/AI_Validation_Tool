/**
 * KnowledgeRelationship
 *
 * Minimal structured relationship between API operations within a project's knowledge.
 */

const RELATIONSHIP_TYPES = Object.freeze(['data_dependency', 'authentication']);
const STATUSES = Object.freeze(['proposed', 'confirmed', 'rejected']);

/**
 * @param {{ id?: string, type: 'data_dependency'|'authentication', source: { serviceId: string, operationId: string, location: string }, target: { serviceId: string, operationId: string, location: string }, transform?: string, status?: 'proposed'|'confirmed'|'rejected', confidence?: number, evidence?: string }} input
 * @returns {{ id: string, type: string, source: { serviceId: string, operationId: string, location: string }, target: { serviceId: string, operationId: string, location: string }, transform?: string, status: string, confidence: number, evidence?: string }}
 */
function createKnowledgeRelationship(input = {}) {
  if (!input || typeof input.type !== 'string') {
    throw new Error('KnowledgeRelationship type is required.');
  }
  const type = String(input.type).toLowerCase();
  if (!RELATIONSHIP_TYPES.includes(type)) {
    throw new Error(`KnowledgeRelationship type must be one of: ${RELATIONSHIP_TYPES.join(', ')}.`);
  }

  const source = normalizeRef(input.source);
  const target = normalizeRef(input.target);

  const status = input.status ? String(input.status).toLowerCase() : 'proposed';
  if (!STATUSES.includes(status)) {
    throw new Error(`KnowledgeRelationship status must be one of: ${STATUSES.join(', ')}.`);
  }

  const confidence = typeof input.confidence === 'number' ? input.confidence : 0;
  const clampedConfidence = Math.max(0, Math.min(1, confidence));

  return {
    id: input.id ? String(input.id).trim() : '',
    type,
    source,
    target,
    transform: input.transform ? String(input.transform) : '',
    status,
    confidence: clampedConfidence,
    evidence: input.evidence ? String(input.evidence) : '',
  };
}

function normalizeRef(ref) {
  if (!ref || typeof ref !== 'object') {
    throw new Error('KnowledgeRelationship source/target must be an object with serviceId, operationId, and location.');
  }
  const serviceId = typeof ref.serviceId === 'string' ? ref.serviceId.trim() : '';
  const operationId = typeof ref.operationId === 'string' ? ref.operationId.trim() : '';
  const location = typeof ref.location === 'string' ? ref.location.trim() : '';

  if (!serviceId || !operationId || !location) {
    throw new Error('KnowledgeRelationship source/target must include non-empty serviceId, operationId, and location.');
  }

  return {
    serviceId,
    operationId,
    location,
  };
}

module.exports = {
  createKnowledgeRelationship,
  RELATIONSHIP_TYPES,
  STATUSES,
};