const { generateScenarios } = require('./src/scenarios/scenarioGenerator');
const { createTestCasesFromTicket } = require('./src/scenarios/scenarioGenerator');

// Patch to expose internal functions for debugging
const fs = require('fs');
const path = require('path');

// Read and eval the scenarioGenerator to access internal functions
const sgPath = path.join(__dirname, 'src/scenarios/scenarioGenerator.js');
const sgContent = fs.readFileSync(sgPath, 'utf8');

// Get the test cases by calling through generateScenarios
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
  
  // Manually compute test cases
  const testCases = [
    { id: 'TC-001', title: 'Verify happy path: Send a valid request with correct data and confirm the API returns a successful response', type: 'positive', sourceAc: 'Happy path', description: ticket.description, traceability: { requirementIds: ['REQ-001'], sourceText: ticket.summary } },
    { id: 'TC-002', title: 'Verify: Users can be created via POST — should succeed', type: 'positive', sourceAc: 'Users can be created via POST', description: ticket.description, traceability: { requirementIds: ['REQ-001'], sourceText: ticket.summary } },
    { id: 'TC-003', title: 'Verify: Users can be retrieved via GET — should succeed', type: 'positive', sourceAc: 'Users can be retrieved via GET', description: ticket.description, traceability: { requirementIds: ['REQ-001'], sourceText: ticket.summary } },
    { id: 'TC-004', title: 'Verify: Users can be deleted via DELETE — should succeed', type: 'positive', sourceAc: 'Users can be deleted via DELETE', description: ticket.description, traceability: { requirementIds: ['REQ-001'], sourceText: ticket.summary } }
  ];
  
  const { groupByOperationContext } = require('./src/engine/matching/operationContextGrouper');
  const { extractIntent, extractActionTerms } = require('./src/engine/matching/targetIntentExtractor');
  
  // Check grouping
  const contexts = groupByOperationContext(testCases, []);
  console.log('\nContexts:', contexts.size);
  for (const [id, ctx] of contexts) {
    console.log(`  Context ${id}:`, ctx.testCaseIds);
  }
  
  // Check intent extraction for each test case
  console.log('\n\nIntent analysis:');
  for (const tc of testCases) {
    const intent = extractIntent(tc, []);
    const sourceText = tc.traceability?.sourceText || tc.description || "";
    const actions = extractActionTerms(sourceText);
    console.log(`\n${tc.id}: "${tc.title}"`);
    console.log(`  ActionTerms (from title):`, intent.operationIntent.actionTerms);
    console.log(`  ActionTerms (from sourceText):`, actions);
    console.log(`  ResourceTerms:`, intent.operationIntent.resourceTerms);
    console.log(`  MethodHints:`, intent.operationIntent.methodHints);
  }
  
  console.log('\n\nNow running full generate:');
  const result = await generateScenarios({ ticket, contract, useAi: false });
  console.log('Scenarios:', result.scenarios?.length || 0);
  result.scenarios?.forEach((s, i) => {
    console.log(`\n[${i+1}] ${s.id}`);
    console.log(`    Endpoint: ${s.endpointId ? s.method + ' ' + s.path : 'Unlinked'}`);
    console.log(`    Match Score: ${s.matchScore}`);
    console.log(`    Confidence: ${s.matchConfidence}`);
  });
}

test().catch(e => console.error('Error:', e));