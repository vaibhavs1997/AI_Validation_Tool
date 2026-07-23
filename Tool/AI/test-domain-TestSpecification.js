/**
 * Tests for TestSpecification model and adapter.
 * Run: node test-domain-TestSpecification.js
 */

const assert = require('node:assert');
const { createTestSpecification } = require('./src/domain/TestSpecification');
const { adaptScenarioToTestSpecification, adaptScenariosToTestSpecifications } = require('./src/engine/testSpecificationAdapter');

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
// TestSpecification Model Tests
// ============================================================

test('createTestSpecification generates id when not provided', () => {
  const spec = createTestSpecification({});
  assert.ok(spec.id.startsWith('spec-'));
});

test('createTestSpecification preserves provided id', () => {
  const spec = createTestSpecification({ id: 'custom-id-123' });
  assert.equal(spec.id, 'custom-id-123');
});

test('createTestSpecification generates fallback description', () => {
  const spec = createTestSpecification({ 
    method: 'POST', 
    path: '/users',
    type: 'positive'
  });
  assert.ok(spec.description.includes('POST /users'));
  assert.ok(spec.description.includes('successful'));
});

test('createTestSpecification uses provided description', () => {
  const spec = createTestSpecification({ 
    description: 'Verify that a logged-in user can successfully update their profile information.'
  });
  assert.equal(spec.description, 'Verify that a logged-in user can successfully update their profile information.');
});

test('createTestSpecification validates requirementRefs structure', () => {
  const spec = createTestSpecification({
    requirementRefs: [
      { acIndex: 0, acText: 'User can login' },
      { acIndex: 1, acText: 'User can logout' }
    ]
  });
  assert.equal(spec.requirementRefs.length, 2);
  assert.equal(spec.requirementRefs[0].acIndex, 0);
  assert.equal(spec.requirementRefs[1].acText, 'User can logout');
});

test('createTestSpecification initializes testData with defaults', () => {
  const spec = createTestSpecification({});
  assert.deepEqual(spec.testData.pathParams, {});
  assert.deepEqual(spec.testData.queryParams, {});
  assert.deepEqual(spec.testData.headers, {});
  assert.deepEqual(spec.testData.body, {});
});

test('createTestSpecification preserves testData', () => {
  const spec = createTestSpecification({
    testData: {
      pathParams: { userId: 123 },
      queryParams: { limit: 10 },
      headers: { 'Authorization': 'Bearer token' },
      body: { name: 'Test User' }
    }
  });
  assert.deepEqual(spec.testData.pathParams, { userId: 123 });
  assert.deepEqual(spec.testData.queryParams, { limit: 10 });
  assert.deepEqual(spec.testData.headers, { 'Authorization': 'Bearer token' });
  assert.deepEqual(spec.testData.body, { name: 'Test User' });
});

test('createTestSpecification sets expectedBehavior from input', () => {
  const spec = createTestSpecification({
    expectedStatus: 201,
    assertions: ['response.id exists', 'response.name equals request.name']
  });
  assert.equal(spec.expectedBehavior.status, 201);
  assert.deepEqual(spec.expectedBehavior.responseAssertions, ['response.id exists', 'response.name equals request.name']);
  assert.deepEqual(spec.assertions, ['response.id exists', 'response.name equals request.name']);
});

test('createTestSpecification handles missing optional fields gracefully', () => {
  const spec = createTestSpecification({
    title: 'Test with minimal fields'
    // No other fields provided
  });
  assert.equal(spec.title, 'Test with minimal fields');
  assert.ok(spec.description); // Should have generated fallback
  assert.deepEqual(spec.requirementRefs, []);
  assert.deepEqual(spec.operationRefs, []);
  assert.deepEqual(spec.prerequisites, []);
});

// ============================================================
// Adapter Tests
// ============================================================

test('adaptScenarioToTestSpecification adapts successful scenario', () => {
  const scenario = {
    id: 'scn-123',
    title: 'Create user with valid data',
    description: 'Verify user creation with valid inputs',
    type: 'positive',
    endpointId: 'post-users',
    method: 'POST',
    path: '/users',
    acIndex: 0,
    sourceAc: 'As a user, I can create a new user account',
    expectedStatus: 201,
    basePayload: { name: 'Test', email: 'test@example.com' },
    testData: {
      pathParams: { orgId: 'org-1' }
    },
    assertions: ['response.id exists', 'response.name equals request.name']
  };

  const spec = adaptScenarioToTestSpecification(scenario);
  
  assert.equal(spec.id, 'scn-123');
  assert.equal(spec.title, 'Create user with valid data');
  assert.equal(spec.description, 'Verify user creation with valid inputs');
  assert.equal(spec.requirementRefs.length, 1);
  assert.equal(spec.requirementRefs[0].acIndex, 0);
  assert.equal(spec.operationRefs.length, 1);
  assert.equal(spec.operationRefs[0].endpointId, 'post-users');
  assert.deepEqual(spec.testData.body, { name: 'Test', email: 'test@example.com' });
  assert.deepEqual(spec.testData.pathParams, { orgId: 'org-1' });
  assert.equal(spec.expectedBehavior.status, 201);
  assert.deepEqual(spec.assertions, ['response.id exists', 'response.name equals request.name']);
});

test('adaptScenarioToTestSpecification generates fallback description', () => {
  const scenario = {
    id: 'scn-456',
    title: 'Get users',
    type: 'positive',
    method: 'GET',
    path: '/users'
  };

  const spec = adaptScenarioToTestSpecification(scenario);
  assert.ok(spec.description.includes('GET /users'));
  assert.ok(spec.description.includes('successful'));
});

test('adaptScenarioToTestSpecification handles missing description', () => {
  const scenario = {
    id: 'scn-no-desc',
    title: 'Unlabeled test',
    type: 'negative',
    method: 'POST',
    path: '/login'
  };

  const spec = adaptScenarioToTestSpecification(scenario);
  assert.ok(spec.description.includes('POST /login'));
  assert.ok(spec.description.includes('error'));
});

test('adaptScenarioToTestSpecification preserves traceability', () => {
  const scenario = {
    id: 'scn-trace',
    title: 'Update user profile',
    type: 'positive',
    endpointId: 'put-profile',
    acIndex: 2,
    sourceAc: 'User can update their profile information',
    expectedStatus: 200,
    basePayload: { name: 'Updated Name' },
    assertions: ['response.updatedAt exists']
  };

  const spec = adaptScenarioToTestSpecification(scenario);
  
  assert.equal(spec.requirementRefs[0].acIndex, 2);
  assert.equal(spec.requirementRefs[0].acText, 'User can update their profile information');
  assert.equal(spec.operationRefs[0].endpointId, 'put-profile');
  assert.deepEqual(spec.assertions, ['response.updatedAt exists']);
});

test('adaptScenariosToTestSpecifications adapts array', () => {
  const scenarios = [
    { id: 'scn-1', title: 'Test 1', type: 'positive', method: 'GET', path: '/users' },
    { id: 'scn-2', title: 'Test 2', type: 'negative', method: 'POST', path: '/users' },
    { id: 'scn-3', title: 'Test 3', type: 'edge', method: 'GET', path: '/users/{id}' }
  ];

  const specs = adaptScenariosToTestSpecifications(scenarios);
  
  assert.equal(specs.length, 3);
  assert.equal(specs[0].id, 'scn-1');
  assert.equal(specs[1].id, 'scn-2');
  assert.equal(specs[2].id, 'scn-3');
});

test('adaptScenariosToTestSpecifications handles empty array', () => {
  const specs = adaptScenariosToTestSpecifications([]);
  assert.deepEqual(specs, []);
});

test('adaptScenariosToTestSpecifications handles null/undefined input', () => {
  const specs = adaptScenariosToTestSpecifications(null);
  assert.deepEqual(specs, []);
});

test('adaptScenarioToTestSpecification handles scenario without acIndex', () => {
  const scenario = {
    id: 'scn-no-ac',
    title: 'Independent test',
    type: 'functional',
    method: 'DELETE',
    path: '/cache'
  };

  const spec = adaptScenarioToTestSpecification(scenario);
  
  assert.deepEqual(spec.requirementRefs, []);
  assert.equal(spec.operationRefs[0].endpointId, undefined);
  assert.equal(spec.operationRefs[0].operationId, 'DELETE /cache');
});

// ============================================================
// Example: V2 Scenario → TestSpecification
// ============================================================

test('Example: Full adaptation preserves technical info', () => {
  const v2Scenario = {
    id: 'scn-example-789',
    title: 'Verify login returns valid token',
    description: 'Successful authentication flow',
    type: 'positive',
    endpointId: 'post-login',
    method: 'POST',
    path: '/auth/login',
    acIndex: 0,
    sourceAc: 'User can authenticate with valid credentials',
    expectedStatus: 200,
    basePayload: { username: 'user', password: 'pass' },
    testData: {
      pathParams: {},
      queryParams: {},
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'user', password: 'pass' }
    },
    assertions: [
      'response.token exists',
      'response.expiresIn equals 3600'
    ]
  };

  const spec = adaptScenarioToTestSpecification(v2Scenario);

  // Verify all fields preserved
  assert.equal(spec.id, 'scn-example-789');
  assert.equal(spec.title, 'Verify login returns valid token');
  assert.equal(spec.description, 'Successful authentication flow');
  
  // Verify requirement traceability
  assert.equal(spec.requirementRefs[0].acIndex, 0);
  assert.equal(spec.requirementRefs[0].acText, 'User can authenticate with valid credentials');

  // Verify operation reference
  assert.equal(spec.operationRefs[0].endpointId, 'post-login');
  assert.equal(spec.operationRefs[0].operationId, 'post-login');

  // Verify test data
  assert.deepEqual(spec.testData.body, { username: 'user', password: 'pass' });
  assert.deepEqual(spec.testData.headers, { 'Content-Type': 'application/json' });

  // Verify expected behavior
  assert.equal(spec.expectedBehavior.status, 200);
  assert.equal(spec.expectedBehavior.responseAssertions.length, 2);
});

// ============================================================
// Summary
// ============================================================

console.log(`\nTestSpecification tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}