/**
 * VariableResolver
 *
 * Resolves variables from environment, user input, and previous step results.
 * Supports {{variable}} syntax substitution.
 */

const { substituteVariables } = require('./ExecutionContext');

/**
 * Resolve all variables for a step.
 * @param {object} step - ExecutionStep
 * @param {object} userVariables - User-provided variables
 * @param {Array<object>} previousResults - Results from previous steps
 * @returns {object} Resolved step with substituted variables
 */
function resolveVariables(step, userVariables = {}, previousResults = []) {
  if (!step) {
    return step;
  }

  const resolved = { ...step };

  // Build variable context
  const variableContext = { ...userVariables };

  // Extract variables from previous step results
  for (const result of previousResults) {
    if (result.variablesExtracted) {
      Object.assign(variableContext, result.variablesExtracted);
    }
  }

  // Add variables produced by the step itself (for forward references in same step)
  if (step.variablesProduced) {
    for (const varName of step.variablesProduced) {
      if (!(varName in variableContext)) {
        variableContext[varName] = `__${varName}__`;
      }
    }
  }

  // Substitute variables in request URL
  if (resolved.request?.url) {
    resolved.request = {
      ...resolved.request,
      url: substituteVariables(resolved.request.url, variableContext),
    };
  }

  // Substitute variables in headers
  if (resolved.request?.headers) {
    const resolvedHeaders = {};
    for (const [key, value] of Object.entries(resolved.request.headers)) {
      resolvedHeaders[key] = substituteVariables(value, variableContext);
    }
    resolved.request = {
      ...resolved.request,
      headers: resolvedHeaders,
    };
  }

  // Substitute variables in body
  if (resolved.request?.body) {
    resolved.request = {
      ...resolved.request,
      body: substituteVariablesInObject(resolved.request.body, variableContext),
    };
  }

  // Substitute variables in query params
  if (resolved.request?.queryParams) {
    const resolvedQueryParams = {};
    for (const [key, value] of Object.entries(resolved.request.queryParams)) {
      resolvedQueryParams[key] = substituteVariables(value, variableContext);
    }
    resolved.request = {
      ...resolved.request,
      queryParams: resolvedQueryParams,
    };
  }

  return resolved;
}

/**
 * Substitute variables in an object (recursive).
 * @param {any} obj - Object to process
 * @param {Record<string, any>} variables - Variable context
 * @returns {any}
 */
function substituteVariablesInObject(obj, variables) {
  if (typeof obj === 'string') {
    return substituteVariables(obj, variables);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => substituteVariablesInObject(item, variables));
  }

  if (obj && typeof obj === 'object') {
    const resolved = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = substituteVariablesInObject(value, variables);
    }
    return resolved;
  }

  return obj;
}

/**
 * Validate that all required variables are available.
 * @param {object} step - ExecutionStep
 * @param {Record<string, any>} availableVariables - Available variables
 * @returns {{ valid: boolean, missingVariables: string[] }}
 */
function validateVariables(step, availableVariables = {}) {
  const required = step.variablesRequired || [];
  const missing = required.filter(varName => !(varName in availableVariables));

  return {
    valid: missing.length === 0,
    missingVariables: missing,
  };
}

/**
 * Get list of missing variables.
 * @param {object} step - ExecutionStep
 * @param {Record<string, any>} availableVariables - Available variables
 * @returns {string[]} List of missing variable names
 */
function getMissingVariables(step, availableVariables = {}) {
  return validateVariables(step, availableVariables).missingVariables;
}

/**
 * Extract variables from execution result.
 * @param {object} result - ExecutionResult
 * @param {Array<object>} variableDefinitions - Variable definitions
 * @returns {Record<string, any>}
 */
function extractVariables(result, variableDefinitions = []) {
  const extracted = {};

  for (const varDef of variableDefinitions) {
    const { name, extractFrom, path } = varDef;

    let value;
    switch (extractFrom) {
      case 'response.body':
        value = getNestedValue(result.responseBody, path || name);
        break;
      case 'response.header':
        value = result.headers[path || name];
        break;
      case 'response.status':
        value = result.statusCode;
        break;
      default:
        value = getNestedValue(result.responseBody, name);
    }

    if (value !== undefined) {
      extracted[name] = value;
    }
  }

  return extracted;
}

/**
 * Get nested value from object using dot notation.
 * @param {object} obj
 * @param {string} path
 * @returns {any}
 */
function getNestedValue(obj, path) {
  if (!path || path === '') {
    return obj;
  }

  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

module.exports = {
  resolveVariables,
  validateVariables,
  getMissingVariables,
  extractVariables,
  getNestedValue,
};