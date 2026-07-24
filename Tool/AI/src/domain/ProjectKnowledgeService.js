/**
 * ProjectKnowledgeService
 *
 * Service layer for reviewing and managing AI-proposed KnowledgeRelationships.
 */

const { analyzeProjectKnowledge } = require('./ProjectKnowledgeAnalyzer');
const {
  getProjectKnowledge,
  saveProjectKnowledge,
  projectKnowledgeExists,
} = require('./ProjectKnowledgeRepository');
const { createKnowledgeRelationship } = require('./KnowledgeRelationship');

const STATUSES = Object.freeze(['proposed', 'confirmed', 'rejected']);

function isPromise(value) {
  return Boolean(value && typeof value.then === 'function');
}

function relationshipKey(rel) {
  return `${rel.source.serviceId}::${rel.source.operationId}::${rel.source.location}::${rel.target.serviceId}::${rel.target.operationId}::${rel.target.location}`;
}

async function analyzeAndStoreProposals({ projectId, instructions, services, apiModels, relationships: explicitRelationships }) {
  let analyzedRelationships = [];
  if (Array.isArray(explicitRelationships)) {
    analyzedRelationships = explicitRelationships;
  } else {
    const { relationships } = await analyzeProjectKnowledge({ instructions, services, apiModels });
    analyzedRelationships = relationships;
  }

  const existing = (await getProjectKnowledge(projectId)) || { relationships: [] };
  const preserved = existing.relationships || [];
  const preservedByKey = new Map();
  for (const rel of preserved) {
    if (rel.status !== 'proposed') {
      preservedByKey.set(relationshipKey(rel), rel);
    }
  }

  const next = new Map(preservedByKey);
  for (const rel of analyzedRelationships) {
    const key = relationshipKey(rel);
    if (next.has(key)) continue;
    if (preservedByKey.has(key)) continue;
    next.set(key, createKnowledgeRelationship({ ...rel, status: 'proposed' }));
  }

  const merged = Array.from(next.values());
  return saveProjectKnowledge(projectId, instructions, merged);
}

function listRelationshipsByStatus(projectId, status) {
  const resolve = (knowledge) => {
    if (!knowledge) return [];
    const targetStatus = status;
    return (knowledge.relationships || [])
      .filter((rel) => rel.status === targetStatus)
      .map((rel) => createKnowledgeRelationship(rel));
  };

  const knowledgeOrPromise = getProjectKnowledge(projectId);
  if (isPromise(knowledgeOrPromise)) {
    return knowledgeOrPromise.then(resolve);
  }
  return resolve(knowledgeOrPromise);
}

function confirmRelationship(projectId, sourceKey) {
  return updateRelationshipStatus(projectId, sourceKey, 'confirmed');
}

function rejectRelationship(projectId, sourceKey) {
  return updateRelationshipStatus(projectId, sourceKey, 'rejected');
}

function updateRelationshipStatus(projectId, sourceKey, newStatus) {
  const applyUpdate = (knowledge) => {
    if (!knowledge) return null;
    const relationships = (knowledge.relationships || []).map((rel) => {
      const key = relationshipKey(rel);
      if (key === sourceKey && rel.status === 'proposed') {
        return createKnowledgeRelationship({ ...rel, status: newStatus });
      }
      return rel;
    });
    return saveProjectKnowledge(projectId, knowledge.instructions, relationships);
  };

  const knowledgeOrPromise = getProjectKnowledge(projectId);
  if (isPromise(knowledgeOrPromise)) {
    return knowledgeOrPromise.then(applyUpdate);
  }
  return applyUpdate(knowledgeOrPromise);
}

module.exports = {
  analyzeAndStoreProposals,
  listRelationshipsByStatus,
  confirmRelationship,
  rejectRelationship,
  STATUSES,
};