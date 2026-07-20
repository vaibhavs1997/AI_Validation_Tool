const { generateScenarios } = require('./src/scenarios/scenarioGenerator');
const { groupByOperationContext } = require('./src/engine/matching/operationContextGrouper');

async function test() {
  const ticket = { 
    key: 'REQ-001', 
    summary: 'Create user account management API with POST /users endpoint', 
    description: 'User registration and management', 
    acceptanceCriteria: ['Users can be created via POST', 'Users can be retrieved via GET', 'Users can be deleted via DELETE']
  };
  
  const contract = { 
    endpoints: [
      { id: 'ep1', method: 'POST', path: '/users', operationId: 'createUser', summary: 'Create a new user' }, 
      { id: 'ep2', method: 'GET', path: '/users/{userId}', operationId: 'getUser', summary: 'Get user by ID' }, 
      { id: 'ep3', method: 'DELETE', path: '/users/{userId}', operationId: 'deleteUser', summary: 'Delete a user' }
    ]
  };
  
  // First generate test cases manually
  const { createTestCasesFromTicket } = require('./src/scenarios/scenarioGenerator');
  const testCases = createTestCasesFromTicket(ticket);
  
  console.log('Test cases created:', testCases.length);
  testCases.forEach((tc, i) => {
    console.log(`\n[${i+1}] ${tc.title}`);
    console.log(`    traceability:`, tc.traceability);
  });
  
  // Check grouping
  const contexts = groupByOperationContext(testCases, []);
  console.log('\n\nContexts:', contexts.size);
  for (const [id, ctx] of contexts) {
    console.log(`  Context ${id}:`, ctx.testCaseIds);
  }
  
  const result = await generateScenarios({ ticket, contract, useAi: false });
  
  console.log('\n\nFinal Scenarios:', result.scenarios?.length || 0);
  result.scenarios?.forEach((s, i) => {
    console.log(`\n[${i+1}] ${s.title}`);
    console.log(`    Endpoint: ${s.endpointId ? s.method + ' ' + s.path : 'Unlinked'}`);
  });
}

test().catch(e => console.error('Error:', e));