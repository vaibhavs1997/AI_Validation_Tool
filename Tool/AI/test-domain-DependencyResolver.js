/**
 * Focused tests for DependencyResolver.
 * Run: node test-domain-DependencyResolver.js
 */

const assert = require('node:assert');
const { createApiModel } = require('./src/domain/ApiModel');
const { resolveDependencies, buildOperationIndex } = require('./src/domain/DependencyResolver');

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
    transform: 'Bearer token',
    status: 'confirmed',
    confidence: 0.9,
  },
  {
    type: 'authentication',
    source: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
    target: { serviceId: 'profile', operationId: 'update-profile', location: 'request.header.Authorization' },
    transform: 'Bearer token',
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

test('buildOperationIndex indexes operations by serviceId::operationId', () => {
  const index = buildOperationIndex(apiModels);
  assert.ok(index.has('auth::generate-token'));
  assert.ok(index.has('auth::login'));
  assert.ok(index.has('profile::update-profile'));
  assert.equal(index.get('auth::login').path, '/login');
});

test('simple dependency resolves single prerequisite', () => {
  const plan = resolveDependencies({
    targetServiceId: 'auth',
    targetOperationId: 'login',
    services: [],
    apiModels,
    relationships: [relationships[0]],
  });

  assert.ok(!plan.errors.length);
  assert.equal(prerequisitesCount(plan), 1);
  assert.equal(plan.sequence.length, 2);
});

test('multiple inputs to one target are all included', () => {
  const plan = resolveDependencies({
    targetServiceId: 'profile',
    targetOperationId: 'update-profile',
    services: [],
    apiModels,
    relationships,
  });

  assert.ok(!plan.errors.length);
  assert.equal(prerequisitesCount(plan), 2);
  assert.ok(sequenceContains(plan, 'auth', 'generate-token'));
  assert.ok(sequenceContains(plan, 'auth', 'login'));
  assert.ok(sequenceContains(plan, 'profile', 'update-profile'));
});

test('execution order is deterministic: upstream before downstream', () => {
  const plan = resolveDependencies({
    targetServiceId: 'profile',
    targetOperationId: 'update-profile',
    services: [],
    apiModels,
    relationships,
  });

  const seqKeys = plan.sequence.map((op) => `${op.serviceId}::${op.operationId}`);
  assert.ok(seqKeys.indexOf('auth::generate-token') < seqKeys.indexOf('auth::login'));
  assert.ok(seqKeys.indexOf('auth::login') < seqKeys.indexOf('profile::update-profile'));
});

test('circular dependency is detected', () => {
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

  const plan = resolveDependencies({
    targetServiceId: 'auth',
    targetOperationId: 'login',
    services: [],
    apiModels,
    relationships: circularRelationships,
  });

  assert.ok(plan.errors.some((err) => err.includes('Circular dependency detected')));
});

test('missing referenced operation is reported as error', () => {
  const badRelationships = [
    {
      type: 'authentication',
      source: { serviceId: 'auth', operationId: 'missing-op', location: 'response.body.token' },
      target: { serviceId: 'auth', operationId: 'login', location: 'request.header.Authorization' },
      status: 'confirmed',
      confidence: 0.5,
    },
  ];

  const plan = resolveDependencies({
    targetServiceId: 'auth',
    targetOperationId: 'login',
    services: [],
    apiModels,
    relationships: badRelationships,
  });

  assert.ok(plan.errors.some((err) => err.includes('Missing referenced operation')));
});

test('proposed/rejected relationships are ignored', () => {
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
    relationships[0],
  ];

  const plan = resolveDependencies({
    targetServiceId: 'auth',
    targetOperationId: 'login',
    services: [],
    apiModels,
    relationships: mixed,
  });

  assert.ok(!plan.errors.length);
  assert.equal(prerequisitesCount(plan), 1);
});

function prerequisitesCount(plan) {
  return plan.prerequisites.length;
}

function sequenceContains(plan, serviceId, operationId) {
  return plan.sequence.some((op) => op.serviceId === serviceId && op.operationId === operationId);
}

console.log(`\nDependencyResolver tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}