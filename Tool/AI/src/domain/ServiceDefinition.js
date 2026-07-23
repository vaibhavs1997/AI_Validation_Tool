/**
 * ServiceDefinition
 *
 * Canonical model for a project's API service.
 */

const PROTOCOLS = Object.freeze(['rest', 'graphql']);

/**
 * @param {{ id: string, name: string, protocol: 'rest'|'graphql', description?: string }} input
 * @returns {{ id: string, name: string, protocol: string, description: string }}
 */
function createServiceDefinition(input) {
  if (!input || typeof input.id !== 'string' || input.id.trim().length === 0) {
    throw new Error('ServiceDefinition id must be a non-empty string.');
  }
  if (!input || typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new Error('ServiceDefinition name must be a non-empty string.');
  }
  const protocol = String(input.protocol || 'rest').toLowerCase();
  if (!PROTOCOLS.includes(protocol)) {
    throw new Error(`ServiceDefinition protocol must be one of: ${PROTOCOLS.join(', ')}.`);
  }

  return {
    id: input.id.trim(),
    name: input.name.trim(),
    protocol,
    description: input.description ? String(input.description).trim() : '',
  };
}

module.exports = {
  createServiceDefinition,
  PROTOCOLS,
};