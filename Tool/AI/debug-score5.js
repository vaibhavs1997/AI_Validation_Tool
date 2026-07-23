const { groupByOperationContext } = require('./src/engine/matching/operationContextGrouper');
const { matchTestCases } = require('./src/engine/matching/matchingEngine');

const testCases = [
  { id: 'TC-001', title: 'Verify happy path', type: 'positive', sourceAc: 'Happy path', description: 'User registration', traceability: { requirementIds: ['REQ-001'], sourceText: 'Create user account management API with POST /users endpoint' }, expectedMethod: null },
  { id: 'TC-002', title: 'Verify: Users can be created via POST', type: 'positive', sourceAc: 'Users can be created via POST', description: 'User registration', traceability: { requirementIds: ['REQ-001'], sourceText: 'Create user account management API with POST /users endpoint' }, expectedMethod: 'POST' },
  { id: 'TC-003', title: 'Verify: Users can be retrieved via GET', type: 'positive', sourceAc: 'Users can be retrieved via GET', description: 'User registration', traceability: { requirementIds: ['REQ-001'], sourceText: 'Create user account management API with POST /users endpoint' }, expectedMethod: 'GET' },
  { id: 'TC-004', title: 'Verify: Users can be deleted via DELETE', type: 'positive', sourceAc: 'Users can be deleted via DELETE', description: 'User registration', traceability: { requirementIds: ['REQ-001'], sourceText: 'Create user account management API with POST /users endpoint' }, expectedMethod: 'DELETE' }
];

const endpoints = [
  { id: 'ep1', method: 'POST', path: '/users', operationId: 'createUser', summary: 'Create a new user' }, 
  { id: 'ep2', method: 'GET', path: '/users/{userId}', operationId: 'getUser', summary: 'Get user by ID' }, 
  { id: 'ep3', method: 'DELETE', path: '/users/{userId}', operationId: 'deleteUser', summary: 'Delete a user' }
];

console.log('Contexts created:');
const contexts = groupByOperationContext(testCases, []);
for (const [id, ctx] of contexts) {
  console.log(`  ${id}:`, ctx.testCaseIds, 'methodHints:', ctx.intent.methodHints, 'expectedMethod:', ctx.expectedMethod);
}

console.log('\n\nMatching:');
const { results, scenarioAssignments } = matchTestCases(testCases, endpoints, { maxCandidates: 20 });
results.forEach(r => {
  console.log(`\n${r.contextId}:`);
  console.log(`  Confidence: ${r.confidence}`);
  console.log(`  Resolved: ${r.resolvedEndpointId}`);
  console.log(`  NeedsReview: ${r.needsHumanReview}`);
});