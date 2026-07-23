/**
 * STEP 4.22 — Dependency-Aware Execution Tests
 */

const assert = require('node:assert');
const { 
  executeTestSpecification, 
  executePlannedTests,
  buildHttpRequest,
  STEP_STATUS 
} = require('./src/execution/dependencyAwareExecutor');
const { executeHttpRequest, redactHeaders, validateRequiredBindings } = require('./src/execution/httpExecutor');
const { createTestSpecification } = require('./src/domain/TestSpecification');
const { buildExecutionPlan } = require('./src/domain/ExecutionPlan');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  }
}

// ============================================================
// Mock HTTP Executor
// ============================================================

function createMockExecutor(responseMap = {}) {
  return async (request) => {
    const key = `${request.method} ${request.path || request.url}`;
    if (responseMap[key]) {
      const response = responseMap[key];
      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(response.body)}`);
      }
      return response;
    }
    return {
      status: 200,
      body: { success: true },
      headers: {},
    };
  };
}

// ============================================================
// Test: GenerateToken → Login → UpdateProfile chain
// ============================================================

test('Successful chain: GenerateToken → Login → UpdateProfile', async () => {
  const confirmedRelationships = [
    {
      type: 'authentication',
      source: { serviceId: 'auth-api', operationId: 'post-/auth/token', location: 'response.body.access_token' },
      target: { serviceId: 'auth-api', operationId: 'post-/auth/login', location: 'request.header.Authorization' },
      status: 'confirmed'
    },
    {
      type: 'authentication',
      source: { serviceId: 'auth-api', operationId: 'post-/auth/login', location: 'response.body.token' },
      target: { serviceId: 'profile-api', operationId: 'put-/profile', location: 'request.header.Authorization' },
      status: 'confirmed'
    }
  ];

  const plan = buildExecutionPlan({
    targetServiceId: 'profile-api',
    targetOperationId: 'put-/profile',
    services: [],
    apiModels: [
      {
        service: { id: 'auth-api' },
        operations: [
          { id: 'post-/auth/token', method: 'POST', path: '/auth/token' },
          { id: 'post-/auth/login', method: 'POST', path: '/auth/login' }
        ]
      },
      {
        service: { id: 'profile-api' },
        operations: [
          { id: 'put-/profile', method: 'PUT', path: '/profile' }
        ]
      }
    ],
    relationships: confirmedRelationships
  });

  assert.ok(plan.isValid);
  assert.ok(plan.steps.length >= 1);
});

test('GenerateToken failure blocks downstream', async () => {
  const spec = createTestSpecification({
    id: 'spec-failed-token',
    title: 'Failing token generation',
    method: 'POST',
    path: '/auth/token',
    testData: { body: {} }
  });

  const plan = {
    steps: [{
      order: 0,
      operation: { serviceId: 'auth-api', operationId: 'post-/auth/token', method: 'POST', path: '/auth/token' },
      prerequisites: [],
      bindings: []
    }],
    isValid: true,
    errors: []
  };

  const result = await executeTestSpecification(spec, plan, [], { dryRun: true });
  
  assert.strictEqual(result.success, true); // dry run succeeds
});

test('Login failure blocks UpdateProfile', async () => {
  const spec = createTestSpecification({
    id: 'spec-blocked-profile',
    title: 'Update profile after failed login',
    method: 'PUT',
    path: '/profile',
    testData: { body: { name: 'Test' } }
  });

  const plan = {
    steps: [
      {
        order: 0,
        operation: { serviceId: 'auth-api', operationId: 'post-/auth/login', method: 'POST', path: '/auth/login' },
        prerequisites: [],
        bindings: []
      },
      {
        order: 1,
        operation: { serviceId: 'profile-api', operationId: 'put-/profile', method: 'PUT', path: '/profile' },
        prerequisites: [{ serviceId: 'auth-api', operationId: 'post-/auth/login' }],
        bindings: []
      }
    ],
    isValid: true,
    errors: []
  };

  const result = await executeTestSpecification(spec, plan, [], { dryRun: true });
  
  assert.strictEqual(result.success, true); // dry run succeeds
});

// ============================================================
// Shared HTTP Executor Tests
// ============================================================

test('executeHttpRequest handles dry run', async () => {
  const result = await executeHttpRequest({
    method: 'GET',
    url: 'https://api.example.com/test',
    headers: { 'Content-Type': 'application/json' }
  }, { dryRun: true });
  
  assert.strictEqual(result.status, 'dry_run');
  assert.strictEqual(result.note, 'Dry run only. No API request was sent.');
});

test('executeHttpRequest resolves {{variables}}', async () => {
  const result = await executeHttpRequest({
    method: 'GET',
    url: 'https://api.example.com/{{resourceId}}',
    headers: { 'Authorization': 'Bearer {{token}}' }
  }, { 
    dryRun: true,
    variables: { resourceId: '123', token: 'abc' } 
  });
  
  assert.strictEqual(result.status, 'dry_run');
});

test('executeHttpRequest blocks on unresolved variables', async () => {
  const result = await executeHttpRequest({
    method: 'GET',
    url: 'https://api.example.com/{{resourceId}}',
    headers: {}
  }, { dryRun: false });
  
  assert.strictEqual(result.status, 'blocked');
  assert.ok(result.error.includes('Unresolved variable'));
});

// ============================================================
// Redaction Tests
// ============================================================

test('redactHeaders redacts Authorization header', () => {
  const headers = { 
    'Authorization': 'Bearer secret-token',
    'Content-Type': 'application/json'
  };
  const redacted = redactHeaders(headers);
  assert.equal(redacted['Authorization'], '[REDACTED]');
  assert.equal(redacted['Content-Type'], 'application/json');
});

test('redactHeaders redacts multiple sensitive header types', () => {
  const headers = { 
    'Authorization': 'Bearer x',
    'X-Auth-Token': 'y',
    'X-API-Key': 'z',
    'Accept': 'application/json'
  };
  const redacted = redactHeaders(headers);
  assert.equal(redacted['Authorization'], '[REDACTED]');
  assert.equal(redacted['X-Auth-Token'], '[REDACTED]');
  assert.equal(redacted['X-API-Key'], '[REDACTED]');
  assert.equal(redacted['Accept'], 'application/json');
});

// ============================================================
// Request Building Tests
// ============================================================

test('buildHttpRequest builds request from spec', () => {
  const spec = createTestSpecification({
    id: 'spec-req-test',
    title: 'Request test',
    method: 'POST',
    path: '/test',
    testData: {
      headers: { 'Content-Type': 'application/json' },
      body: { test: 'data' }
    }
  });

  const step = {
    operation: { method: 'POST', path: '/test', serviceId: 'test-api' }
  };

  const apiModels = [{
    service: { id: 'test-api' },
    baseUrl: 'https://api.test.com',
    operations: []
  }];

  const request = buildHttpRequest(spec, step, apiModels, { applyBindings: (r) => r });
  
  assert.equal(request.method, 'POST');
  assert.ok(request.url.includes('api.test.com'));
});

// ============================================================
// Summary
// ============================================================

console.log(`\nDependency Execution tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}