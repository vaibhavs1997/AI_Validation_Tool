const { generateScenarios } = require('./src/scenarios/scenarioGenerator');

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
  
  const result = await generateScenarios({ ticket, contract, useAi: false });
  
  console.log('Scenarios:', result.scenarios?.length || 0);
  result.scenarios?.forEach((s, i) => {
    console.log(`\n[${i+1}] ${s.title}`);
    console.log(`    ID: ${s.id}`);
    console.log(`    Type: ${s.type}`);
    console.log(`    Risk: ${s.risk}`);
    console.log(`    Endpoint: ${s.endpointId ? s.method + ' ' + s.path : 'Unlinked'}`);
    if (s.matchScore !== undefined) console.log(`    Match Score: ${s.matchScore}`);
    if (s.matchConfidence) console.log(`    Confidence: ${s.matchConfidence}`);
    if (s.matchReasons) console.log(`    Reasons: ${JSON.stringify(s.matchReasons)}`);
  });
}

test().catch(e => console.error('Error:', e));