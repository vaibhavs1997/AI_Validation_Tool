const { buildIndex, collectFieldPaths } = require('./src/engine/matching/endpointIndex');

const endpoints = [
  { id: 'ep1', method: 'POST', path: '/users', operationId: 'createUser', summary: 'Create a new user' }, 
  { id: 'ep2', method: 'GET', path: '/users/{userId}', operationId: 'getUser', summary: 'Get user by ID' }, 
  { id: 'ep3', method: 'DELETE', path: '/users/{userId}', operationId: 'deleteUser', summary: 'Delete a user' }
];

const fieldIndex = buildIndex(endpoints);

console.log('Endpoint Index:');
console.log('  byPathToken:', Object.fromEntries(fieldIndex.byPathToken));
console.log('  byMethod:', Object.fromEntries(fieldIndex.byMethod));
console.log('  byOperationTerm:', Object.fromEntries(fieldIndex.byOperationTerm));

// Test what retrieveCandidates returns for the intent
const { retrieveCandidates } = require('./src/engine/matching/endpointIndex');

const intent = {
  actionTerms: ['create', 'post'],
  resourceTerms: ['users', 'user', 'account', 'management', 'api'],
  contextTerms: [],
  methodHints: ['POST'],
  hasExplicitMethod: false
};

console.log('\n\nCandidates for intent with method POST and resource users:');
const candidates = retrieveCandidates(intent, fieldIndex);
console.log('  ', candidates);