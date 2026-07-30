/**
 * AuthenticationResolver
 *
 * Injects authentication into resolved requests.
 * Supports bearer, basic, API key, and OAuth2 authentication.
 */

const AUTH_TYPES = Object.freeze(['none', 'bearer', 'basic', 'api-key', 'oauth2']);

/**
 * Resolve authentication for a step.
 * @param {object} resolvedStep - ResolvedExecutionStep
 * @param {object} context - ExecutionContext
 * @returns {object} Resolved step with authentication injected
 */
function resolveAuthentication(resolvedStep, context) {
  if (!resolvedStep || !resolvedStep.request) {
    return resolvedStep;
  }

  const auth = context.authentication || {};
  const authRequired = resolvedStep.authenticationRequired !== false;

  if (!authRequired || auth.type === 'none') {
    return resolvedStep;
  }

  const resolved = { ...resolvedStep };
  resolved.request = { ...resolved.request };
  resolved.request.headers = { ...resolved.request.headers };

  // Inject authentication
  const headers = getAuthHeaders(auth);
  Object.assign(resolved.request.headers, headers);

  return resolved;
}

/**
 * Get authentication headers.
 * @param {object} auth - Authentication context
 * @returns {Record<string, string>} Headers to inject
 */
function getAuthHeaders(auth) {
  const { type, token, username, password, apiKey, apiKeyHeader } = auth;

  switch (type) {
    case 'bearer':
      if (!token) return {};
      return { Authorization: `Bearer ${token}` };

    case 'basic':
      if (!username || !password) return {};
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      return { Authorization: `Basic ${credentials}` };

    case 'api-key':
      if (!apiKey) return {};
      const headerName = apiKeyHeader || 'X-API-Key';
      return { [headerName]: apiKey };

    case 'oauth2':
      if (!token) return {};
      return { Authorization: `Bearer ${token}` };

    case 'none':
    default:
      return {};
  }
}

module.exports = {
  resolveAuthentication,
  getAuthHeaders,
  AUTH_TYPES,
};