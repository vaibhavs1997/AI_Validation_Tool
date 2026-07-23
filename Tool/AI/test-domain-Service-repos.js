/**
 * Focused tests for project-scoped service/ApiModel persistence and isolation.
 * Run: node test-domain-Service-repos.js
 */

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { seedDefaultProject, createProject } = require('./src/domain/ProjectRepository');
const {
  createService,
  getService,
  listServices,
  saveApiModel,
  getApiModel,
  serviceExists,
} = require('./src/domain/ServiceRepository');
const { createProjectContext } = require('./src/domain/ProjectContext');
const { adaptContractToApiModel } = require('./src/domain/contractAdapter');
const config = require('./src/config');

const uid = () => 'test_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

function cleanApiModelsForProject(projectId) {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(config.dataDir, 'api-models', String(projectId || 'default'));
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) fs.unlinkSync(path.join(dir, file));
  }
}

function cleanServicesForProject(projectId) {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(config.dataDir, 'services', String(projectId || 'default'));
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) fs.unlinkSync(path.join(dir, file));
  }
}

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


test('default project can create/list services', () => {
  cleanServicesForProject('default');
  const id = 'users_' + uid();
  const svc = createService('default', { id, name: 'Users API', protocol: 'rest' });
  assertEqual(svc.projectId, 'default');
  assertEqual(svc.id, id);

  const listed = listServices('default');
  assert.equal(listed.length, 1);
  assert.ok(listed.some((s) => s.id === id));
});

test('multiple services can belong to one project', () => {
  cleanServicesForProject('default');
  const idA = 'users_' + uid();
  const idB = 'orders_' + uid();
  createService('default', { id: idA, name: 'Users API', protocol: 'rest' });
  createService('default', { id: idB, name: 'Orders API', protocol: 'rest' });

  const listed = listServices('default');
  assert.equal(listed.length, 2);
  assert.ok(listed.some((s) => s.id === idA));
  assert.ok(listed.some((s) => s.id === idB));
});

test('different projects remain isolated for services', () => {
  cleanServicesForProject('default');
  const idA = 'users_' + uid();
  const idB = 'users_' + uid();
  const projB = 'project_b_' + uid();
  createProject({ id: projB, name: 'Project B' });
  cleanServicesForProject(projB);

  createService('default', { id: idA, name: 'Users API', protocol: 'rest' });
  createService(projB, { id: idB, name: 'Users API B', protocol: 'rest' });

  const defaultServices = listServices('default');
  const bServices = listServices(projB);

  assert.equal(defaultServices.length, 1);
  assert.equal(bServices.length, 1);
  assert.equal(defaultServices[0].name, 'Users API');
  assert.equal(bServices[0].name, 'Users API B');
});

test('save/get API model is associated with service/project', () => {
  cleanServicesForProject('default');
  cleanApiModelsForProject('default');
  const serviceId = 'users_' + uid();
  createService('default', { id: serviceId, name: 'Users API', protocol: 'rest' });
  const contract = adaptContractToApiModel({
    title: 'Users API',
    baseUrl: 'https://api.example.com',
    endpoints: [{ method: 'GET', path: '/users', summary: 'List users' }],
  });

  const saved = saveApiModel('default', serviceId, {
    sourceType: contract.sourceType,
    title: contract.title,
    baseUrl: contract.baseUrl,
    operations: contract.operations,
  });

  assertEqual(saved.projectId, 'default');
  assertEqual(saved.serviceId, serviceId);
  assertEqual(saved.operations.length, 1);

  const fetched = getApiModel('default', serviceId);
  assert.ok(fetched);
  assertEqual(fetched.serviceId, serviceId);
  assertEqual(fetched.baseUrl, 'https://api.example.com');
});

test('service and API model files are persisted in correct project folders', () => {
  cleanServicesForProject('default');
  const serviceId = 'files_proof_' + uid();
  createService('default', { id: serviceId, name: 'Proof', protocol: 'rest' });

  const servicesDir = path.join(config.dataDir, 'services', 'default');
  const servicesFile = path.join(servicesDir, `${serviceId}.json`);
  assert.ok(fs.existsSync(servicesFile), 'Expected service file to exist in project folder.');
});

test('unknown explicit project IDs are rejected for project-scoped operations', () => {
  assertThrows(() => createService('unknown_project', { id: 'x', name: 'X', protocol: 'rest' }));
  assertThrows(() => listServices('unknown_project'));
  assertThrows(() => getService('unknown_project', 'x'));
  assertThrows(() => saveApiModel('unknown_project', 'users', { sourceType: 'openapi', title: 'T', baseUrl: '', operations: [] }));
  assertThrows(() => getApiModel('unknown_project', 'users'));
});

test('empty or missing projectId is normalized to default for context resolution', () => {
  const ctx = createProjectContext({ projectId: '' });
  assertEqual(ctx.projectId, 'default');
  assert.ok(ctx.isDefault);

  const missingCtx = createProjectContext({});
  assertEqual(missingCtx.projectId, 'default');
});

test('duplicate service id under same project is rejected', () => {
  cleanServicesForProject('default');
  const serviceId = 'unique_svc_' + uid();
  createService('default', { id: serviceId, name: 'One', protocol: 'rest' });
  let threw = false;
  try {
    createService('default', { id: serviceId, name: 'Duplicate', protocol: 'rest' });
  } catch (e) {
    threw = true;
  }
  assert.ok(threw, 'Expected duplicate service creation to throw.');
  assert.equal(getService('default', serviceId).name, 'One');
});

test('getService and serviceExists return null/false when missing', () => {
  assert.equal(getService('default', 'missing_svc_' + uid()), null);
  assert.ok(!serviceExists('default', 'missing_svc_' + uid()));
});

console.log(`\nService-repository tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}