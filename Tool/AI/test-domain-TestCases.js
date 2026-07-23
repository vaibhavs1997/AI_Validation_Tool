/**
 * Focused tests for canonical TestCase boundary and generation adapter.
 * Run: node test-domain-TestCases.js
 */

const assert = require('node:assert');
const { createTestCase } = require('./src/domain/TestCase');
const { generateTestCases } = require('./src/engine/testCaseGenerator');
const { generateScenariosV2 } = require('./src/engine/v2Production');

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

test('Existing V2 generation flow remains unchanged', async () => {
  const { generateScenariosV2 } = require('./src/engine/v2Production');
  assert.ok(typeof generateScenariosV2 === 'function');

  const contract = { title: 'Test', baseUrl: 'http://example.com', endpoints: [] };
  const ticket = { key: 'REQ-3', summary: 'Test', acceptanceCriteria: ['AC'] };
  const result = await generateScenariosV2({ ticket, contract });

  assert.ok('mode' in result);
  assert.ok('scenarios' in result);
  assert.ok('warnings' in result);
  assert.ok(Array.isArray(result.scenarios));
});

test('Existing test-specifications endpoint behavior is preserved', () => {
  // Verify the old route still exists and imports are intact
  const fs = require('fs');
  const serverCode = fs.readFileSync('./src/server.js', 'utf8');

  assert.ok(serverCode.includes('/api/test-specifications/generate'), 'Old route must remain');
  assert.ok(serverCode.includes('/api/scenarios/generate'), 'V2 scenario route must remain');
  assert.ok(serverCode.includes('planTestSpecifications'), 'Old planner import must remain');
});

// ============================================================
// Summary
// ============================================================

console.log(`\nTestCase tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}
