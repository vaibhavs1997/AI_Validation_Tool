/**
 * RestExecutor
 *
 * Executes REST API requests for resolved execution steps.
 * Uses Node.js built-in http/https modules.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const { createExecutionResult } = require('./ExecutionResult');

const VALID_HTTP_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Execute a REST request.
 * @param {object} resolvedStep - ResolvedExecutionStep
 * @param {object} context - ExecutionContext
 * @param {object} options - Execution options (timeout, retries)
 * @returns {Promise<ReturnType<typeof createExecutionResult>>}
 */
async function executeRestRequest(resolvedStep, context, options = {}) {
  const startTime = Date.now();
  const timeout = options.timeout || context.environment?.timeout || 30000;
  const retries = options.retries ?? context.environment?.retries ?? 3;
  
  const request = resolvedStep.request;
  const method = request.method?.toUpperCase() || 'GET';
  
  if (!VALID_HTTP_METHODS.includes(method)) {
    return createExecutionResult({
      stepId: resolvedStep.id,
      statusCode: 400,
      error: `Invalid HTTP method: ${method}`,
      logs: [`Error: Invalid HTTP method: ${method}`],
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 0,
    });
  }

  // Build URL
  let fullUrl = request.url;
  if (request.queryParams && Object.keys(request.queryParams).length > 0) {
    const urlObj = new URL(fullUrl);
    for (const [key, value] of Object.entries(request.queryParams)) {
      urlObj.searchParams.append(key, value);
    }
    fullUrl = urlObj.toString();
  }

  // Prepare headers
  const headers = { ...request.headers };
  if (context.authentication?.type === 'bearer' && context.authentication.token) {
    headers.Authorization = `Bearer ${context.authentication.token}`;
  } else if (context.authentication?.type === 'basic' && context.authentication.username && context.authentication.password) {
    headers.Authorization = `Basic ${Buffer.from(`${context.authentication.username}:${context.authentication.password}`).toString('base64')}`;
  } else if (context.authentication?.type === 'api-key' && context.authentication.apiKey) {
    const headerName = context.authentication.apiKeyHeader || 'X-API-Key';
    headers[headerName] = context.authentication.apiKey;
  }

  // Prepare body
  let body = null;
  if (['POST', 'PUT', 'PATCH'].includes(method) && request.body) {
    if (request.headers?.['Content-Type']?.includes('application/json')) {
      body = JSON.stringify(request.body);
      headers['Content-Type'] = 'application/json';
    } else if (request.headers?.['Content-Type']?.includes('application/x-www-form-urlencoded')) {
      body = new URLSearchParams(request.body).toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else {
      body = JSON.stringify(request.body);
    }
  }

  const logs = [];
  logs.push(`${method} ${fullUrl}`);

  // Execute with retry
  let lastError = null;
  let lastStatusCode = null;
  let lastResponseBody = null;
  let lastHeaders = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await executeWithTimeout(fullUrl, method, headers, body, timeout, context.environment?.dryRun);
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

  // Parse response body
  let parsedBody = lastResponseBody;
  if (lastResponseBody && typeof lastResponseBody === 'string') {
    try {
      parsedBody = JSON.parse(lastResponseBody);
    } catch {
      // Keep as string if not JSON
    }
  }

  return createExecutionResult({
    stepId: resolvedStep.id,
    runId: resolvedStep.runId,
    statusCode: lastStatusCode,
    responseBody: parsedBody,
    headers: lastHeaders || {},
    logs,
    error: lastError?.message || null,
    startedAt: new Date(startTime),
    completedAt,
    durationMs,
  });
}

/**
 * Execute HTTP request with timeout.
 */
function executeWithTimeout(url, method, headers, body, timeout, dryRun) {
  return new Promise((resolve, reject) => {
    if (dryRun) {
      resolve({
        statusCode: 200,
        statusMessage: 'OK (dry run)',
        body: JSON.stringify({ message: 'Dry run successful' }),
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
      method,
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

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  executeRestRequest,
  VALID_HTTP_METHODS,
};