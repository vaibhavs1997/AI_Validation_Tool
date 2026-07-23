/**
 * Focused tests for ExecutionPlan.
 * Run: node test-domain-ExecutionPlan.js
 */

const assert = require('node:assert');
const { createApiModel } = require('./src/domain/ApiModel');
const { buildExecutionPlan, validatePlan } = require('./src/domain/ExecutionPlan');

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

function assertEqual(actual, expected) {
  assert.strictEqual(actual, expected);
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

test('independent operation creates single-step plan', () => {
  const plan = buildExecutionPlan({
    targetServiceId: 'auth',
    targetOperationId: 'generate-token',
    services: [],
    apiModels,
    relationships: [],
  });

  assert.ok(plan.isValid);
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].operation.operationId, 'generate-token');
  assert.equal(plan.steps[0].prerequisites.length, 0);
});

test('chained operations create ordered steps', () => {
  const plan = buildExecutionPlan({
    targetServiceId: 'auth',
    targetOperationId: 'login',
    services: [],
    apiModels,
    relationships: [relationships[0]],
  });

  assert.ok(plan.isValid);
  assert.equal(plan.steps.length, 2);
  const order0 = plan.steps[0].operation.operationId;
  const order1 = plan.steps[1].operation.operationId;
  assert.ok(order0 === 'generate-token' && order1 === 'login');
});

test('multiple dependencies into one operation', () => {
  const plan = buildExecutionPlan({
    targetServiceId: 'profile',
    targetOperationId: 'update-profile',
    services: [],
    apiModels,
    relationships,
  });

  assert.ok(plan.isValid);
  assert.equal(plan.steps.length, 3);

  const updateProfileStep = plan.steps.find((s) => s.operation.operationId === 'update-profile');
  assert.ok(updateProfileStep);
  assert.equal(updateProfileStep.prerequisites.length, 2);
  assert.equal(updateProfileStep.bindings.length, 2);

  const loginKey = plan.steps.find((s) => s.operation.operationId === 'login').operation;
  const loginPrereq = updateProfileStep.prerequisites.find((p) => p.operationId === 'login');
  assert.ok(loginPrereq);
});

test('reused upstream values appear in multiple steps bindings', () => {
  const plan = buildExecutionPlan({
    targetServiceId: 'profile',
    targetOperationId: 'update-profile',
    services: [],
    apiModels,
    relationships,
  });

  const loginStep = plan.steps.find((s) => s.operation.operationId === 'login');
  const updateStep = plan.steps.find((s) => s.operation.operationId === 'update-profile');

  const loginHasGenToken = loginStep.bindings.some((b) => b.source.includes('token'));
  const updateHasGenToken = updateStep.bindings.some((b) => b.source.includes('token'));
  assert.ok(loginHasGenToken && updateHasGenToken);
});

test('circular dependencies invalidate plan', () => {
  const circularRelationships = [
    {
      type: 'data_dependency',
      source: { serviceId: 'auth', operationId: 'login', location: 'response.body.accessToken' },
      target: { serviceId: 'auth', operationId: 'generate-token', location: 'request.body.accessToken' },
      status: 'confirmed',
      confidence: 0.5,
    },
    relationships[0],
  ];

  const plan = buildExecutionPlan({
    targetServiceId: 'auth',
    targetOperationId: 'login',
    services: [],
    apiModels,
    relationships: circularRelationships,
  });

  assert.ok(!plan.isValid);
  assert.ok(plan.errors.some((e) => e.includes('Circular')));
});

test('missing referenced operation invalidates plan', () => {
  const badRelationships = [
    {
      type: 'authentication',
      source: { serviceId: 'auth', operationId: 'missing-op', location: 'response.body.token' },
      target: { serviceId: 'auth', operationId: 'login', location: 'request.header.Authorization' },
      status: 'confirmed',
      confidence: 0.5,
    },
  ];

  const plan = buildExecutionPlan({
    targetServiceId: 'auth',
    targetOperationId: 'login',
    services: [],
    apiModels,
    relationships: badRelationships,
  });

  assert.ok(!plan.isValid);
  assert.ok(plan.errors.some((e) => e.includes('Missing referenced operation')));
});

test('validatePlan returns true for valid plan', () => {
  const plan = buildExecutionPlan({
    targetServiceId: 'auth',
    targetOperationId: 'login',
    services: [],
    apiModels,
    relationships: [relationships[0]],
  });
  assert.ok(validatePlan(plan));
});

test('validatePlan returns false for invalid plan', () => {
  const plan = { steps: [{ operation: {} }] };
  assert.ok(!validatePlan(plan));
});

test('proposed/rejected relationships ignored', () => {
  const mixed = [
    {
      type: 'authentication',
      source: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
      target: { serviceId: 'auth', operationId: 'login', location: 'request.header.Authorization' },
      status: 'proposed',
      confidence: 0.5,
    },
    {
      type: 'authentication',
      source: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
      target: { serviceId: 'auth', operationId: 'login', location: 'request.header.Authorization' },
      status: 'rejected',
      confidence: 0.5,
    },
  ];

  const plan = buildExecutionPlan({
    targetServiceId: 'auth',
    targetOperationId: 'login',
    services: [],
    apiModels,
    relationships: mixed,
  });

  assert.ok(plan.isValid);
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].operation.operationId, 'login');
});

console.log(`\nExecutionPlan tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}