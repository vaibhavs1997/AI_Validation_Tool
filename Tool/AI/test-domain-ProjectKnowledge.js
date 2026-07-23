/**
 * Focused tests for ProjectKnowledge persistence, structured relationships, isolation, backward compatibility, and unknown project handling.
 * Run: node test-domain-ProjectKnowledge.js
 */

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { seedDefaultProject, createProject } = require('./src/domain/ProjectRepository');
const {
  getProjectKnowledge,
  saveProjectKnowledge,
  projectKnowledgeExists,
} = require('./src/domain/ProjectKnowledgeRepository');
const config = require('./src/config');

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

function cleanKnowledgeForProject(projectId) {
  const file = path.join(config.dataDir, 'project-knowledge', String(projectId || 'default').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100) + '.json');
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

const uid = () => 'test_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

test('default project can save and get project knowledge', () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  const saved = saveProjectKnowledge('default', 'Run Generate Token first. Use its token as Bearer auth.');
  assertEqual(saved.projectId, 'default');
  assert.ok(typeof saved.instructions === 'string');
  assert.ok(saved.createdAt instanceof Date);
  assert.ok(saved.updatedAt instanceof Date);

  const fetched = getProjectKnowledge('default');
  assert.ok(fetched);
  assertEqual(fetched.projectId, 'default');
  assertEqual(fetched.instructions, saved.instructions);
});

test('project knowledge is isolated between projects', () => {
  seedDefaultProject();
  const projB = 'project_b_' + uid();
  createProject({ id: projB, name: 'Project B' });
  cleanKnowledgeForProject('default');
  cleanKnowledgeForProject(projB);

  saveProjectKnowledge('default', 'Default project instructions.');
  saveProjectKnowledge(projB, 'Project B instructions.');

  const defaultKnowledge = getProjectKnowledge('default');
  const bKnowledge = getProjectKnowledge(projB);

  assert.equal(defaultKnowledge.instructions, 'Default project instructions.');
  assert.equal(bKnowledge.instructions, 'Project B instructions.');
});

test('saveProjectKnowledge updates existing instructions and updates updatedAt', () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  const first = saveProjectKnowledge('default', 'Initial instructions.');
  const firstCreatedAt = first.createdAt.toISOString();

  const second = saveProjectKnowledge('default', 'Updated instructions.');
  assertEqual(second.projectId, 'default');
  assertEqual(second.instructions, 'Updated instructions.');
  assert.equal(second.createdAt.toISOString(), firstCreatedAt);
  assert.ok(second.updatedAt.getTime() - first.updatedAt.getTime() >= 0);
});

test('projectKnowledgeExists reflects persistence state', () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  saveProjectKnowledge('default', 'Knowledge entry.');
  assert.ok(projectKnowledgeExists('default'));

  cleanKnowledgeForProject('default');
  assert.ok(!projectKnowledgeExists('default'));
});

test('unknown explicit projectId is rejected for project-scoped knowledge operations', () => {
  assertThrows(() => getProjectKnowledge('unknown_project'));
  assertThrows(() => saveProjectKnowledge('unknown_project', 'Some instructions.'));
  assertThrows(() => projectKnowledgeExists('unknown_project'));
});

test('empty or missing projectId fallback behavior is not supported by repository', () => {
  assertThrows(() => getProjectKnowledge(''));
  assertThrows(() => getProjectKnowledge(null));
  assertThrows(() => getProjectKnowledge(undefined));
});

test('relationships can be saved and reloaded with knowledge', () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  const relationships = [
    {
      type: 'authentication',
      source: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
      target: { serviceId: 'auth', operationId: 'login', location: 'request.header.Authorization' },
      transform: 'Bearer token if required',
      status: 'confirmed',
      confidence: 0.9,
      evidence: 'Docs + login flow.',
    },
    {
      type: 'authentication',
      source: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
      target: { serviceId: 'profile', operationId: 'update-profile', location: 'request.header.Authorization' },
      transform: 'Bearer token if required',
      status: 'confirmed',
      confidence: 0.9,
      evidence: 'Docs + profile flow.',
    },
    {
      type: 'data_dependency',
      source: { serviceId: 'auth', operationId: 'login', location: 'response.body.accessToken' },
      target: { serviceId: 'profile', operationId: 'update-profile', location: 'request.body.accessToken' },
      status: 'proposed',
      confidence: 0.7,
      evidence: 'Bearer usage inferred from instructions.',
    },
  ];

  const saved = saveProjectKnowledge('default', 'Use GenerateToken first, then login, then update profile.', relationships);
  assert.ok(Array.isArray(saved.relationships));
  assert.equal(saved.relationships.length, 3);

  const fetched = getProjectKnowledge('default');
  assert.ok(fetched);
  assert.equal(fetched.relationships.length, 3);
  assert.equal(fetched.relationships[0].type, 'authentication');
  assert.equal(fetched.relationships[1].type, 'authentication');
  assert.equal(fetched.relationships[2].type, 'data_dependency');
  assert.equal(fetched.relationships[0].target.operationId, 'login');
  assert.equal(fetched.relationships[1].target.operationId, 'update-profile');
  assert.equal(fetched.relationships[2].target.operationId, 'update-profile');
  assert.equal(fetched.relationships[0].transform, 'Bearer token if required');
});

test('multiple upstream relationships can target one API operation', () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  const relationships = [
    {
      type: 'authentication',
      source: { serviceId: 'auth', operationId: 'login', location: 'response.body.accessToken' },
      target: { serviceId: 'profile', operationId: 'update-profile', location: 'request.header.Authorization' },
      status: 'confirmed',
    },
    {
      type: 'data_dependency',
      source: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
      target: { serviceId: 'profile', operationId: 'update-profile', location: 'request.header.Authorization' },
      status: 'proposed',
    },
  ];

  const saved = saveProjectKnowledge('default', 'Multiple upstream dependencies for UpdateProfile.', relationships);
  const targetingUpdateProfile = saved.relationships.filter((r) => r.target.operationId === 'update-profile');
  assert.equal(targetingUpdateProfile.length, 2);
});

test('relationship lifecycle can move from proposed to confirmed', () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  const rel = {
    type: 'data_dependency',
    source: { serviceId: 'auth', operationId: 'login', location: 'response.body.accessToken' },
    target: { serviceId: 'profile', operationId: 'update-profile', location: 'request.body.accessToken' },
    status: 'proposed',
  };

  const saved = saveProjectKnowledge('default', 'Initial proposed relationship.', [rel]);
  assert.equal(saved.relationships[0].status, 'proposed');

  const updated = saveProjectKnowledge('default', 'Updated relationship.', [
    { ...saved.relationships[0], status: 'confirmed' },
  ]);
  assert.equal(updated.relationships[0].status, 'confirmed');
  assert.equal(updated.instructions, 'Updated relationship.');
});

test('backward compatibility: legacy knowledge file without relationships is readable', () => {
  seedDefaultProject();
  cleanKnowledgeForProject('default');

  const legacyPath = path.join(config.dataDir, 'project-knowledge', 'default.json');
  fs.writeFileSync(legacyPath, JSON.stringify({ projectId: 'default', instructions: 'Legacy instructions.' }, null, 2));

  const fetched = getProjectKnowledge('default');
  assert.ok(fetched);
  assert.equal(fetched.instructions, 'Legacy instructions.');
  assert.ok(Array.isArray(fetched.relationships));
  assert.equal(fetched.relationships.length, 0);
});

console.log(`\nProjectKnowledge tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}