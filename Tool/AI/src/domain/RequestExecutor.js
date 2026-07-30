/**
 * RequestExecutor
 *
 * Base interface and factory for HTTP/GraphQL executors.
 * Executes a single ResolvedExecutionStep and returns an ExecutionResult.
 */

const { createExecutionResult } = require('./ExecutionResult');

const VALID_HTTP_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Abstract base executor class.
 * Subclasses must implement execute().
 */
class BaseExecutor {
  /**
   * Execute a resolved step.
   * @param {object} resolvedStep - ResolvedExecutionStep
   * @param {object} context - ExecutionContext
   * @returns {Promise<ReturnType<typeof createExecutionResult>>}
   */
  async execute(resolvedStep, context) {
    throw new Error('execute() must be implemented by subclass.');
  }

  /**
   * Build request metadata for logging.
   * @param {object} resolvedStep
   * @returns {object}
   */
  buildRequestMetadata(resolvedStep) {
    return {
      method: resolvedStep.request.method,
      url: resolvedStep.request.url,
      headers: resolvedStep.request.headers,
      body: resolvedStep.request.body,
      queryParams: resolvedStep.request.queryParams,
    };
  }
}

/**
 * Factory function to get the appropriate executor for a step.
 * @param {object} resolvedStep
 * @returns {BaseExecutor}
 */
function getExecutor(resolvedStep) {
  const operationType = resolvedStep.operationRef?.operationId?.toLowerCase() || '';

  // Detect GraphQL operations by common naming conventions
  if (operationType.includes('graphql') || operationType.includes('query') || operationType.includes('mutation')) {
    return new GraphQLExecutor();
  }

  // Default to REST executor
  return new RestExecutor();
}

module.exports = {
  BaseExecutor,
  getExecutor,
  VALID_HTTP_METHODS,
};