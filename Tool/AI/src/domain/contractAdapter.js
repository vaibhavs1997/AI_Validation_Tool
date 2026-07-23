/**
 * Lightweight adapter from existing parsed contract/endpoint shapes to canonical API service model.
 */

const { createApiModel } = require('./ApiModel');

/**
 * Map an existing ApiContract endpoint to an ApiOperation.
 *
 * @param {{ method: string, path: string, id?: string, operationId?: string, summary?: string, description?: string }} endpoint
 * @returns {{ id: string, protocol: string, method: string, path: string, summary: string, description: string }}
 */
function mapEndpointToOperation(endpoint) {
  const operation = {
    id: endpoint.id || endpoint.operationId || `${(endpoint.method || 'GET').toUpperCase()} ${endpoint.path || '/'}`,
    protocol: 'rest',
    method: (endpoint.method || 'GET').toUpperCase(),
    path: endpoint.path || '/',
    summary: endpoint.summary || endpoint.operationId || '',
    description: endpoint.description || '',
  };

  return operation;
}

/**
 * Adapt an existing ApiContract to canonical ApiModel without mutating it.
 *
 * @param {{ type?: string, title?: string, baseUrl?: string, endpoints?: Array }} contract
 * @returns {{ service: { id: string, name: string, protocol: string, description: string }, sourceType: string, title: string, baseUrl: string, operations: Array }}
 */
function adaptContractToApiModel(contract = {}) {
  const operations = (contract.endpoints || [])
    .filter((ep) => ep && typeof ep === 'object')
    .map((ep) => mapEndpointToOperation(ep));

  return createApiModel({
    service: {
      id: contract.title || 'api-service',
      name: contract.title || 'API Service',
      protocol: 'rest',
      description: '',
    },
    sourceType: contract.type === 'postman' ? 'postman' : contract.type === 'har' ? 'har' : 'openapi',
    title: contract.title || 'API Service',
    baseUrl: contract.baseUrl || '',
    operations,
  });
}

module.exports = {
  adaptContractToApiModel,
  mapEndpointToOperation,
};