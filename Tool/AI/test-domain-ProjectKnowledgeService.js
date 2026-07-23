/**
 * Focused tests for ProjectKnowledgeService.
 * Run: node test-domain-ProjectKnowledgeService.js
 */

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { seedDefaultProject, createProject } = require('./src/domain/ProjectRepository');
const {
  analyzeAndStoreProposals,
  listRelationshipsByStatus,
  confirmRelationship,
  rejectRelationship,
} = require('./src/domain/ProjectKnowledgeService');
const { createServiceDefinition } = require('./src/domain/ServiceDefinition');
const { createApiModel } = require('./src/domain/ApiModel');
const config = require('./src/config');

let passed = 0;
let failed = 0;
const asyncTests = [];

function test(name, fn) {
  if (fn.constructor.name === 'AsyncFunction') {
    asyncTests.push(fn);
  } else {
    try {
      fn();
      passed++;
    } catch (error) {
      failed++;
      console.error(`FAIL: ${name}`);
      console.error(error && error.message ? error.message : error);
    }
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

function cleanKnowledgeForProject(projectId) {
  const file = path.join(config.dataDir, 'project-knowledge', String(projectId || 'default').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100) + '.json');
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

const uid = () => 'test_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

const services = [createServiceDefinition({ id: 'auth', name: 'Auth', protocol: 'rest' })];
const apiModels = [
  createApiModel({
    service: { id: 'auth', name: 'Auth', protocol: 'rest' },
    title: 'Auth API',
    baseUrl: 'https://auth.example.com',
    operations: [
      { id: 'generate-token', method: 'POST', path: '/token', summary: 'Generate token' },
      { id: 'login', method: 'POST', path: '/login', summary: 'Login' },
      { id: 'update-profile', method: 'POST', path: '/update-profile', summary: 'Update profile' },
    ],
  }),
];

const relationships = [
  {
    type: 'authentication',
    source: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
    target: { serviceId: 'auth', operationId: 'login', location: 'request.header.Authorization' },
    transform: 'Bearer token',
    confidence: 0.9,
  },
  {
    type: 'data_dependency',
    source: { serviceId: 'auth', operationId: 'login', location: 'response.body.accessToken' },
    target: { serviceId: 'auth', operationId: 'update-profile', location: 'request.body.accessToken' },
    confidence: 0.7,
  },
];

test('analyzeAndStoreProposals stores proposed relationships with instructions', async () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  const saved = await analyzeAndStoreProposals({
    projectId: 'default',
    instructions: 'Use token then login.',
    services,
    apiModels,
    relationships,
  });

  assert.equal(saved.projectId, 'default');
  assert.equal(saved.instructions, 'Use token then login.');
  assert.ok(saved.relationships.length >= 2);
});

test('analyzeAndStoreProposals deduplicates same source→target mapping', async () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  const duplicateRelationships = [...relationships, relationships[0]];
  const saved = await analyzeAndStoreProposals({
    projectId: 'default',
    instructions: 'First analysis',
    services,
    apiModels,
    relationships: duplicateRelationships,
  });

  const keys = saved.relationships.map((r) => `${r.source.operationId}->${r.target.operationId}`);
  const uniqueKeys = new Set(keys);
  assert.equal(uniqueKeys.size, keys.length);
  assert.ok(saved.relationships.length >= 2);
});

test('proposed relationships can be confirmed and listed', async () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  await analyzeAndStoreProposals({
    projectId: 'default',
    instructions: 'Workflow',
    services,
    apiModels,
    relationships,
  });

  const proposed = listRelationshipsByStatus('default', 'proposed');
  assert.ok(proposed.length > 0, 'Expected at least one proposed relationship');
  const rel = proposed[0];
  const key = `${rel.source.serviceId}::${rel.source.operationId}::${rel.source.location}::${rel.target.serviceId}::${rel.target.operationId}::${rel.target.location}`;
  confirmRelationship('default', key);

  const confirmed = listRelationshipsByStatus('default', 'confirmed');
  assert.ok(confirmed.length >= 1);
  assert.equal(confirmed[0].status, 'confirmed');
});

test('proposed relationships can be rejected and listed', async () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  await analyzeAndStoreProposals({
    projectId: 'default',
    instructions: 'Workflow',
    services,
    apiModels,
    relationships,
  });

  const proposed = listRelationshipsByStatus('default', 'proposed');
  assert.ok(proposed.length > 0, 'Expected at least one proposed relationship');
  const rel = proposed[0];
  const key = `${rel.source.serviceId}::${rel.source.operationId}::${rel.source.location}::${rel.target.serviceId}::${rel.target.operationId}::${rel.target.location}`;
  rejectRelationship('default', key);

  const rejected = listRelationshipsByStatus('default', 'rejected');
  assert.ok(rejected.length >= 1);
  assert.equal(rejected[0].status, 'rejected');
});

test('confirmed relationships survive re-analysis', async () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  await analyzeAndStoreProposals({
    projectId: 'default',
    instructions: 'Initial',
    services,
    apiModels,
    relationships,
  });

  const proposed = listRelationshipsByStatus('default', 'proposed');
  assert.ok(proposed.length > 0);
  const rel = proposed[0];
  const key = `${rel.source.serviceId}::${rel.source.operationId}::${rel.source.location}::${rel.target.serviceId}::${rel.target.operationId}::${rel.target.location}`;
  confirmRelationship('default', key);
  const confirmedBefore = listRelationshipsByStatus('default', 'confirmed').length;

  await analyzeAndStoreProposals({
    projectId: 'default',
    instructions: 'Re-analysis',
    services,
    apiModels,
    relationships,
  });

  const confirmedAfter = listRelationshipsByStatus('default', 'confirmed').length;
  assert.equal(confirmedAfter, confirmedBefore);
});

test('rejected relationships survive re-analysis', async () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  await analyzeAndStoreProposals({
    projectId: 'default',
    instructions: 'Initial',
    services,
    apiModels,
    relationships,
  });

  const proposed = listRelationshipsByStatus('default', 'proposed');
  assert.ok(proposed.length > 0);
  const rel = proposed[0];
  const key = `${rel.source.serviceId}::${rel.source.operationId}::${rel.source.location}::${rel.target.serviceId}::${rel.target.operationId}::${rel.target.location}`;
  rejectRelationship('default', key);
  const rejectedBefore = listRelationshipsByStatus('default', 'rejected').length;

  await analyzeAndStoreProposals({
    projectId: 'default',
    instructions: 'Re-analysis',
    services,
    apiModels,
    relationships,
  });

  const rejectedAfter = listRelationshipsByStatus('default', 'rejected').length;
  assert.equal(rejectedAfter, rejectedBefore);
});

test('project isolation prevents cross-project relationship leakage', async () => {
  seedDefaultProject();
  const projB = 'project_b_' + uid();
  createProject({ id: projB, name: 'Project B' });
  cleanKnowledgeForProject('default');
  cleanKnowledgeForProject(projB);

  await analyzeAndStoreProposals({
    projectId: 'default',
    instructions: 'Default workflow',
    services,
    apiModels,
    relationships,
  });

  await analyzeAndStoreProposals({
    projectId: projB,
    instructions: 'Project B workflow',
    services,
    apiModels,
    relationships,
  });

  const defaultRelationships = listRelationshipsByStatus('default', 'proposed');
  const bRelationships = listRelationshipsByStatus(projB, 'proposed');
  assert.ok(defaultRelationships.length >= 2);
  assert.ok(bRelationships.length >= 2);
});

(async () => {
  for (const fn of asyncTests) {
    try {
      await fn();
      passed++;
    } catch (error) {
      failed++;
      console.error(`FAIL: ${fn.name}`);
      console.error(error && error.message ? error.message : error);
    }
  }
  console.log(`\nProjectKnowledgeService tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
})();