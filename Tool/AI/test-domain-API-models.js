/**
 * Focused unit tests for ServiceDefinition, ApiOperation, ApiModel, and contractAdapter.
 * Run: node test-domain-API-models.js
 */

const assert = require('node:assert');
const { createServiceDefinition, PROTOCOLS } = require('./src/domain/ServiceDefinition');
const { createApiOperation, REST_METHODS } = require('./src/domain/ApiOperation');
const { createApiModel } = require('./src/domain/ApiModel');
const { adaptContractToApiModel, mapEndpointToOperation } = require('./src/domain/contractAdapter');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(error && error.message ? error.message : error);
  }
}

function assertEqual(actual, expected) {
  assert.strictEqual(actual, expected);
}

function assertThrows(fn) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
  }
  assert.ok(threw, 'Expected function to throw.');
}

test('ServiceDefinition validates required fields and protocol', () => {
  const service = createServiceDefinition({ id: 'svc-1', name: 'Users API', protocol: 'rest' });
  assertEqual(service.id, 'svc-1');
  assertEqual(service.name, 'Users API');
  assertEqual(service.protocol, 'rest');
  assertEqual(service.description, '');
});

test('ServiceDefinition supports graphql protocol', () => {
  const service = createServiceDefinition({ id: 'svc-2', name: 'Graph', protocol: 'GRAPHQL' });
  assertEqual(service.protocol, 'graphql');
});

test('ServiceDefinition throws on invalid input', () => {
  assertThrows(() => createServiceDefinition({}));
  assertThrows(() => createServiceDefinition({ id: '', name: 'X' }));
  assertThrows(() => createServiceDefinition({ id: '1', name: 'X', protocol: 'soap' }));
});

test('REST ApiOperation validates method and path', () => {
  const op = createApiOperation({ method: 'post', path: '/users' });
  assertEqual(op.protocol, 'rest');
  assertEqual(op.method, 'POST');
  assertEqual(op.path, '/users');
});

test('REST ApiOperation defaults method to GET', () => {
  const op = createApiOperation({ path: '/health' });
  assertEqual(op.method, 'GET');
  assertEqual(op.path, '/health');
});

test('GraphQL ApiOperation supports operationType/operationName', () => {
  const op = createApiOperation({ protocol: 'graphql', operationType: 'mutation', operationName: 'createUser' });
  assertEqual(op.protocol, 'graphql');
  assertEqual(op.operationType, 'mutation');
  assertEqual(op.operationName, 'createUser');
});

test('REST ApiOperation throws on invalid method', () => {
  assertThrows(() => createApiOperation({ method: 'PURGE', path: '/x' }));
});

test('REST ApiOperation throws on missing path', () => {
  assertThrows(() => createApiOperation({ method: 'GET' }));
});

test('ApiModel builds service and operations', () => {
  const model = createApiModel({
    title: 'Pet API',
    baseUrl: 'https://api.example.com',
    operations: [
      { method: 'GET', path: '/pets' },
      { method: 'POST', path: '/pets' },
    ],
  });

  assertEqual(model.service.id, 'Pet API');
  assertEqual(model.service.protocol, 'rest');
  assertEqual(model.title, 'Pet API');
  assertEqual(model.baseUrl, 'https://api.example.com');
  assertEqual(model.operations.length, 2);
  assertEqual(model.operations[0].method, 'GET');
  assertEqual(model.operations[0].path, '/pets');
});

test('ApiModel supports operation-level protocol override', () => {
  const model = createApiModel({
    service: { protocol: 'rest' },
    operations: [
      { protocol: 'graphql', operationType: 'query', operationName: 'hello' },
    ],
  });

  assertEqual(model.operations[0].protocol, 'graphql');
  assertEqual(model.operations[0].operationType, 'query');
});

test('contractAdapter maps endpoint to operation', () => {
  const endpoint = { method: 'PUT', path: '/users/1', id: 'ep-1', summary: 'Update user' };
  const operation = mapEndpointToOperation(endpoint);

  assertEqual(operation.id, 'ep-1');
  assertEqual(operation.method, 'PUT');
  assertEqual(operation.path, '/users/1');
  assertEqual(operation.summary, 'Update user');
});

test('contractAdapter derives operation id when missing', () => {
  const operation = mapEndpointToOperation({ method: 'DELETE', path: '/users/1' });
  assert.ok(operation.id.includes('DELETE'));
  assertEqual(operation.path, '/users/1');
});

test('contractAdapter adapts OpenAPI-style ApiContract to ApiModel', () => {
  const contract = {
    type: 'openapi',
    title: 'Orders API',
    baseUrl: 'https://api.example.com',
    endpoints: [
      { id: 'ep-list', method: 'GET', path: '/orders', summary: 'List orders' },
      { id: 'ep-create', method: 'POST', path: '/orders', summary: 'Create order' },
    ],
  };

  const apiModel = adaptContractToApiModel(contract);
  assertEqual(apiModel.service.id, 'Orders API');
  assertEqual(apiModel.sourceType, 'openapi');
  assertEqual(apiModel.baseUrl, 'https://api.example.com');
  assertEqual(apiModel.operations.length, 2);
  assertEqual(apiModel.operations[0].id, 'ep-list');
  assert.equal(apiModel.operations[1].summary, 'Create order');
});

test('contractAdapter adapts Postman-style contract to ApiModel', () => {
  const contract = {
    type: 'postman',
    title: 'Postman Coll',
    baseUrl: 'https://postman.example.com',
    endpoints: [
      { method: 'GET', path: '/ping', summary: 'Ping' },
    ],
  };

  const apiModel = adaptContractToApiModel(contract);
  assertEqual(apiModel.service.id, 'Postman Coll');
  assertEqual(apiModel.sourceType, 'postman');
  assertEqual(apiModel.operations[0].path, '/ping');
});

test('protocol extensibility: GraphQL can be represented via ApiOperation without breaking REST', () => {
  const restOp = createApiOperation({ method: 'GET', path: '/x' });
  const gqlOp = createApiOperation({ protocol: 'graphql', operationType: 'query', operationName: 'ping' });

  assert.ok(REST_METHODS.includes(restOp.method));
  assert.equal(restOp.path, '/x');
  assert.equal(gqlOp.operationType, 'query');
  assert.equal(gqlOp.operationName, 'ping');
});

console.log(`\nAPI-model tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}