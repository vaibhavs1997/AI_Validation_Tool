/**
 * Focused tests for canonical TestCase boundary and generation adapter.
 * Run: node test-domain-TestCases.js
 */

const assert = require('node:assert');
const fs = require('fs');
const { createTestCase } = require('./src/domain/TestCase');
const { generateTestCases } = require('./src/engine/testCaseGenerator');

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
// TestCase Domain Boundary Tests
// ============================================================

test('TestCase can exist without any API information', () => {
  const tc = createTestCase({
    title: 'Verify login with valid credentials',
    description: 'User can log in and receive a token.',
    type: 'positive',
    requirementRefs: [{ acIndex: 0, acText: 'User can login' }],
    testData: {
      body: { username: 'test', password: 'pass' },
      headers: { 'Content-Type': 'application/json' },
    },
    expectedBehavior: { status: 200 },
    assertions: ['response.token exists', 'response.expiresIn equals 3600'],
  });

  assert.ok(tc.id, 'TestCase must have an id');
  assert.equal(tc.title, 'Verify login with valid credentials');
  assert.equal(tc.description, 'User can log in and receive a token.');
  assert.equal(tc.type, 'positive');
  assert.deepEqual(tc.requirementRefs, [{ acIndex: 0, acText: 'User can login' }]);
  assert.deepEqual(tc.testData.body, { username: 'test', password: 'pass' });
  assert.deepEqual(tc.testData.headers, { 'Content-Type': 'application/json' });
  assert.equal(tc.expectedBehavior.status, 200);
  assert.deepEqual(tc.assertions, ['response.token exists', 'response.expiresIn equals 3600']);
});

test('TestCase contains no endpoint/service/operation fields', () => {
  const tc = createTestCase({
    title: 'Create user with valid data',
    type: 'positive',
  });

  assert.equal(tc.serviceId, undefined, 'TestCase must not have serviceId');
  assert.equal(tc.operationId, undefined, 'TestCase must not have operationId');
  assert.equal(tc.endpointId, undefined, 'TestCase must not have endpointId');
  assert.equal(tc.method, undefined, 'TestCase must not have method');
  assert.equal(tc.path, undefined, 'TestCase must not have path');
  assert.equal(tc.ExecutionPlan, undefined, 'TestCase must not have ExecutionPlan');
  assert.equal(tc.proposedOperation, undefined, 'TestCase must not have proposedOperation');
});

test('Multiple TestCases can be generated from one requirement via adapter', async () => {
  const projectId = 'default';
  const ticket = {
    key: 'REQ-1',
    summary: 'Manage user accounts',
    description: 'CRUD operations for users',
    acceptanceCriteria: [
      'User can be created with valid data',
      'User can be retrieved by ID',
      'User can be deleted',
    ],
  };

  const result = await generateTestCases({ projectId, ticket });

  assert.ok(Array.isArray(result.testCases), 'Result must contain testCases array');
  assert.equal(result.projectId, projectId);
  assert.ok('generated' in result.diagnostics, 'Diagnostics must include generated count');
  assert.ok(Array.isArray(result.warnings), 'Warnings must be an array');

  // Verify no endpoint coupling in generated test cases
  for (const tc of result.testCases) {
    assert.equal(tc.serviceId, undefined, `TestCase ${tc.id} must not have serviceId`);
    assert.equal(tc.operationId, undefined, `TestCase ${tc.id} must not have operationId`);
    assert.equal(tc.endpointId, undefined, `TestCase ${tc.id} must not have endpointId`);
    assert.equal(tc.method, undefined, `TestCase ${tc.id} must not have method`);
    assert.equal(tc.path, undefined, `TestCase ${tc.id} must not have path`);
    assert.equal(tc.ExecutionPlan, undefined, `TestCase ${tc.id} must not have ExecutionPlan`);
    assert.equal(tc.proposedOperation, undefined, `TestCase ${tc.id} must not have proposedOperation`);
  }
});

test('Unmatched API state does not remove TestCases', async () => {
  const projectId = 'default';
  const ticket = {
    key: 'REQ-2',
    summary: 'Abstract requirement without API context',
    description: 'Tests for business logic',
    acceptanceCriteria: [
      'Users should not see deleted items',
    ],
  };

  const result = await generateTestCases({ projectId, ticket });

  // Even with no contract / no endpoints, generation must not fail or throw
  assert.ok(Array.isArray(result.testCases));
  assert.ok('generated' in result.diagnostics);
  assert.ok(Array.isArray(result.warnings));
});

test('Existing generation routes and imports remain intact', () => {
  const serverPath = fs.existsSync('./src/server.js') ? './src/server.js' : 'Tool/AI/src/server.js';
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  assert.ok(serverCode.includes('/api/test-cases/generate'), 'Generation route must remain');
  assert.ok(serverCode.includes('/api/test-cases/match'), 'Matching route must remain');
  assert.ok(serverCode.includes('/api/test-specifications/prepare'), 'Prepare route must remain');
  assert.ok(serverCode.includes('generateTestCases'), 'generateTestCases import must remain');
  assert.ok(serverCode.includes('matchTestCasesToApis'), 'matchTestCasesToApis import must remain');
  assert.ok(serverCode.includes('prepareTestSpecifications'), 'prepareTestSpecifications import must remain');
});


// ============================================================
// STEP 6.5A — Human-Readable TestCase Quality
// ============================================================

test('Meaningful AC produces meaningful description', async () => {
  const projectId = 'default';
  const ticket = {
    summary: 'User should be able to login to dev site.',
    description: '',
    acceptanceCriteria: ['User can login with valid credentials'],
  };

  const result = await generateTestCases({ projectId, ticket });
  assert.ok(result.testCases.length >= 1, 'Should generate at least one test case');

  const tc = result.testCases[0];
  assert.ok(tc.title && tc.title.length > 0, 'Title must exist');
  assert.ok(tc.description && tc.description.length > 0, 'Description must exist');

  const lower = tc.description.toLowerCase();
  assert.ok(!lower.includes('verify that ac'), 'Description should not be "Verify that AC."');
  assert.ok(tc.description.trim().slice(-1) === '.', 'Description should end with punctuation');
});

test('Weak "AC" label does not produce meaningless description', async () => {
  const projectId = 'default';
  const ticket = {
    summary: 'Minimal ticket',
    description: '',
    acceptanceCriteria: ['AC', 'AC.'],
  };

  const result = await generateTestCases({ projectId, ticket });
  assert.ok(result.testCases.length >= 2, 'Should generate one test per AC');

  for (const tc of result.testCases) {
    assert.ok(tc.description !== 'Verify that AC.', `Weak AC produced bad description for ${tc.title}`);
    assert.ok(tc.description.length > 0, 'Description should not be empty when better sources exist');
  }
});

test('Requirement summary/description fallback produces human-readable description', async () => {
  const projectId = 'default';
  const ticket = {
    summary: 'Login to dev site',
    description: '',
    acceptanceCriteria: [],
  };

  const result = await generateTestCases({ projectId, ticket });
  assert.ok(result.testCases.length >= 1, 'Should fallback to summary');

  const tc = result.testCases[0];
  assert.ok(tc.description && tc.description.length > 0, 'Description should be derived from summary');
  assert.ok(tc.description.toLowerCase().includes('login') || tc.description.toLowerCase().includes('dev site'),
    'Description should reflect requirement context');
});

test('Positive and negative tests have scenario-specific descriptions', async () => {
  const projectId = 'default';
  const ticket = {
    summary: 'Login scenarios',
    description: '',
    acceptanceCriteria: [
      'User can login with valid credentials',
      'Login is rejected for invalid username',
      'Login is rejected for invalid password',
    ],
  };

  const result = await generateTestCases({ projectId, ticket });
  assert.ok(result.testCases.length >= 3, 'Should generate multiple test cases');

  const titles = result.testCases.map(tc => tc.title.toLowerCase());
  assert.ok(titles.some(t => t.includes('valid')), 'Should include positive scenario title');
  assert.ok(titles.some(t => t.includes('invalid username')), 'Should include negative scenario title');
  assert.ok(titles.some(t => t.includes('invalid password')), 'Should include negative scenario title');

  for (const tc of result.testCases) {
    assert.ok(tc.description && tc.description.length > 0, 'Each test should have a description');
    assert.ok(!tc.description.toLowerCase().includes('endpoint'), 'Description must not mention endpoints');
    assert.ok(!tc.description.toLowerCase().includes('/api/'), 'Description must not mention paths');
  }
});

test('No API coupling appears in generated TestCases', async () => {
  const projectId = 'default';
  const ticket = {
    summary: 'Business logic test',
    description: '',
    acceptanceCriteria: ['System validates input correctly'],
  };

  const result = await generateTestCases({ projectId, ticket });
  assert.ok(result.testCases.length >= 1);

  for (const tc of result.testCases) {
    assert.equal(tc.serviceId, undefined, 'Must not contain serviceId');
    assert.equal(tc.operationId, undefined, 'Must not contain operationId');
    assert.equal(tc.endpointId, undefined, 'Must not contain endpointId');
    assert.equal(tc.method, undefined, 'Must not contain method');
    assert.equal(tc.path, undefined, 'Must not contain path');
    assert.equal(tc.ExecutionPlan, undefined, 'Must not contain ExecutionPlan');
    assert.equal(tc.proposedOperation, undefined, 'Must not contain proposedOperation');
  }
});

test('Canonical type normalization remains correct', async () => {
  const projectId = 'default';
  const ticket = {
    summary: 'Type normalization',
    description: '',
    acceptanceCriteria: [
      'Valid positive path',
      'unauthorized access is blocked',
      'invalid input fails validation',
    ],
  };

  const result = await generateTestCases({ projectId, ticket });
  assert.ok(result.testCases.length >= 3);

  const types = result.testCases.map(tc => tc.type);
  assert.ok(types.some(t => t === 'positive'), 'Should detect positive type');
  assert.ok(types.some(t => t === 'negative'), 'Should detect negative type from indicators');
});

// ============================================================
// Summary
// ============================================================

console.log(`\nTestCase tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}
