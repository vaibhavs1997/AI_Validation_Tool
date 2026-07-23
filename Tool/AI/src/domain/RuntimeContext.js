/**
 * RuntimeContext
 *
 * Deterministic runtime value-binding layer.
 * Extracts values from completed API responses and injects them into downstream requests
 * using confirmed dependency mappings.
 */

/**
 * Parse location strings into structured path info.
 * Format: <kind>.<target>.<path...> where kind is response|request and target is header|body|query|path
 */
function parseLocation(location) {
  if (!location || typeof location !== 'string') return null;
  const trimmed = location.trim();
  if (!trimmed.includes('.')) return null;

  const [kind, ...rest] = trimmed.split('.');
  if (!['response', 'request'].includes(kind.toLowerCase())) return null;

  const requestTarget = rest[0].toLowerCase();
  if (!['header', 'body', 'query', 'path'].includes(requestTarget)) return null;

  const path = rest.slice(1);
  if (path.length === 0) return null;

  return { kind: kind.toLowerCase(), requestTarget, path };
}

/**
 * Extract a value from an object using a location path.
 * For response locations (e.g., "response.body.token"), extracts from the given object.
 */
function extractValue(obj, location) {
  if (obj === undefined || obj === null) return undefined;
  const parts = parseLocation(location);
  if (!parts) return undefined;

  let current = obj;
  // For response locations, the "target" (header/body/query/path) is a container within the response
  // For request locations, we only use this when extracting from response
  if (parts.kind === 'response' && current[parts.requestTarget] !== undefined) {
    current = current[parts.requestTarget];
  }

  for (const segment of parts.path) {
    if (current === undefined || current === null) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * Transform a value using a transform template.
 * Replaces {{value}} placeholder with the actual value.
 */
function transformValue(value, transform) {
  if (!transform || typeof transform !== 'string') return String(value);
  const trimmed = transform.trim();
  if (!trimmed) return String(value);
  return trimmed.replace(/\{\{value\}\}/gi, String(value));
}

/**
 * Inject a value into a target request object using a location path.
 * For request locations (e.g., "request.header.Authorization"), injects into the appropriate container.
 */
function injectValue(target, location, value) {
  if (!location || value === undefined) return target;
  const parts = parseLocation(location);
  if (!parts) return target;

  let current = target;
  // For request locations, navigate to the container (headers/body/query/path)
  if (parts.kind === 'request') {
    const container = parts.requestTarget === 'header' ? 'headers' : parts.requestTarget;
    if (current[container] === undefined) current[container] = {};
    current = current[container];
  }

  // Navigate to the final location
  for (let i = 0; i < parts.path.length - 1; i++) {
    const key = parts.path[i];
    if (current[key] === undefined) current[key] = {};
    current = current[key];
  }

  const finalKey = parts.path[parts.path.length - 1];
  current[finalKey] = value;

  return target;
}

/**
 * Resolve a value from stored responses.
 */
function resolveValue(location, sourceRef, responses) {
  if (!location || !sourceRef) return undefined;
  const sourceResponse = responses.get(`${sourceRef.serviceId}::${sourceRef.operationId}`);
  if (sourceResponse === undefined || sourceResponse === null) return undefined;
  return extractValue(sourceResponse, location);
}

/**
 * Create a RuntimeContext instance.
 */
function createRuntimeContext(options = {}) {
  const responses = new Map(options.responses || []);
  const bindings = Array.isArray(options.bindings) ? [...options.bindings] : [];

  return {
    responses,
    bindings,

    setResponse(operationKey, response) {
      responses.set(String(operationKey), response);
    },

    getResponse(operationKey) {
      return responses.get(String(operationKey));
    },

    addBinding(mapping) {
      if (!mapping || !mapping.relationship || !mapping.from || !mapping.to) {
        throw new Error('Invalid binding mapping.');
      }
      bindings.push({
        relationship: {
          type: mapping.relationship.type,
          source: { ...mapping.relationship.source },
          target: { ...mapping.relationship.target },
          transform: mapping.relationship.transform || '',
          confidence: mapping.relationship.confidence,
        },
        from: { ...mapping.from },
        to: { ...mapping.to },
      });
    },

    applyBindings(request) {
      const result = JSON.parse(JSON.stringify(request || {}));
      for (const binding of bindings) {
        const value = resolveValue(binding.from.location, binding.from, responses);
        if (value === undefined) continue;
        const transformed = transformValue(value, binding.relationship.transform);
        injectValue(result, binding.to.location, transformed);
      }
      return result;
    },

    clear() {
      responses.clear();
      bindings.length = 0;
    },
  };
}

module.exports = {
  createRuntimeContext,
  extractValue,
  transformValue,
  injectValue,
  parseLocation,
  resolveValue,
};