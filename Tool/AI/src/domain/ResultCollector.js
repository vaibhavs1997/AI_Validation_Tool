/**
 * ResultCollector
 *
 * Collects and aggregates execution results from multiple steps.
 * Tracks run status, step status, timing, variables, assertions, and logs.
 */

const { createExecutionResult } = require('./ExecutionResult');

/**
 * Create a new ResultCollector.
 * @param {object} options
 * @param {boolean} options.continueOnFailure - Continue execution even if a step fails
 * @returns {object}
 */
function createResultCollector(options = {}) {
  const continueOnFailure = options.continueOnFailure ?? false;

  return {
    continueOnFailure,
    results: [],
    variablesExtracted: {},
    assertionsPassed: 0,
    assertionsFailed: 0,
    logs: [],
    errors: [],
    startedAt: null,
    completedAt: null,
    durationMs: null,
  };
}

/**
 * Add a step result to the collector.
 * @param {object} collector - ResultCollector instance
 * @param {object} step - ExecutionStep
 * @param {object} result - ExecutionResult
 * @param {Array<object>} variableDefinitions - Variable definitions
 */
function addResult(collector, step, result, variableDefinitions = []) {
  collector.results.push({
    stepId: step.id,
    testId: step.testId,
    title: step.title,
    statusCode: result.statusCode,
    error: result.error,
    durationMs: result.durationMs,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    responseBody: result.responseBody,
    headers: result.headers,
    logs: result.logs,
    assertions: result.assertions || [],
    variablesExtracted: result.variablesExtracted || {},
  });

  // Aggregate logs
  if (result.logs && Array.isArray(result.logs)) {
    collector.logs.push(...result.logs);
  }

  // Track errors
  if (result.error) {
    collector.errors.push({
      stepId: step.id,
      message: result.error,
      timestamp: new Date(),
    });
  }

  // Extract variables
  if (result.variablesExtracted) {
    Object.assign(collector.variablesExtracted, result.variablesExtracted);
  } else if (variableDefinitions.length > 0) {
    const extracted = extractVariablesFromResult(result, variableDefinitions);
    Object.assign(collector.variablesExtracted, extracted);
  }

  // Count assertions
  if (result.assertions && Array.isArray(result.assertions)) {
    for (const assertion of result.assertions) {
      if (assertion.passed) {
        collector.assertionsPassed++;
      } else {
        collector.assertionsFailed++;
      }
    }
  }
}

/**
 * Extract variables from result using definitions.
 * @param {object} result - ExecutionResult
 * @param {Array<object>} variableDefinitions - Variable definitions
 * @returns {Record<string, any>}
 */
function extractVariablesFromResult(result, variableDefinitions = []) {
  const extracted = {};
  const { getNestedValue } = require('./ResponseParser');

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
 * Get execution summary.
 * @param {object} collector - ResultCollector instance
 * @returns {object}
 */
function getExecutionSummary(collector) {
  const totalSteps = collector.results.length;
  const passedSteps = collector.results.filter(r => r.statusCode >= 200 && r.statusCode < 300 && !r.error).length;
  const failedSteps = collector.results.filter(r => r.error || r.statusCode >= 400).length;
  const skippedSteps = collector.results.filter(r => r.statusCode === 0 || r.statusCode === null).length;

  return {
    totalSteps,
    passedSteps,
    failedSteps,
    skippedSteps,
    assertionsPassed: collector.assertionsPassed,
    assertionsFailed: collector.assertionsFailed,
    variablesExtracted: Object.keys(collector.variablesExtracted).length,
    errors: collector.errors.length,
    durationMs: collector.durationMs,
    startedAt: collector.startedAt,
    completedAt: collector.completedAt,
  };
}

/**
 * Finalize the collector.
 * @param {object} collector - ResultCollector instance
 */
function finalize(collector) {
  collector.completedAt = new Date();
  if (collector.startedAt) {
    collector.durationMs = collector.completedAt - collector.startedAt;
  }
}

module.exports = {
  createResultCollector,
  addResult,
  extractVariablesFromResult,
  getExecutionSummary,
  finalize,
};