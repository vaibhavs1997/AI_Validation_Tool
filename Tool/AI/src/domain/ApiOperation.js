/**
 * ApiOperation
 *
 * Protocol-neutral operation identity.
 * REST uses method + path.
 * Future GraphQL can add operationType + operationName without changing shape.
 */

const REST_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * @param {{ id?: string, protocol?: 'rest'|'graphql', method?: string, path?: string, operationType?: 'query'|'mutation'|'subscription', operationName?: string, summary?: string, description?: string }} input
 * @returns {{ id: string, protocol: string, method?: string, path?: string, operationType?: string, operationName?: string, summary: string, description: string }}
 */
function createApiOperation(input = {}) {
  const protocol = input.protocol === 'graphql' ? 'graphql' : 'rest';
  if (protocol === 'rest') {
    const method = String(input.method || 'GET').toUpperCase();
    if (!REST_METHODS.includes(method)) {
      throw new Error(`ApiOperation method must be one of: ${REST_METHODS.join(', ')}.`);
    }
    if (typeof input.path !== 'string' || input.path.trim().length === 0) {
      throw new Error('ApiOperation path must be a non-empty string for REST.');
    }
  }

  return {
    id: input.id ? String(input.id).trim() : '',
    protocol,
    method: protocol === 'rest' ? String(input.method || 'GET').toUpperCase() : undefined,
    path: protocol === 'rest' ? String(input.path || '').trim() : undefined,
    operationType: protocol === 'graphql' ? String(input.operationType || 'query').toLowerCase() : undefined,
    operationName: protocol === 'graphql' ? String(input.operationName || '').trim() : undefined,
    summary: input.summary ? String(input.summary).trim() : '',
    description: input.description ? String(input.description).trim() : '',
  };
}

module.exports = {
  REST_METHODS,
  createApiOperation,
};