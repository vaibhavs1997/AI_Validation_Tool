/**
 * Focused tests for DependencyAwareOrchestrator.
 * Run: node test-execution-DependencyAwareOrchestrator.js
 */

const assert = require('node:assert');
const { createApiModel } = require('./src/domain/ApiModel');
const { buildExecutionPlan } = require('./src/domain/ExecutionPlan');
const { executePlan, prepareRequestForStep, STEP_STATUS } = require('./src/execution/DependencyAwareOrchestrator');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(error && error.message ? error.message : error);
  }
}

const apiModels = [
  createApiModel({
    service: { id: 'auth', name: 'Auth', protocol: 'rest' },
    title: 'Auth API',
    baseUrl: 'https://auth.example.com',
    operations: [
      { id: 'generate-token', method: 'POST', path: '/token', summary: 'Generate token' },
      { id: 'login', method: 'POST', path: '/login', summary: 'Login' },
    ],
  }),
  createApiModel({
    service: { id: 'profile', name: 'Profile', protocol: 'rest' },
    title: 'Profile API',
    baseUrl: 'https://profile.example.com',
    operations: [
      { id: 'update-profile', method: 'POST', path: '/update-profile', summary: 'Update profile' },
    ],
  }),
];

const relationships = [
  {
    type: 'authentication',
    source: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
    target: { serviceId: 'auth', operationId: 'login', location: 'request.header.Authorization' },
    transform: 'Bearer {{value}}',
    status: 'confirmed',
    confidence: 0.9,
  },
  {
    type: 'authentication',
    source: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
    target: { serviceId: 'profile', operationId: 'update-profile', location: 'request.header.Authorization' },
    transform: 'Bearer {{value}}',
    status: 'confirmed',
    confidence: 0.9,
  },
  {
    type: 'data_dependency',
    source: { serviceId: 'auth', operationId: 'login', location: 'response.body.accessToken' },
    target: { serviceId: 'profile', operationId: 'update-profile', location: 'request.body.accessToken' },
    status: 'confirmed',
    confidence: 0.7,
  },
];

async function runAsyncTests() {
  // Test 1: Independent operation executes successfully
  test('independent operation executes with no dependencies', async () => {
    const plan = buildExecutionPlan({
      targetServiceId: 'auth',
      targetOperationId: 'generate-token',
      services: [],
      apiModels,
      relationships: [],
    });

    const mockExecutor = async (req) => ({ body: { token: 'gen-token-123' } });
    const { results } = await executePlan(plan, { auth: apiModels[0] }, { executor: mockExecutor });

    assert.equal(results.length, 1);
    assert.equal(results[0].status, STEP_STATUS.PASSED);
  });

  // Test 2: Chained operations execute in correct order
  test('chained operations execute in plan order', async () => {
    const plan = buildExecutionPlan({
      targetServiceId: 'auth',
      targetOperationId: 'login',
      services: [],
      apiModels,
      relationships: [relationships[0]],
    });

    const callLog = [];
    const mockExecutor = async (req) => {
      callLog.push(req);
      return { body: { token: 'gen-token-123' } };
    };

    const { results } = await executePlan(plan, { auth: apiModels[0] }, { executor: mockExecutor });

    assert.equal(results.length, 2);
    assert.equal(results[0].status, STEP_STATUS.PASSED);
    assert.equal(results[1].status, STEP_STATUS.PASSED);
  });

  // Test 3: Failed prerequisite blocks downstream steps
  test('failed prerequisite blocks downstream operations', async () => {
    const plan = buildExecutionPlan({
      targetServiceId: 'profile',
      targetOperationId: 'update-profile',
      services: [],
      apiModels,
      relationships,
    });

    const callCount = { count: 0 };
    const mockExecutor = async (req) => {
      callCount.count++;
      throw new Error('Network error');
    };

    const { results } = await executePlan(plan, { auth: apiModels[0], profile: apiModels[1] }, { executor: mockExecutor });

    // generate-token fails, login and update-profile should be blocked
    assert.equal(results[0].status, STEP_STATUS.FAILED);
    assert.equal(results[1].status, STEP_STATUS.BLOCKED);
    assert.equal(results[2].status, STEP_STATUS.BLOCKED);
  });

  // Test 4: Middle step failure leaves upstream passed, downstream blocked
  test('middle step failure blocks only downstream steps', async () => {
    const plan = buildExecutionPlan({
      targetServiceId: 'profile',
      targetOperationId: 'update-profile',
      services: [],
      apiModels,
      relationships,
    });

    let callCount = 0;
    const mockExecutor = async (req) => {
      callCount++;
      if (callCount === 1) {
        // generate-token succeeds
        return { body: { token: 'gen-token-123' } };
      }
      // login fails
      throw new Error('Login failed');
    };

    const { results } = await executePlan(plan, { auth: apiModels[0], profile: apiModels[1] }, { executor: mockExecutor });

    assert.equal(results[0].status, STEP_STATUS.PASSED); // generate-token
    assert.equal(results[1].status, STEP_STATUS.FAILED); // login
    assert.equal(results[2].status, STEP_STATUS.BLOCKED); // update-profile
  });

  // Test 5: Dry run skips actual execution
  test('dry run mode skips HTTP calls', async () => {
    const plan = buildExecutionPlan({
      targetServiceId: 'auth',
      targetOperationId: 'generate-token',
      services: [],
      apiModels,
      relationships: [],
    });

    let called = false;
    const { results } = await executePlan(plan, { auth: apiModels[0] }, { dryRun: true, executor: async () => { called = true; } });

    assert.equal(called, false);
    assert.equal(results[0].status, STEP_STATUS.READY);
  });

  // Test 6: prepareRequestForStep applies bindings
  test('prepareRequestForStep injects bindings into request', () => {
    const plan = buildExecutionPlan({
      targetServiceId: 'profile',
      targetOperationId: 'update-profile',
      services: [],
      apiModels,
      relationships,
    });

    const step = plan.steps.find((s) => s.operation.operationId === 'update-profile');
    const ctx = require('./src/domain/RuntimeContext').createRuntimeContext();

    // Simulate stored responses
    ctx.setResponse('auth::generate-token', { body: { token: 'shared-token' } });
    ctx.setResponse('auth::login', { body: { accessToken: 'login-access-token' } });

    // Bind responses to context
    ctx.addBinding({
      relationship: { type: 'authentication', transform: 'Bearer {{value}}' },
      from: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
      to: { serviceId: 'profile', operationId: 'update-profile', location: 'request.header.Authorization' },
    });

    ctx.addBinding({
      relationship: { type: 'data_dependency', transform: '' },
      from: { serviceId: 'auth', operationId: 'login', location: 'response.body.accessToken' },
      to: { serviceId: 'profile', operationId: 'update-profile', location: 'request.body.accessToken' },
    });

    const request = ctx.applyBindings({});

    assert.equal(request.headers.Authorization, 'Bearer shared-token');
    assert.equal(request.body.accessToken, 'login-access-token');
  });

  // Test 7: Invalid plan returns all blocked
  test('invalid plan returns all steps blocked', async () => {
    const invalidPlan = {
      isValid: false,
      errors: ['Circular dependency detected'],
      steps: [
        { order: 0, operation: { serviceId: 'auth', operationId: 'generate-token' } },
      ],
    };

    const { results } = await executePlan(invalidPlan, {});

    assert.equal(results[0].status, STEP_STATUS.BLOCKED);
    assert.ok(results[0].error.includes('invalid'));
  });

  // Test 8: STEP_STATUS constants
  test('STEP_STATUS contains required values', () => {
    assert.equal(STEP_STATUS.PENDING, 'pending');
    assert.equal(STEP_STATUS.READY, 'ready');
    assert.equal(STEP_STATUS.PASSED, 'passed');
    assert.equal(STEP_STATUS.FAILED, 'failed');
    assert.equal(STEP_STATUS.BLOCKED, 'blocked');
  });

  console.log(`\nDependencyAwareOrchestrator tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

runAsyncTests();