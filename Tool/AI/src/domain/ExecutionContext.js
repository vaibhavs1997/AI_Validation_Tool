/**
 * ExecutionContext
 *
 * Domain model for the execution context.
 * Contains authentication, environment, and variables needed for test execution.
 */

const VALID_AUTH_TYPES = Object.freeze(['none', 'bearer', 'basic', 'api-key', 'oauth2']);

/**
 * @param {{
 *   type?: string,
 *   token?: string,
 *   username?: string,
 *   password?: string,
 *   apiKey?: string,
 *   apiKeyHeader?: string,
 *   expiresAt?: Date|string,
 * }} input
 * @returns {{
 *   type: string,
 *   token: string|null,
 *   username: string|null,
 *   password: string|null,
 *   apiKey: string|null,
 *   apiKeyHeader: string|null,
 *   expiresAt: Date|null,
 * }}
 */
function createAuthentication(input = {}) {
  const type = String(input.type || 'none').toLowerCase();
  if (!VALID_AUTH_TYPES.includes(type)) {
    throw new Error(`Authentication type must be one of: ${VALID_AUTH_TYPES.join(', ')}`);
  }

  return {
    type,
    token: input.token ? String(input.token) : null,
    username: input.username ? String(input.username) : null,
    password: input.password ? String(input.password) : null,
    apiKey: input.apiKey ? String(input.apiKey) : null,
    apiKeyHeader: input.apiKeyHeader ? String(input.apiKeyHeader).trim() : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  };
}

/**
 * @param {{
 *   baseUrl?: string,
 *   headers?: Record<string, string>,
 *   timeout?: number,
 *   retries?: number,
 *   dryRun?: boolean,
 * }} input
 * @returns {{
 *   baseUrl: string,
 *   headers: Record<string, string>,
 *   timeout: number,
 *   retries: number,
 *   dryRun: boolean,
 * }}
 */
function createEnvironment(input = {}) {
  return {
    baseUrl: input.baseUrl ? String(input.baseUrl).trim() : 'http://localhost:3000',
    headers: input.headers && typeof input.headers === 'object' ? { ...input.headers } : {},
    timeout: typeof input.timeout === 'number' && input.timeout > 0 ? input.timeout : 30000,
    retries: typeof input.retries === 'number' && input.retries >= 0 ? input.retries : 3,
    dryRun: Boolean(input.dryRun),
  };
}

/**
 * @param {{
 *   name?: string,
 *   source?: 'step' | 'environment' | 'user',
 *   stepId?: string,
 *   extractFrom?: 'response.body' | 'response.header' | 'response.status',
 *   defaultValue?: any,
 * }} input
 * @returns {{
 *   name: string,
 *   source: string,
 *   stepId: string|null,
 *   extractFrom: string,
 *   defaultValue: any,
 * }}
 */
function createVariableDefinition(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) {
    throw new Error('Variable name must be a non-empty string.');
  }

  const source = String(input.source || 'step').toLowerCase();
  if (!['step', 'environment', 'user'].includes(source)) {
    throw new Error('Variable source must be one of: step, environment, user');
  }

  const extractFrom = String(input.extractFrom || 'response.body').toLowerCase();
  if (!['response.body', 'response.header', 'response.status'].includes(extractFrom)) {
    throw new Error('Variable extractFrom must be one of: response.body, response.header, response.status');
  }

  return {
    name,
    source,
    stepId: input.stepId ? String(input.stepId) : null,
    extractFrom,
    defaultValue: input.defaultValue !== undefined ? input.defaultValue : null,
  };
}

/**
 * Main ExecutionContext factory.
 * @param {{
 *   authentication?: object,
 *   environment?: object,
 *   variables?: Record<string, any>,
 * }} input
 * @returns {{
 *   authentication: ReturnType<typeof createAuthentication>,
 *   environment: ReturnType<typeof createEnvironment>,
 *   variables: Record<string, any>,
 * }}
 */
function createExecutionContext(input = {}) {
  return {
    authentication: createAuthentication(input.authentication || {}),
    environment: createEnvironment(input.environment || {}),
    variables: input.variables && typeof input.variables === 'object' ? { ...input.variables } : {},
  };
}

/**
 * Substitute variables in a string value using {{var}} syntax.
 * @param {string} value
 * @param {Record<string, any>} variables
 * @returns {string}
 */
function substituteVariables(value, variables) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    return varName in variables ? String(variables[varName]) : _;
  });
}

module.exports = {
  createExecutionContext,
  createAuthentication,
  createEnvironment,
  createVariableDefinition,
  substituteVariables,
  VALID_AUTH_TYPES,
};