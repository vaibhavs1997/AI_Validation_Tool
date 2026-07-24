/**
 * STEP 7.3B — ProjectRepository Parity Tests
 *
 * Verifies:
 * - File ProjectRepository behavior (PG_ENABLED=false)
 * - PostgreSQL ProjectRepository behavior (mocked)
 * - PG_ENABLED=false selects file repository
 * - PG_ENABLED=true selects PostgreSQL repository
 * - No testing-pipeline modules import PostgreSQL repository directly
 *
 * Run: node test-project-repository.js
 */

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const testQueue = [];

function test(name, fn) {
  testQueue.push({ name, fn });
}

// Cleanup helper
function cleanup(ids) {
  const config = require('./src/config');
  for (const id of ids) {
    const f = path.join(config.dataDir, 'projects', `${id}.json`);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

// ============================================================
// File Repository Tests (PG_ENABLED=false — default)
// ============================================================

test('FileRepo: createProject creates and returns project identity', () => {
  const pr = require('./src/domain/ProjectRepository');
  const id = `test-file-create-${Date.now()}`;
  try {
    const p = pr.createProject({ id, name: 'Test Project' });
    assert.equal(p.id, id);
    assert.equal(p.name, 'Test Project');
    assert.ok(p.createdAt instanceof Date, 'createdAt must be Date');
    assert.ok(p.updatedAt instanceof Date, 'updatedAt must be Date');
    assert.equal(typeof p.toString, 'function', 'must have toString()');
  } finally {
    cleanup([id]);
  }
});

test('FileRepo: getProject returns null for missing project', () => {
  const pr = require('./src/domain/ProjectRepository');
  const p = pr.getProject('nonexistent-project-id');
  assert.equal(p, null);
});

test('FileRepo: getProject returns project after creation', () => {
  const pr = require('./src/domain/ProjectRepository');
  const id = `test-file-get-${Date.now()}`;
  try {
    pr.createProject({ id, name: 'Get Test' });
    const p = pr.getProject(id);
    assert.ok(p, 'Project should be found');
    assert.equal(p.id, id);
    assert.equal(p.name, 'Get Test');
  } finally {
    cleanup([id]);
  }
});

test('FileRepo: projectExists returns false for missing', () => {
  const pr = require('./src/domain/ProjectRepository');
  assert.equal(pr.projectExists('nonexistent'), false);
});

test('FileRepo: projectExists returns true after creation', () => {
  const pr = require('./src/domain/ProjectRepository');
  const id = `test-file-exists-${Date.now()}`;
  try {
    pr.createProject({ id, name: 'Exists Test' });
    assert.equal(pr.projectExists(id), true);
  } finally {
    cleanup([id]);
  }
});

test('FileRepo: listProjects returns array (possibly empty)', () => {
  const pr = require('./src/domain/ProjectRepository');
  const list = pr.listProjects();
  assert.ok(Array.isArray(list), 'listProjects must return array');
  const defaultProj = list.find(p => p.id === 'default');
  assert.ok(defaultProj, 'listProjects should include default project');
});

test('FileRepo: duplicate project throws', () => {
  const pr = require('./src/domain/ProjectRepository');
  const id = `test-file-dup-${Date.now()}`;
  try {
    pr.createProject({ id, name: 'Original' });
    assert.throws(() => {
      pr.createProject({ id, name: 'Duplicate' });
    }, /Project already exists/);
  } finally {
    cleanup([id]);
  }
});

test('FileRepo: seedDefaultProject creates or returns default', () => {
  const pr = require('./src/domain/ProjectRepository');
  const result = pr.seedDefaultProject();
  assert.ok(result, 'seedDefaultProject must return a project');
  assert.equal(result.id, 'default', 'Default project id must be "default"');
});

test('FileRepo: seedDefaultProject is idempotent', () => {
  const pr = require('./src/domain/ProjectRepository');
  const first = pr.seedDefaultProject();
  const second = pr.seedDefaultProject();
  assert.equal(first.id, second.id, 'Both calls must return same project');
});

test('FileRepo: returned project has correct shape', () => {
  const pr = require('./src/domain/ProjectRepository');
  const id = `test-file-shape-${Date.now()}`;
  try {
    const p = pr.createProject({ id, name: 'Shape Test' });
    assert.ok(p.hasOwnProperty('id'), 'must have id');
    assert.ok(p.hasOwnProperty('name'), 'must have name');
    assert.ok(p.hasOwnProperty('createdAt'), 'must have createdAt');
    assert.ok(p.hasOwnProperty('updatedAt'), 'must have updatedAt');
    assert.ok(p.hasOwnProperty('toString'), 'must have toString');
  } finally {
    cleanup([id]);
  }
});

// ============================================================
// Mock PostgreSQL Repository Tests
// ============================================================

// Synchronous mock pool — avoids async ordering issues
const mockPool = {
  _mockData: new Map(),
  query(text, params) {
    if (text.trim().startsWith('SELECT 1 FROM projects')) {
      const id = params[0];
      return Promise.resolve({ rows: this._mockData.has(id) ? [{ exists: true }] : [] });
    }
    if (text.trim().startsWith('SELECT id, name, created_at, updated_at FROM projects WHERE id')) {
      const id = params[0];
      const data = this._mockData.get(id);
      if (!data) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [{ id: data.id, name: data.name, created_at: data.createdAt, updated_at: data.updatedAt }] });
    }
    if (text.trim().startsWith('SELECT id, name, updated_at FROM projects ORDER BY id')) {
      const rows = Array.from(this._mockData.values()).map(d => ({
        id: d.id, name: d.name, updated_at: d.updatedAt
      })).sort((a, b) => a.id.localeCompare(b.id));
      return Promise.resolve({ rows });
    }
    if (text.trim().startsWith('INSERT INTO projects')) {
      const id = params[0];
      if (this._mockData.has(id)) {
        const err = new Error('duplicate key');
        err.code = '23505';
        return Promise.reject(err);
      }
      this._mockData.set(id, { id, name: params[1], createdAt: params[2], updatedAt: params[3] });
      return Promise.resolve({ rows: [{ id, name: params[1], created_at: params[2], updated_at: params[3] }] });
    }
    return Promise.resolve({ rows: [] });
  },
};

test('PostgresRepo: createProject creates and returns project identity', async () => {
  const pgRepo = require('./src/repositories/ProjectRepositoryPostgres');
  pgRepo._setPoolOverride(mockPool);
  mockPool._mockData.clear();

  const id = `test-pg-create-${Date.now()}`;
  const p = await pgRepo.createProject({ id, name: 'PG Test' });
  assert.equal(p.id, id);
  assert.equal(p.name, 'PG Test');
  assert.ok(p.createdAt instanceof Date, 'createdAt must be Date');
  assert.ok(p.updatedAt instanceof Date, 'updatedAt must be Date');
  assert.equal(typeof p.toString, 'function', 'must have toString()');
});

test('PostgresRepo: getProject returns null for missing project', async () => {
  const pgRepo = require('./src/repositories/ProjectRepositoryPostgres');
  pgRepo._setPoolOverride(mockPool);
  mockPool._mockData.clear();

  const p = await pgRepo.getProject('nonexistent');
  assert.equal(p, null);
});

test('PostgresRepo: getProject returns project after creation', async () => {
  const pgRepo = require('./src/repositories/ProjectRepositoryPostgres');
  pgRepo._setPoolOverride(mockPool);
  mockPool._mockData.clear();

  const id = `test-pg-get-${Date.now()}`;
  await pgRepo.createProject({ id, name: 'Get PG Test' });
  const p = await pgRepo.getProject(id);
  assert.ok(p, 'Project should be found');
  assert.equal(p.id, id);
  assert.equal(p.name, 'Get PG Test');
});

test('PostgresRepo: projectExists returns false for missing', async () => {
  const pgRepo = require('./src/repositories/ProjectRepositoryPostgres');
  pgRepo._setPoolOverride(mockPool);
  mockPool._mockData.clear();

  assert.equal(await pgRepo.projectExists('nonexistent'), false);
});

test('PostgresRepo: projectExists returns true after creation', async () => {
  const pgRepo = require('./src/repositories/ProjectRepositoryPostgres');
  pgRepo._setPoolOverride(mockPool);
  mockPool._mockData.clear();

  const id = `test-pg-exists-${Date.now()}`;
  await pgRepo.createProject({ id, name: 'Exists PG Test' });
  assert.equal(await pgRepo.projectExists(id), true);
});

test('PostgresRepo: listProjects returns array', async () => {
  const pgRepo = require('./src/repositories/ProjectRepositoryPostgres');
  pgRepo._setPoolOverride(mockPool);
  mockPool._mockData.clear();

  await pgRepo.createProject({ id: 'proj-a', name: 'A' });
  await pgRepo.createProject({ id: 'proj-b', name: 'B' });

  const list = await pgRepo.listProjects();
  assert.ok(Array.isArray(list));
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'proj-a', 'Should be sorted by id');
  assert.equal(list[1].id, 'proj-b');
});

test('PostgresRepo: duplicate project throws', async () => {
  const pgRepo = require('./src/repositories/ProjectRepositoryPostgres');
  pgRepo._setPoolOverride(mockPool);
  mockPool._mockData.clear();

  const id = `test-pg-dup-${Date.now()}`;
  await pgRepo.createProject({ id, name: 'Original' });
  try {
    await pgRepo.createProject({ id, name: 'Duplicate' });
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('Project already exists'),
      `Expected duplicate error, got: ${err.message}`);
  }
});

// ============================================================
// Repository Selection Tests
// ============================================================

test('Repository selection: PG_ENABLED=false uses file repo', () => {
  const orig = process.env.PG_ENABLED;
  process.env.PG_ENABLED = 'false';

  delete require.cache[require.resolve('./src/config')];
  delete require.cache[require.resolve('./src/domain/ProjectRepository')];

  const pr = require('./src/domain/ProjectRepository');
  const id = `test-select-file-${Date.now()}`;
  try {
    const result = pr.createProject({ id, name: 'File Select Test' });
    assert.equal(result.id, id, 'File repo must be used');
    assert.equal(typeof result.then, 'undefined', 'Sync result must not be a Promise');
  } finally {
    cleanup([id]);
    if (orig) process.env.PG_ENABLED = orig;
    else delete process.env.PG_ENABLED;
  }
});

test('Repository selection: PG_ENABLED=true selects Postgres repo', async () => {
  const orig = process.env.PG_ENABLED;
  const origUrl = process.env.DATABASE_URL;
  process.env.PG_ENABLED = 'true';
  process.env.DATABASE_URL = 'postgres://test:5432/test';

  delete require.cache[require.resolve('./src/config')];
  delete require.cache[require.resolve('./src/domain/ProjectRepository')];
  delete require.cache[require.resolve('./src/repositories/ProjectRepositoryPostgres')];

  const pr = require('./src/domain/ProjectRepository');
  const pgRepo = require('./src/repositories/ProjectRepositoryPostgres');
  pgRepo._setPoolOverride(mockPool);
  mockPool._mockData.clear();

  const id = `test-select-pg-${Date.now()}`;
  const result = pr.createProject({ id, name: 'PG Select Test' });
  assert.ok(result && typeof result.then === 'function', 'Postgres repo must return Promise');

  const p = await result;
  assert.equal(p.id, id);

  if (orig) process.env.PG_ENABLED = orig;
  else delete process.env.PG_ENABLED;
  if (origUrl) process.env.DATABASE_URL = origUrl;
  else delete process.env.DATABASE_URL;
});

// ============================================================
// Testing-pipeline isolation tests
// ============================================================

test('Isolation: testCaseGenerator does not import ProjectRepositoryPostgres', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src', 'engine', 'testCaseGenerator.js'), 'utf8');
  assert.ok(!content.includes('ProjectRepositoryPostgres'),
    'testCaseGenerator must not import Postgres repo directly');
});

test('Isolation: testSpecificationBridge does not import ProjectRepositoryPostgres', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src', 'engine', 'testSpecificationBridge.js'), 'utf8');
  assert.ok(!content.includes('ProjectRepositoryPostgres'),
    'testSpecificationBridge must not import Postgres repo directly');
});

test('Isolation: ExecutionPlan does not import ProjectRepositoryPostgres', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src', 'domain', 'ExecutionPlan.js'), 'utf8');
  assert.ok(!content.includes('ProjectRepositoryPostgres'),
    'ExecutionPlan must not import Postgres repo directly');
});

// ============================================================
// Sequential test runner
// ============================================================

async function runTests() {
  for (const { name, fn } of testQueue) {
    try {
      await fn();
      console.log(`PASS: ${name}`);
      passed++;
    } catch (error) {
      console.error(`FAIL: ${name}`);
      console.error(`  Error: ${error.message}`);
      failed++;
    }
  }
  console.log(`\nProjectRepository tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTests();
