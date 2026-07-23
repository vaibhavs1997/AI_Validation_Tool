const { buildIndex } = require('./src/engine/matching/endpointIndex');
const { computeAllSignals } = require('./src/engine/matching/matchingSignals');

const endpoints = [
  { id: 'ep1', method: 'POST', path: '/users', operationId: 'createUser', summary: 'Create a new user' }, 
  { id: 'ep2', method: 'GET', path: '/users/{userId}', operationId: 'getUser', summary: 'Get user by ID' }, 
  { id: 'ep3', method: 'DELETE', path: '/users/{userId}', operationId: 'deleteUser', summary: 'Delete a user' }
];

const fieldIndex = buildIndex(endpoints);

// Aggregated intent (what buildAggregatedIntent produces)
const aggregatedIntent = {
  actionTerms: ['verify', 'confirm', 'create', 'post', 'get', 'delete'],  // Combined from all TCs
  resourceTerms: ['users', 'user', 'account', 'management', 'api', 'happy', 'path', 'send', 'valid', 'request', 'with', 'correct', 'data', 'and', 'the', 'can', 'created', 'via', 'should', 'succeed', 'retrieved', 'deleted'],  // Combined
  contextTerms: [],
  methodHints: ['POST', 'GET', 'DELETE'],  // Combined - this is the problem!
  hasExplicitMethod: false
};

// Test each endpoint
console.log('Signal analysis for aggregated intent:\n');
endpoints.forEach(ep => {
  const signalIntent = {
    testCaseId: 'TC-TEST',
    operationIntent: aggregatedIntent,
    targetFields: [],
    parameterHints: { query: [], path: [], header: [] },
    authIntent: { isAuthTest: false, authTestType: null, authKeywords: [] },
    sourceEvidence: [],
  };
  
  const signals = computeAllSignals(signalIntent, ep, fieldIndex);
  const totalScore = signals.reduce((sum, s) => sum + s.score * s.weight, 0);
  
  console.log(`\n${ep.id} (${ep.method} ${ep.path}):`);
  signals.forEach(s => {
    if (s.score !== 0.5 && s.score !== 0) {
      console.log(`  ${s.name}: ${s.score} (weight: ${s.weight}) -> ${s.score * s.weight}`);
    }
  });
  console.log(`  Total: ${totalScore}`);
});

// Now let's try with individual intents (what should happen)
console.log('\n\n\n=== INDIVIDUAL INTENT ANALYSIS ===\n');

// TC-002: "Users can be created via POST"
const intent2 = {
  actionTerms: ['verify', 'post', 'create'],
  resourceTerms: ['users', 'can', 'created', 'via', 'should', 'succeed', 'user', 'account', 'management', 'api'],
  contextTerms: [],
  methodHints: ['POST'],
  hasExplicitMethod: false
};

endpoints.forEach(ep => {
  const signalIntent = {
    testCaseId: 'TC-002',
    operationIntent: intent2,
    targetFields: [],
    parameterHints: { query: [], path: [], header: [] },
    authIntent: { isAuthTest: false, authTestType: null, authKeywords: [] },
    sourceEvidence: [],
  };
  
  const signals = computeAllSignals(signalIntent, ep, fieldIndex);
  const totalScore = signals.reduce((sum, s) => sum + s.score * s.weight, 0);
  
  console.log(`\n${ep.id} (${ep.method} ${ep.path}) for TC-002 (POST intent):`);
  signals.forEach(s => {
    console.log(`  ${s.name}: ${s.score}`);
  });
  console.log(`  Total: ${totalScore}`);
});