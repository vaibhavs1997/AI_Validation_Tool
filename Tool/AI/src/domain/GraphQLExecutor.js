/**
 * GraphQLExecutor
 *
 * Executes GraphQL queries and mutations for resolved execution steps.
 * Uses Node.js built-in http/https modules.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { createExecutionResult } = require('./ExecutionResult');

const VALID_OPERATION_TYPES = Object.freeze(['query', 'mutation']);

/**
 * Execute a GraphQL request.
 * @param {object} resolvedStep - ResolvedExecutionStep
 * @param {object} context - ExecutionContext
 * @param {object} options - Execution options (timeout, retries)
 * @returns {Promise<ReturnType<typeof createExecutionResult>>}
 */
async function executeGraphQLRequest(resolvedStep, context, options = {}) {
  const startTime = Date.now();
  const timeout = options.timeout || context.environment?.timeout || 30000;
  const retries = options.retries ?? context.environment?.retries ?? 3;

  const request = resolvedStep.request;
  
  // Extract GraphQL details from request
  const operationName = request.operationName || null;
  const query = request.query || '';
  const variables = request.variables || {};

  if (!query.trim()) {
    return createExecutionResult({
      stepId: resolvedStep.id,
      runId: resolvedStep.runId,
      statusCode: 400,
      error: 'GraphQL query/mutation is required.',
      logs: ['Error: GraphQL query/mutation is required.'],
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 0,
    });
  }

  // Build GraphQL payload
  const payload = {
    query,
    variables,
    ...(operationName && { operationName }),
  };

  const logs = [];
  logs.push(`GraphQL ${operationName || 'anonymous'}: ${query.split('\n')[0].substring(0, 50)}...`);

  // Determine endpoint URL
  let endpointUrl = request.url;
  if (request.queryParams && Object.keys(request.queryParams).length > 0) {
    const urlObj = new URL(endpointUrl);
    for (const [key, value] of Object.entries(request.queryParams)) {
      urlObj.searchParams.append(key, value);
    }
    endpointUrl = urlObj.toString();
  }

  // Prepare headers
  const headers = {
    'Content-Type': 'application/json',
    ...request.headers,
  };

  // Inject authentication
  if (context.authentication?.type === 'bearer' && context.authentication.token) {
    headers.Authorization = `Bearer ${context.authentication.token}`;
  } else if (context.authentication?.type === 'basic' && context.authentication.username && context.authentication.password) {
    headers.Authorization = `Basic ${Buffer.from(`${context.authentication.username}:${context.authentication.password}`).toString('base64')}`;
  } else if (context.authentication?.type === 'api-key' && context.authentication.apiKey) {
    const headerName = context.authentication.apiKeyHeader || 'X-API-Key';
    headers[headerName] = context.authentication.apiKey;
  }

  // Execute with retry
  let lastError = null;
  let lastStatusCode = null;
  let lastResponseBody = null;
  let lastHeaders = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await executePostWithTimeout(endpointUrl, JSON.stringify(payload), headers, timeout, context.environment?.dryRun);
      lastStatusCode = result.statusCode;
      lastResponseBody = result.body;
      lastHeaders = result.headers;

      logs.push(`Attempt ${attempt}: ${result.statusCode} ${result.statusMessage}`);

      // Don't retry client errors (4xx) unless explicitly configured
      if (result.statusCode >= 400 && result.statusCode < 500 && !options.retryOnClientError) {
        break;
      }

      // Retry on 5xx errors
      if (result.statusCode < 500) {
        break;
      }

      lastError = new Error(`HTTP ${result.statusCode}: ${result.statusMessage}`);
    } catch (error) {
      lastError = error;
      logs.push(`Attempt ${attempt} failed: ${error.message}`);

      if (attempt === retries) {
        break;
      }

      // Exponential backoff
      const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await sleep(backoff);
    }
  }

  const completedAt = new Date();
  const durationMs = Date.now() - startTime;

  // Parse response
  let parsedBody = null;
  let graphQLError = null;

  if (lastResponseBody && typeof lastResponseBody === 'string') {
    try {
      parsedBody = JSON.parse(lastResponseBody);

      // Check for GraphQL errors
      if (parsedBody.errors && Array.isArray(parsedBody.errors) && parsedBody.errors.length > 0) {
        graphQLError = parsedBody.errors.map(e => e.message || 'GraphQL error').join('; ');
        logs.push(`GraphQL errors: ${graphQLError}`);
      }
    } catch {
      parsedBody = lastResponseBody;
    }
  }

  // Determine if request was successful
  const success = lastStatusCode >= 200 && lastStatusCode < 300 && !graphQLError;
  const finalStatusCode = success ? 200 : lastStatusCode;

  return createExecutionResult({
    stepId: resolvedStep.id,
    runId: resolvedStep.runId,
    statusCode: finalStatusCode,
    responseBody: parsedBody,
    headers: lastHeaders || {},
    logs,
    error: lastError?.message || graphQLError || (success ? null : 'GraphQL request failed'),
    startedAt: new Date(startTime),
    completedAt,
    durationMs,
  });
}

/**
 * Execute POST request with timeout (for GraphQL).
 */
function executePostWithTimeout(url, bodyString, headers, timeout, dryRun) {
  return new Promise((resolve, reject) => {
    if (dryRun) {
      resolve({
        statusCode: 200,
        statusMessage: 'OK (dry run)',
        body: JSON.stringify({ data: { dryRun: true } }),
        headers: { 'content-type': 'application/json' },
      });
      return;
    }

    const urlObj = new URL(url);
    const transport = urlObj.protocol === 'https:' ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers,
      timeout,
    };

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          body,
          headers: res.headers,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    req.write(bodyString);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  executeGraphQLRequest,
  VALID_OPERATION_TYPES,
};