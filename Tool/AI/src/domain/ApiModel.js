/**
 * ApiModel
 *
 * Canonical API definition for a service.
 */

const { createServiceDefinition } = require('./ServiceDefinition');
const { createApiOperation } = require('./ApiOperation');

/**
 * @param {{ service?: { id?: string, name?: string, protocol?: 'rest'|'graphql', description?: string }, sourceType?: 'openapi'|'postman'|'har', title?: string, baseUrl?: string, operations: Array<{ id?: string, method?: string, path?: string, protocol?: 'rest'|'graphql', operationType?: string, operationName?: string, summary?: string, description?: string }> }} input
 * @returns {{ service: { id: string, name: string, protocol: string, description: string }, sourceType: string, title: string, baseUrl: string, operations: Array<{ id: string, protocol: string, method?: string, path?: string, operationType?: string, operationName?: string, summary: string, description: string }> }}
 */
function createApiModel(input = {}) {
  const service = createServiceDefinition({
    id: input.service?.id || input.title || 'api-service',
    name: input.service?.name || input.title || 'API Service',
    protocol: input.service?.protocol || 'rest',
    description: input.service?.description || '',
  });

  const operations = (input.operations || []).map((operation) =>
    createApiOperation({
      ...operation,
      protocol: operation.protocol || service.protocol,
    })
  );

  return {
    service,
    sourceType: input.sourceType || 'openapi',
    title: input.title || service.name,
    baseUrl: input.baseUrl || '',
    operations,
  };
}

module.exports = {
  createApiModel,
};