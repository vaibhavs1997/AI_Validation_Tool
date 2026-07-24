/**
 * STEP 5.11 — Active Workflow Runtime Blocker Regression Tests
 *
 * Regression coverage for:
 * 1. Prepare returning zero executable specs with valid mappings
 * 2. ExecutionPlan validation rejecting empty steps
 * 3. Project lookup consistency across workflow stages
 */

const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createProject, getProject, listProjects, projectExists } = require('./src/domain/ProjectRepository');
const { createService, saveApiModel, listServices, getApiModel } = require('./src/domain/ServiceRepository');
const { adaptContractToApiModel } = require('./src/domain/contractAdapter');
const { analyzeAndStoreProposals } = require('./src/domain/ProjectKnowledgeService');
const { buildExecutionPlan, validatePlan } = require('./src/domain/ExecutionPlan');
const { createTestSpecification } = require('./src/domain/TestSpecification');
const { executeTestSpecification } = require('./src/execution/dependencyAwareExecutor');
const { matchTestCasesToApis } = require('./src/engine/matching/testCaseMatcher');
const { prepareTestSpecifications } = require('./src/engine/testSpecificationBridge');
const config = require('./src/config');

const BASE = 'http://127.0.0.1:4173';
const PROJECT_ID = 'step5-11-regression';
let passed = 0;
let failed = 0;
const apiCalls = [];

function recordApiCall(method, url, status) {
  apiCalls.push({ method, url, status });
}

function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: options.hostname || '127.0.0.1',
      port: options.port || 4173,
      path: options.path,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(opts, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        recordApiCall(opts.method, opts.path, res.statusCode);
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(`  Error: ${error.message}`);
    if (error.stack) {
      console.error(`  Stack: ${error.stack.split('\n').slice(1, 3).join('\n')}`);
    }
    failed++;
  }
}

function cleanup() {
  const projectFile = path.join(config.dataDir, 'projects', `${PROJECT_ID}.json`);
  const servicesDir = path.join(config.dataDir, 'services', PROJECT_ID);
  const apiModelsDir = path.join(config.dataDir, 'api-models', PROJECT_ID);
  const knowledgeFile = path.join(config.dataDir, 'project-knowledge', `${PROJECT_ID}.json`);
  const runsDir = path.join(config.dataDir, 'runs', PROJECT_ID);

  [projectFile, servicesDir, apiModelsDir, knowledgeFile, runsDir].forEach((p) => {
    if (fs.existsSync(p)) {
      if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true, force: true });
      else fs.unlinkSync(p);
    }
  });
}

// ============================================================
// Mock API server for execution tests
// ============================================================
function startMockApiServer(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method.toUpperCase();
    const p = url.pathname;

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (method === 'POST' && p === '/token') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: 'mock-token', expiresIn: 3600 }));
        return;
      }

      if (method === 'POST' && p === '/login') {
        const auth = req.headers['authorization'] || '';
        if (!auth || !auth.includes('Bearer')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing Authorization' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ accessToken: 'mock-access-token', user: { id: 1 } }));
        return;
      }

      if (method === 'PUT' && p === '/profile') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });
  });

  server.listen(port);
  return server;
}

// ============================================================
// Regression flow
// ============================================================
async function runRegression() {
  console.log('\n=== STEP 5.11 — Active Workflow Runtime Blocker Regression Tests ===\n');

  cleanup();
  const mockServer = startMockApiServer(3099);
  console.log('[REGRESSION] Mock API server started on 3099');
  try {
    // ============================================================
    // Setup: project + service + relationships
    // ============================================================
    test('Regression: Project can be created and looked up consistently', () => {
      createProject({ id: PROJECT_ID, name: 'Regression Project', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      assert.ok(projectExists(PROJECT_ID), 'Project should exist immediately after creation');
      const p = getProject(PROJECT_ID);
      assert.equal(p.id, PROJECT_ID);
    });

    test('Regression: Project API GET returns 200', async () => {
      const res = await httpRequest({ method: 'GET', path: `/api/projects/${PROJECT_ID}` });
      assert.equal(res.status, 200);
      assert.equal(res.body.project.id, PROJECT_ID);
    });

    test('Regression: Register APIs with known operations', () => {
      const service = createService(PROJECT_ID, { id: 'svc-a', name: 'Service A' });
      assert.ok(service);
      const contract = {
        title: 'svc-a',
        baseUrl: 'http://127.0.0.1:3099',
        type: 'openapi',
        endpoints: [{ id: 'op-a', method: 'GET', path: '/a', summary: 'A' }],
      };
      const apiModel = adaptContractToApiModel(contract);
      saveApiModel(PROJECT_ID, 'svc-a', apiModel);
      assert.equal(listServices(PROJECT_ID).length, 1);
    });

    test('Regression: Project instructions with relationships', async () => {
      const services = listServices(PROJECT_ID);
      const apiModels = services.map((s) => getApiModel(PROJECT_ID, s.id));
      const knowledge = await analyzeAndStoreProposals({
        projectId: PROJECT_ID,
        instructions: '',
        services,
        apiModels,
      });
      assert.ok(knowledge);
    });

    // ============================================================
    // Blocker 1: zero executable specs
    // ============================================================
    const ticket = { key: 'REG-1', summary: 'Regression', acceptanceCriteria: ['AC1'] };
    const generated = await httpRequest({ method: 'POST', path: '/api/test-cases/generate' }, {
      projectId: PROJECT_ID,
      ticket,
    });
    const testCases = generated.body.testCases || [];
    assert.ok(testCases.length > 0, 'Should generate at least one test case');

    const matchRes = await httpRequest({ method: 'POST', path: '/api/test-cases/match' }, {
      projectId: PROJECT_ID,
      testCases,
    });
    assert.equal(matchRes.status, 200);
    const mappings = (matchRes.body.matches || [])
      .filter((m) => m.status === 'matched' && m.selectedMatch)
      .map((m) => ({
        testCaseId: m.testCaseId,
        serviceId: m.selectedMatch.serviceId,
        operationId: m.selectedMatch.operationId,
        method: m.selectedMatch.method,
        path: m.selectedMatch.path,
        source: 'automatic',
      }));

    test('Regression: Mapped test cases produce executable specs and plans', async () => {
      const prepare = await httpRequest({ method: 'POST', path: '/api/test-specifications/prepare' }, {
        projectId: PROJECT_ID,
        testCases,
        mappings,
      });
      assert.equal(prepare.status, 200);
      assert.ok(Array.isArray(prepare.body.testSpecifications));
      assert.ok(prepare.body.testSpecifications.length > 0, 'Expected at least one executable spec');
      assert.ok(Object.keys(prepare.body.plans || {}).length > 0, 'Expected at least one execution plan');
      assert.ok(prepare.body.diagnostics.prepared >= 1, 'Prepared count should reflect executable specs');
    });

    // ============================================================
    // Blocker 2: invalid execution plan rejection
    // ============================================================
    test('Regression: Empty steps execution plan is rejected with 400', async () => {
      const bad = await httpRequest({ method: 'POST', path: '/api/runs/execute-dependent' }, {
        projectId: PROJECT_ID,
        testSpecification: { id: 'spec-bad' },
        executionPlan: { steps: [] },
        environment: {},
      });
      assert.equal(bad.status, 400);
      assert.ok(bad.body.error && bad.body.error.length > 0, 'Error message should be present');
    });

    // ============================================================
    // Blocker 3: project lookup consistency
    // ============================================================
    test('Regression: Project remains findable after generation and matching', async () => {
      const p = getProject(PROJECT_ID);
      assert.ok(p, 'Project should exist in repository');
      assert.equal(p.id, PROJECT_ID);

      const viaApi = await httpRequest({ method: 'GET', path: `/api/projects/${PROJECT_ID}` });
      assert.equal(viaApi.status, 200, 'Project API should still return 200');
      assert.equal(viaApi.body.project.id, PROJECT_ID);
    });

    test('Regression: Project lookup consistency across full workflow', async () => {
      const stages = [
        () => getProject(PROJECT_ID),
        () => listProjects().find((p) => p.id === PROJECT_ID),
        () => listServices(PROJECT_ID),
        () => require('./src/domain/ProjectKnowledgeRepository').getProjectKnowledge(PROJECT_ID),
        async () => await httpRequest({ method: 'GET', path: `/api/projects/${PROJECT_ID}` }),
      ];

      for (const stage of stages) {
        const result = stage();
        if (result === null || result === undefined) {
          throw new Error('Stage returned null/undefined during project lookup');
        }
      }
    });

    // ============================================================
    // End-to-end execution with valid plan
    // ============================================================
    test('Regression: Execute dependent returns persisted run', async () => {
      const services = listServices(PROJECT_ID);
      const apiModels = services.map((s) => getApiModel(PROJECT_ID, s.id));
      const knowledge = require('./src/domain/ProjectKnowledgeRepository').getProjectKnowledge(PROJECT_ID);
      const confirmedRels = (knowledge?.relationships || []).filter((r) => r.status === 'confirmed').map((r) => r.relationship || r);

      const plan = buildExecutionPlan({
        targetServiceId: 'svc-a',
        targetOperationId: 'op-a',
        services,
        apiModels,
        relationships: confirmedRels,
      });
      assert.ok(validatePlan(plan), 'Plan should be valid');
      assert.ok(plan.steps.length >= 1, 'Plan should have at least one step');

      const spec = createTestSpecification({
        id: `spec-${PROJECT_ID}`,
        title: 'Regression execution',
        description: '',
        method: 'GET',
        path: '/a',
        expectedBehavior: { status: 200 },
        testData: {},
      });

      const exec = await httpRequest({ method: 'POST', path: '/api/runs/execute-dependent' }, {
        projectId: PROJECT_ID,
        testSpecification: spec,
        executionPlan: plan,
        environment: {},
      });
      assert.equal(exec.status, 200);
      assert.ok(exec.body.runId || exec.body.run, 'Run should be persisted');
    });

    test('Regression: History lists persisted run for project', async () => {
      const list = await httpRequest({ method: 'GET', path: `/api/active/runs?projectId=${PROJECT_ID}` });
      assert.equal(list.status, 200);
      assert.ok(Array.isArray(list.body.runs));
    });

  } finally {
    mockServer.close();
    cleanup();
    console.log('\n=== Regression Summary ===');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`Active API Calls Observed:\n${apiCalls.map((a) => `- ${a.method} ${a.url} => ${a.status}`).join('\n')}`);
    if (failed > 0) process.exitCode = 1;
  }
}

runRegression().catch((error) => {
  console.error('Regression suite error:', error.message);
  console.error(error.stack);
  process.exitCode = 1;
});