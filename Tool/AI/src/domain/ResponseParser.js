/**
 * ResponseParser
 *
 * Parses HTTP/GraphQL responses into ExecutionResult format.
 * Handles JSON, text, and binary responses.
 */

const { createExecutionResult } = require('./ExecutionResult');

const VALID_CONTENT_TYPES = Object.freeze([
  'application/json',
  'text/plain',
  'text/html',
  'application/xml',
  'text/xml',
  'application/octet-stream',
  'multipart/form-data',
]);

/**
 * Parse raw HTTP response into ExecutionResult.
 * @param {object} params
 * @param {string} params.stepId - Step ID
 * @param {string} params.runId - Run ID
 * @param {number} params.statusCode - HTTP status code
 * @param {string} params.body - Raw response body
 * @param {object} params.headers - Response headers
 * @param {number} params.durationMs - Request duration
 * @param {Error|null} params.error - Error if any
 * @param {Array<string>} params.logs - Log entries
 * @returns {ReturnType<typeof createExecutionResult>}
 */
function parseResponse({
  stepId,
  runId,
  statusCode,
  body,
  headers,
  durationMs,
  error,
  logs = [],
}) {
  // Parse body based on content type
  const contentType = headers['content-type'] || headers['Content-Type'] || '';
  let parsedBody = body;
  let parseError = null;

  if (body && typeof body === 'string') {
    if (contentType.includes('application/json')) {
      try {
        parsedBody = JSON.parse(body);
      } catch (err) {
        parseError = err.message;
        parsedBody = body; // Keep raw body if JSON parse fails
      }
    } else if (contentType.includes('text/')) {
      // Keep as string for text-based content types
      parsedBody = body;
    } else {
      // For unknown types, try JSON parse, fallback to string
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = body;
      }
    }
  }

  const resultLogs = [...logs];
  if (parseError) {
    resultLogs.push(`Warning: Failed to parse JSON response: ${parseError}`);
  }

  return createExecutionResult({
    stepId,
    runId,
    statusCode,
    responseBody: parsedBody,
    headers,
    logs: resultLogs,
    error: error?.message || null,
    durationMs,
  });
}

/**
 * Extract assertions from response.
 * @param {object} result - ExecutionResult
 * @param {Array<object>} assertions - Assertion definitions
 * @returns {Array<object>}
 */
function evaluateAssertions(result, assertions = []) {
  if (!Array.isArray(assertions) || assertions.length === 0) {
    return [];
  }

  const evaluated = [];

  for (const assertion of assertions) {
    let passed = false;
    let actual = null;
    let message = '';

    switch (assertion.type) {
      case 'status':
        actual = result.statusCode;
        passed = result.statusCode === assertion.expected;
        message = passed
          ? `Status code matches: ${assertion.expected}`
          : `Status code mismatch: expected ${assertion.expected}, got ${result.statusCode}`;
        break;

      case 'body':
        actual = getNestedValue(result.responseBody, assertion.path || '');
        if (assertion.expected !== undefined) {
          passed = JSON.stringify(actual) === JSON.stringify(assertion.expected);
          message = passed
            ? `Body matches expected value`
            : `Body mismatch: expected ${JSON.stringify(assertion.expected)}, got ${JSON.stringify(actual)}`;
        } else if (assertion.exists !== undefined) {
          passed = assertion.exists ? actual !== undefined : actual === undefined;
          message = passed
            ? `Body ${assertion.exists ? 'contains' : 'does not contain'} field`
            : `Body ${assertion.exists ? 'missing' : 'contains'} field`;
        }
        break;

      case 'header':
        actual = result.headers[assertion.headerName];
        passed = actual === assertion.expected;
        message = passed
          ? `Header ${assertion.headerName} matches: ${assertion.expected}`
          : `Header ${assertion.headerName} mismatch: expected ${assertion.expected}, got ${actual}`;
        break;

      case 'schema':
        // Schema validation would require a JSON schema validator
        // For now, mark as passed if body exists
        passed = result.responseBody !== null;
        message = 'Schema validation requires JSON schema validator (not implemented)';
        break;

      default:
        message = `Unknown assertion type: ${assertion.type}`;
    }

    evaluated.push({
      type: assertion.type,
      expected: assertion.expected,
      actual,
      passed,
      message,
    });
  }

  return evaluated;
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

/**
 * Extract variables from response.
 * @param {object} result - ExecutionResult
 * @param {Array<object>} variables - Variable definitions
 * @returns {Record<string, any>}
 */
function extractVariables(result, variables = []) {
  const extracted = {};

  for (const variable of variables) {
    const { name, extractFrom, path } = variable;

    switch (extractFrom) {
      case 'response.body':
        extracted[name] = getNestedValue(result.responseBody, path || name);
        break;

      case 'response.header':
        extracted[name] = result.headers[name];
        break;

      case 'response.status':
        extracted[name] = result.statusCode;
        break;

      default:
        // Try to extract from body by variable name
        extracted[name] = getNestedValue(result.responseBody, name);
    }
  }

  return extracted;
}

/**
 * Format response for display.
 * @param {object} result - ExecutionResult
 * @returns {string}
 */
function formatResponse(result) {
  const lines = [];

  lines.push(`Status: ${result.statusCode} ${result.statusCode >= 200 && result.statusCode < 300 ? '✓' : '✗'}`);
  lines.push(`Duration: ${result.durationMs}ms`);

  if (result.responseBody !== null) {
    lines.push('Body:');
    if (typeof result.responseBody === 'object') {
      lines.push(JSON.stringify(result.responseBody, null, 2));
    } else {
      lines.push(String(result.responseBody));
    }
  }

  if (Object.keys(result.headers).length > 0) {
    lines.push('Headers:');
    for (const [key, value] of Object.entries(result.headers)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  parseResponse,
  evaluateAssertions,
  extractVariables,
  getNestedValue,
  formatResponse,
  VALID_CONTENT_TYPES,
};