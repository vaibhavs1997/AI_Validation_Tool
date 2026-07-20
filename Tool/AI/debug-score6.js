const { buildIndex } = require('./src/engine/matching/endpointIndex');
const { computeAllSignals } = require('./src/engine/matching/matchingSignals');

const endpoints = [
  { id: 'ep1', method: 'POST', path: '/users', operationId: 'createUser', summary: 'Create a new user' }, 
  { id: 'ep2', method: 'GET', path: '/users/{userId}', operationId: 'getUser', summary: 'Get user by ID' }, 
  { id: 'ep3', method: 'DELETE', path: '/users/{userId}', operationId: 'deleteUser', summary: 'Delete a user' }
];

const fieldIndex = buildIndex(endpoints);

console.log('Endpoint Index byPathToken:', Object.fromEntries(fieldIndex.byPathToken));
console.log('Endpoint Index byOperationTerm:', Object.fromEntries(fieldIndex.byOperationTerm));

// For TC-002 with expectedMethod POST and source text
const intent = {
  actionTerms: ['verify', 'post', 'create'],
  resourceTerms: ['users', 'can', 'created', 'via', 'should', 'succeed', 'user', 'account', 'management', 'api'],
  contextTerms: [],
  methodHints: ['POST'],
  hasExplicitMethod: true
};

console.log('\n\nSignals for TC-002 (POST intent):');
endpoints.forEach(ep => {
  const signalIntent = {
    testCaseId: 'TC-002',
    operationIntent: intent,
    targetFields: [],
    parameterHints: { query: [], path: [], header: [] },
    authIntent: { isAuthTest: false, authTestType: null, authKeywords: [] },
    sourceEvidence: [],
  };
  
  const signals = computeAllSignals(signalIntent, ep, fieldIndex);
  const total = signals.reduce((sum, s) => sum + s.score * s.weight, 0);
  
  console.log(`\n${ep.id} (${ep.method} ${ep.path}):`);
  signals.forEach(s => {
    console.log(`  ${s.name}: ${s.score} (weight: ${s.weight}) -> contribution: ${(s.score * s.weight).toFixed(3)}`);
  });
  console.log(`  TOTAL: ${total.toFixed(3)}`);
});