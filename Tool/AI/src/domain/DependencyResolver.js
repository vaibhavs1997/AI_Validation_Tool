/**
 * DependencyResolver
 *
 * Deterministic resolver for project-confirmed API operation dependencies.
 * Uses only `confirmed` KnowledgeRelationships to derive execution order.
 */

const { STATUSES } = require('./KnowledgeRelationship');

function buildOperationIndex(apiModels = []) {
  const index = new Map();
  for (const model of apiModels) {
    const serviceId = model.service?.id || model.title || 'api-service';
    for (const op of model.operations || []) {
      const operationId = op.id || op.operationId || `${op.method || 'GET'} ${op.path || '/'}`;
      index.set(`${serviceId}::${operationId}`, {
        serviceId,
        operationId,
        method: op.method,
        path: op.path,
        summary: op.summary || '',
        protocol: op.protocol || model.protocol || 'rest',
      });
    }
  }
  return index;
}

function getConfirmedRelationships(relationships = []) {
  return relationships.filter((rel) => rel.status === 'confirmed');
}

function resolveDependencies({ targetServiceId, targetOperationId, services = [], apiModels = [], relationships = [] }) {
  const operationIndex = buildOperationIndex(apiModels);
  const confirmed = getConfirmedRelationships(relationships);

  const targetKey = `${targetServiceId}::${targetOperationId}`;
  const targetOperation = operationIndex.get(targetKey);
  if (!targetOperation) {
    return {
      target: { serviceId: targetServiceId, operationId: targetOperationId },
      prerequisites: [],
      sequence: [],
      mappings: [],
      errors: [`Target operation not found: ${targetKey}`],
    };
  }

  const visited = new Set();
  const sequence = [];
  const prerequisites = new Map();
  const mappings = [];
  const errors = [];
  const duplicateSet = new Set();
  const relationshipSet = new Set();

  function visit(serviceId, operationId, path = []) {
    const key = `${serviceId}::${operationId}`;
    if (path.includes(key)) {
      errors.push(`Circular dependency detected: ${path.join(' -> ')} -> ${key}`);
      return;
    }
    if (visited.has(key)) return;
    visited.add(key);

    const incoming = confirmed.filter((rel) => rel.target.serviceId === serviceId && rel.target.operationId === operationId);
    if (incoming.length === 0) {
      sequence.push({ serviceId, operationId });
      return;
    }

    for (const rel of incoming) {
      const sourceKey = `${rel.source.serviceId}::${rel.source.operationId}`;
      if (!operationIndex.has(sourceKey)) {
        errors.push(`Missing referenced operation: ${sourceKey}`);
        continue;
      }

      const mappingKey = `${sourceKey}->${key}`;
      if (relationshipSet.has(mappingKey)) {
        errors.push(`Duplicate relationship detected: ${mappingKey}`);
        continue;
      }
      relationshipSet.add(mappingKey);

      visit(rel.source.serviceId, rel.source.operationId, [...path, key]);

      mappings.push({
        relationship: {
          type: rel.type,
          source: rel.source,
          target: rel.target,
          transform: rel.transform || '',
          confidence: rel.confidence,
        },
        from: { serviceId: rel.source.serviceId, operationId: rel.source.operationId, location: rel.source.location },
        to: { serviceId: rel.target.serviceId, operationId: rel.target.operationId, location: rel.target.location },
      });

      if (!prerequisites.has(sourceKey)) {
        prerequisites.set(sourceKey, { serviceId: rel.source.serviceId, operationId: rel.source.operationId });
      }
    }

    sequence.push({ serviceId, operationId });
  }

  visit(targetServiceId, targetOperationId);

  return {
    target: targetOperation,
    prerequisites: Array.from(prerequisites.values()),
    sequence,
    mappings,
    errors,
  };
}

module.exports = {
  resolveDependencies,
  buildOperationIndex,
};