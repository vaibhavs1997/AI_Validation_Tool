/**
 * STEP 7.3A — PostgreSQL Foundation Tests
 *
 * Validates:
 * - PG disabled does not require DATABASE_URL
 * - existing app/file repositories still work with PG disabled
 * - missing DATABASE_URL fails clearly when PG enabled
 * - schema contains required tables
 * - service_runtimes decision is covered
 * - no testing-pipeline modules import database code directly
 *
 * Run: node test-db-foundation.js
 */

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  }
}

// ============================================================
// 1. PG disabled does not require DATABASE_URL
// ============================================================

test('PG disabled: config.pg.enabled is false by default', () => {
  const origPg = process.env.PG_ENABLED;
  const origUrl = process.env.DATABASE_URL;
  delete process.env.PG_ENABLED;
  delete process.env.DATABASE_URL;

  delete require.cache[require.resolve('./src/config')];
  const config = require('./src/config');
  assert.equal(config.pg.enabled, false, 'PG_ENABLED must default to false');
  assert.equal(config.pg.databaseUrl, '', 'DATABASE_URL must default to empty string');

  if (origPg) process.env.PG_ENABLED = origPg;
  if (origUrl) process.env.DATABASE_URL = origUrl;
});

test('PG disabled: pool.getPool() returns null', () => {
  const pool = require('./src/db/pool');
  const p = pool.getPool();
  assert.equal(p, null, 'getPool() must return null when PG disabled');
});

test('PG disabled: checkConnection returns disabled status', async () => {
  const pool = require('./src/db/pool');
  const status = await pool.checkConnection();
  assert.equal(status.connected, false, 'Must report not connected');
  assert.ok(status.reason.includes('disabled'), 'Reason must mention disabled');
});

test('PG disabled: query() throws clear error', async () => {
  const pool = require('./src/db/pool');
  try {
    await pool.query('SELECT 1');
    assert.fail('Should have thrown');
  } catch (err) {
    assert.ok(err.message.includes('not enabled'), 'Error must mention PG not enabled');
  }
});

// ============================================================
// 2. Existing app/file repositories still work with PG disabled
// ============================================================

test('PG disabled: ProjectRepository still works (file-based)', () => {
  const { createProject, getProject, projectExists } = require('./src/domain/ProjectRepository');
  const testId = `test-pg-disabled-${Date.now()}`;
  try {
    createProject({ id: testId, name: 'PG Disabled Test' });
    assert.ok(projectExists(testId), 'Project should exist');
    const p = getProject(testId);
    assert.equal(p.id, testId);
    assert.equal(p.name, 'PG Disabled Test');
  } finally {
    const config = require('./src/config');
    const projectFile = path.join(config.dataDir, 'projects', `${testId}.json`);
    if (fs.existsSync(projectFile)) fs.unlinkSync(projectFile);
  }
});

test('PG disabled: ServiceRepository still works (file-based)', () => {
  const { createService, getService } = require('./src/domain/ServiceRepository');
  const projectId = 'default';
  const serviceId = `test-svc-pg-${Date.now()}`;
  try {
    const svc = createService(projectId, { id: serviceId, name: 'PG Test Service' });
    assert.ok(svc, 'Service should be created');
    const fetched = getService(projectId, serviceId);
    assert.ok(fetched, 'Service should be retrievable');
    assert.equal(fetched.id, serviceId);
  } finally {
    const config = require('./src/config');
    const svcFile = path.join(config.dataDir, 'services', projectId, `${serviceId}.json`);
    if (fs.existsSync(svcFile)) fs.unlinkSync(svcFile);
  }
});

test('PG disabled: RunRepository still works (file-based)', () => {
  const { saveRun, getRun } = require('./src/domain/RunRepository');
  const projectId = 'default';
  const runId = `test-run-pg-${Date.now()}`;
  const saved = saveRun(projectId, { id: runId, title: 'PG Test Run', status: 'passed' });
  assert.equal(saved.id, runId);
  const fetched = getRun(projectId, runId);
  assert.ok(fetched, 'Run should be retrievable');
  assert.equal(fetched.title, 'PG Test Run');
  const config = require('./src/config');
  const runFile = path.join(config.dataDir, 'runs', projectId, `${runId}.json`);
  if (fs.existsSync(runFile)) fs.unlinkSync(runFile);
});

test('PG disabled: testCaseGenerator still works', async () => {
  const { generateTestCases } = require('./src/engine/testCaseGenerator');
  const result = await generateTestCases({
    projectId: 'default',
    ticket: { key: 'PG-TEST', summary: 'PG disabled test', acceptanceCriteria: ['AC works'] },
  });
  assert.ok(Array.isArray(result.testCases), 'Must return testCases');
  assert.ok(result.testCases.length >= 1, 'Must generate at least one TC');
});

// ============================================================
// 3. Missing DATABASE_URL fails clearly when PG enabled
// ============================================================

test('PG enabled without DATABASE_URL: config has empty URL', () => {
  const origPg = process.env.PG_ENABLED;
  const origUrl = process.env.DATABASE_URL;
  process.env.PG_ENABLED = 'true';
  delete process.env.DATABASE_URL;

  delete require.cache[require.resolve('./src/config')];
  const config = require('./src/config');
  assert.equal(config.pg.enabled, true, 'PG_ENABLED must be true');
  assert.equal(config.pg.databaseUrl, '', 'DATABASE_URL must be empty');

  if (origPg) process.env.PG_ENABLED = origPg;
  if (origUrl) process.env.DATABASE_URL = origUrl;
});

test('PG enabled without DATABASE_URL: checkConnection returns clear error', async () => {
  const origPg = process.env.PG_ENABLED;
  const origUrl = process.env.DATABASE_URL;
  process.env.PG_ENABLED = 'true';
  process.env.DATABASE_URL = 'postgres://invalid:5432/nonexistent';

  delete require.cache[require.resolve('./src/config')];
  delete require.cache[require.resolve('./src/db/pool')];

  const pool = require('./src/db/pool');
  const status = await pool.checkConnection();
  assert.equal(status.connected, false, 'Must report not connected');
  assert.ok(status.reason, `Must have a reason, got: ${status.reason}`);

  if (origPg) process.env.PG_ENABLED = origPg;
  if (origUrl) process.env.DATABASE_URL = origUrl;
});

// ============================================================
// 4. Schema contains required tables
// ============================================================

test('Schema SQL file exists and contains all required tables', () => {
  const schemaPath = path.join(__dirname, 'src', 'db', '001-schema.sql');
  assert.ok(fs.existsSync(schemaPath), 'Schema file must exist');

  const sql = fs.readFileSync(schemaPath, 'utf8');
  const tables = ['users', 'projects', 'services', 'api_models', 'project_knowledge', 'runs'];
  for (const table of tables) {
    assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      `Schema must contain table: ${table}`);
  }
});

test('Schema SQL is idempotent (uses IF NOT EXISTS)', () => {
  const schemaPath = path.join(__dirname, 'src', 'db', '001-schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const lines = sql.split('\n');
  const createLines = lines.filter(l => l.trim().startsWith('CREATE TABLE'));
  assert.ok(createLines.length >= 6, `Expected at least 6 CREATE TABLE statements, got ${createLines.length}`);
  for (const line of createLines) {
    assert.ok(line.includes('IF NOT EXISTS'),
      `Line must use IF NOT EXISTS: "${line.trim()}"`);
  }
});

test('Schema uses JSONB for document-shaped fields', () => {
  const schemaPath = path.join(__dirname, 'src', 'db', '001-schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const jsonbCount = (sql.match(/JSONB/g) || []).length;
  assert.ok(jsonbCount >= 5, `Schema should use JSONB in multiple places, found ${jsonbCount}`);
});

test('Schema preserves existing IDs as TEXT', () => {
  const schemaPath = path.join(__dirname, 'src', 'db', '001-schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  assert.ok(sql.includes('id          TEXT PRIMARY KEY'), 'projects.id must be TEXT PK');
  assert.ok(sql.includes('PRIMARY KEY (project_id, id)'), 'services must have composite PK');
  assert.ok(sql.includes('PRIMARY KEY (project_id, id)'), 'runs must have composite PK');
});

// ============================================================
// 5. service_runtimes decision is covered
// ============================================================

test('service_runtimes: NOT in schema (no active persisted state exists)', () => {
  const schemaPath = path.join(__dirname, 'src', 'db', '001-schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  assert.ok(!sql.includes('service_runtimes'),
    'service_runtimes table must NOT exist in schema — no active persistence found');
});

test('service_runtimes: No ServiceRuntime domain model or repository exists', () => {
  const domainDir = path.join(__dirname, 'src', 'domain');
  const files = fs.readdirSync(domainDir);
  const runtimeFiles = files.filter(f =>
    f.toLowerCase().includes('serviceruntime') ||
    f.toLowerCase().includes('service_runtime')
  );
  assert.equal(runtimeFiles.length, 0,
    'No ServiceRuntime files should exist in domain');
});

// ============================================================
// 6. No testing-pipeline modules import database code directly
// ============================================================

test('testCaseGenerator does not import db modules', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src', 'engine', 'testCaseGenerator.js'), 'utf8');
  assert.ok(!content.includes('./db/'), 'testCaseGenerator must not import db modules');
  assert.ok(!content.includes('require("pg")'), 'testCaseGenerator must not import pg');
});

test('testCaseMatcher does not import db modules', () => {
  const matcherPath = path.join(__dirname, 'src', 'engine', 'matching', 'testCaseMatcher.js');
  if (fs.existsSync(matcherPath)) {
    const content = fs.readFileSync(matcherPath, 'utf8');
    assert.ok(!content.includes('./db/'), 'testCaseMatcher must not import db modules');
  }
});

test('testSpecificationBridge does not import db modules', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src', 'engine', 'testSpecificationBridge.js'), 'utf8');
  assert.ok(!content.includes('./db/'), 'testSpecificationBridge must not import db modules');
});

test('ExecutionPlan does not import db modules', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src', 'domain', 'ExecutionPlan.js'), 'utf8');
  assert.ok(!content.includes('./db/'), 'ExecutionPlan must not import db modules');
});

test('DependencyAwareExecutor does not import db modules', () => {
  const content = fs.readFileSync(path.join(__dirname, 'src', 'execution', 'dependencyAwareExecutor.js'), 'utf8');
  assert.ok(!content.includes('./db/'), 'DependencyAwareExecutor must not import db modules');
});

// ============================================================
// 7. DB module structure verification
// ============================================================

test('DB module files exist with correct structure', () => {
  const dbDir = path.join(__dirname, 'src', 'db');
  assert.ok(fs.existsSync(dbDir), 'src/db/ directory must exist');
  assert.ok(fs.existsSync(path.join(dbDir, 'pool.js')), 'pool.js must exist');
  assert.ok(fs.existsSync(path.join(dbDir, 'migrate.js')), 'migrate.js must exist');
  assert.ok(fs.existsSync(path.join(dbDir, '001-schema.sql')), '001-schema.sql must exist');
});

test('DB pool module exports correct interface', () => {
  const pool = require('./src/db/pool');
  assert.equal(typeof pool.getPool, 'function', 'getPool must be a function');
  assert.equal(typeof pool.query, 'function', 'query must be a function');
  assert.equal(typeof pool.checkConnection, 'function', 'checkConnection must be a function');
  assert.equal(typeof pool.isHealthy, 'function', 'isHealthy must be a function');
  assert.equal(typeof pool.shutdown, 'function', 'shutdown must be a function');
});

test('DB migrate module exports correct interface', () => {
  const migrate = require('./src/db/migrate');
  assert.equal(typeof migrate.migrate, 'function', 'migrate must be a function');
});

// ============================================================
// Summary
// ============================================================

console.log(`\nDB Foundation tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}