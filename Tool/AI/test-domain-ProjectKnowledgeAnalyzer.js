/**
 * Focused tests for ProjectKnowledgeAnalyzer.
 * Run: node test-domain-ProjectKnowledgeAnalyzer.js
 */

const assert = require('node:assert');
const { createServiceDefinition } = require('./src/domain/ServiceDefinition');
const { createApiModel } = require('./src/domain/ApiModel');
const { analyzeProjectKnowledge, compactProjectContext } = require('./src/domain/ProjectKnowledgeAnalyzer');

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

const originalFetch = globalThis.fetch;

test('compactProjectContext summarizes services and apiModels', () => {
  const services = [createServiceDefinition({ id: 'auth', name: 'Auth', protocol: 'rest' })];
  const apiModels = [
    createApiModel({
      service: { id: 'auth', name: 'Auth', protocol: 'rest' },
      title: 'Auth API',
      baseUrl: 'https://auth.example.com',
      operations: [
        { method: 'POST', path: '/login', summary: 'Login' },
        { method: 'POST', path: '/token', summary: 'Generate token' },
      ],
    }),
  ];

  const ctx = compactProjectContext({ services, apiModels });
  assert.equal(ctx.services[0].id, 'auth');
  assert.equal(ctx.operations.length, 2);
  assert.equal(ctx.operations[0].operationId, 'POST /login');
  assert.equal(ctx.operations[1].operationId, 'POST /token');
});

test('analyzeProjectKnowledge returns no AI relationships when provider not configured', async () => {
  const result = await analyzeProjectKnowledge({
    instructions: 'Use login token.',
    services: [],
    apiModels: [],
  });

  assert.equal(result.usedAi, false);
  assert.ok(Array.isArray(result.relationships));
  assert.equal(result.relationships.length, 0);
  assert.ok(result.warning.includes('AI provider is not configured'));
});

test('analyzeProjectKnowledge proposes validated relationships from AI response', async () => {
  const config = require('./src/config');
  const originalAi = { ...config.ai };
  config.ai.apiKey = 'test';
  config.ai.baseUrl = 'https://test.example.com';
  config.ai.model = 'test-model';

  globalThis.fetch = async () => ({
    ok: true,
    text: async () =>
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                relationships: [
                  {
                    type: 'authentication',
                    source: { serviceId: 'auth', operationId: 'POST /token', location: 'response.body.token' },
                    target: { serviceId: 'auth', operationId: 'POST /login', location: 'request.header.Authorization' },
                    transform: 'Bearer token',
                    confidence: 0.9,
                    evidence: 'Docs',
                  },
                ],
              }),
            },
          },
        ],
      }),
  });

  const services = [createServiceDefinition({ id: 'auth', name: 'Auth', protocol: 'rest' })];
  const apiModels = [
    createApiModel({
      service: { id: 'auth', name: 'Auth', protocol: 'rest' },
      title: 'Auth API',
      baseUrl: 'https://auth.example.com',
      operations: [
        { method: 'POST', path: '/token', summary: 'Generate token' },
        { method: 'POST', path: '/login', summary: 'Login' },
      ],
    }),
  ];

  const result = await analyzeProjectKnowledge({
    instructions: 'Use GenerateToken before login.',
    services,
    apiModels,
  });

  assert.equal(result.usedAi, true);
  assert.equal(result.relationships.length, 1);
  assert.equal(result.relationships[0].type, 'authentication');
  assert.equal(result.relationships[0].status, 'proposed');
  assert.equal(result.relationships[0].source.operationId, 'POST /token');
  assert.equal(result.relationships[0].target.operationId, 'POST /login');
  assert.equal(result.relationships[0].transform, 'Bearer token');

  config.ai = originalAi;
  globalThis.fetch = originalFetch;
});

test('analyzeProjectKnowledge rejects hallucinated relationships with unknown operations', async () => {
  const config = require('./src/config');
  const originalAi = { ...config.ai };
  config.ai.apiKey = 'test';
  config.ai.baseUrl = 'https://test.example.com';
  config.ai.model = 'test-model';

  globalThis.fetch = async () => ({
    ok: true,
    text: async () =>
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                relationships: [
                  {
                    type: 'authentication',
                    source: { serviceId: 'auth', operationId: 'POST /token', location: 'response.body.token' },
                    target: { serviceId: 'auth', operationId: 'POST /unknown-op', location: 'request.header.Authorization' },
                    confidence: 0.8,
                  },
                ],
              }),
            },
          },
        ],
      }),
  });

  const services = [createServiceDefinition({ id: 'auth', name: 'Auth', protocol: 'rest' })];
  const apiModels = [
    createApiModel({
      service: { id: 'auth', name: 'Auth', protocol: 'rest' },
      title: 'Auth API',
      baseUrl: 'https://auth.example.com',
      operations: [
        { method: 'POST', path: '/token', summary: 'Generate token' },
      ],
    }),
  ];

  const result = await analyzeProjectKnowledge({
    instructions: 'Use token.',
    services,
    apiModels,
  });

  assert.equal(result.usedAi, true);
  assert.equal(result.relationships.length, 0);

  config.ai = originalAi;
  globalThis.fetch = originalFetch;
});

test('analyzeProjectKnowledge clamps confidence and rejects invalid types/statuses', async () => {
  const config = require('./src/config');
  const originalAi = { ...config.ai };
  config.ai.apiKey = 'test';
  config.ai.baseUrl = 'https://test.example.com';
  config.ai.model = 'test-model';

  globalThis.fetch = async () => ({
    ok: true,
    text: async () =>
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                relationships: [
                  {
                    type: 'soap',
                    source: { serviceId: 'auth', operationId: 'POST /token', location: 'response.body.token' },
                    target: { serviceId: 'auth', operationId: 'POST /login', location: 'request.header.Authorization' },
                    confidence: 2,
                  },
                ],
              }),
            },
          },
        ],
      }),
  });

  const services = [createServiceDefinition({ id: 'auth', name: 'Auth', protocol: 'rest' })];
  const apiModels = [
    createApiModel({
      service: { id: 'auth', name: 'Auth', protocol: 'rest' },
      title: 'Auth API',
      baseUrl: 'https://auth.example.com',
      operations: [
        { method: 'POST', path: '/token', summary: 'Generate token' },
        { method: 'POST', path: '/login', summary: 'Login' },
      ],
    }),
  ];

  const result = await analyzeProjectKnowledge({
    instructions: 'Use token.',
    services,
    apiModels,
  });

  assert.equal(result.usedAi, true);
  assert.equal(result.relationships.length, 0);

  config.ai = originalAi;
  globalThis.fetch = originalFetch;
});

test('analyzeProjectKnowledge handles malformed AI JSON response', async () => {
  const config = require('./src/config');
  const originalAi = { ...config.ai };
  config.ai.apiKey = 'test';
  config.ai.baseUrl = 'https://test.example.com';
  config.ai.model = 'test-model';

  globalThis.fetch = async () => ({
    ok: true,
    text: async () =>
      JSON.stringify({
        choices: [
          {
            message: {
              content: 'This is not JSON.',
            },
          },
        ],
      }),
  });

  const result = await analyzeProjectKnowledge({
    instructions: 'Use token.',
    services: [],
    apiModels: [],
  });

  assert.equal(result.usedAi, true);
  assert.ok(Array.isArray(result.relationships));
  assert.equal(result.relationships.length, 0);

  config.ai = originalAi;
  globalThis.fetch = originalFetch;
});

console.log(`\nProjectKnowledgeAnalyzer tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}