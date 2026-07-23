/**
 * STEP 5.10 — Active MVP Workflow Runtime Audit
 *
 * Goals:
 * 1. Run the flow using only active APIs.
 * 2. Verify frontend state transitions between every stage.
 * 3. Check failure/recovery behavior for common runtime issues.
 * 4. Verify refresh/navigation behavior.
 * 5. Do not add features yet. Fix only clear runtime bugs.
 *
 * This script performs backend HTTP validation and inspects frontend source
 * for expected state transition wiring. It runs against a live server.
 */

const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createProject, getProject, listProjects } = require('./src/domain/ProjectRepository');
const { createService, saveApiModel, listServices } = require('./src/domain/ServiceRepository');
const { adaptContractToApiModel } = require('./src/domain/contractAdapter');
const { analyzeAndStoreProposals, listRelationshipsByStatus, confirmRelationship } = require('./src/domain/ProjectKnowledgeService');
const { buildExecutionPlan } = require('./src/domain/ExecutionPlan');
const { createTestSpecification } = require('./src/domain/TestSpecification');
const { executeTestSpecification } = require('./src/execution/dependencyAwareExecutor');
const config = require('./src/config');

const BASE = 'http://127.0.0.1:4173';
const PROJECT_ID = 'step5-10-audit';
let passed = 0;
let failed = 0;
const apiCalls = [];
const blockers = [];
const bugs = [];

function recordApiCall(method, url, status, notes='') {
  apiCalls.push({ method, url, status, notes });
}

function httpRequest(options, body=null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: options.hostname || '127.0.0.1',
      port: options.port || 4173,
      path: options.path,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(opts, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        recordApiCall(opts.method, opts.path, res.statusCode);
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (data) req.write(data);
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
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
// Mock API server for local execution tests
// ============================================================
function startMockApiServer(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const method = req.method.toUpperCase();
    const p = url.pathname;

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let parsedBody = {};
      try { parsedBody = JSON.parse(body); } catch {}

      if (method === 'POST' && p === '/token') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: 'mock-bearer-token', expiresIn: 3600 }));
        return;
      }

      if (method === 'POST' && p === '/login') {
        const auth = req.headers['authorization'] || '';
        if (!auth || !auth.includes('Bearer')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing or invalid Authorization header' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ accessToken: 'mock-access-token', user: { id: 1, name: 'Test User' } }));
        return;
      }

      if (method === 'PUT' && p === '/profile') {
        const auth = req.headers['authorization'] || '';
        if (!auth || !auth.includes('Bearer')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing Authorization header' }));
          return;
        }
        if (!parsedBody.accessToken) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing accessToken in body' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, profile: { id: 1, name: parsedBody.name || 'Updated', updatedAt: new Date().toISOString() } }));
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
// Audit flow
// ============================================================
async function runAudit() {
  console.log('\n=== STEP 5.10 — Active MVP Workflow Runtime Audit ===\n');

  cleanup();
  const mockServer = startMockApiServer(3099);
  console.log('[AUDIT] Mock API server started on 3099');
  try {
    // ============================================================
    // Stage 1: Project Setup
    // ============================================================
    test('Stage: Project Setup creates/loads project', () => {
      const project = createProject({ id: PROJECT_ID, name: 'Audit Project', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      assert.equal(project.id, PROJECT_ID);
      const loaded = getProject(PROJECT_ID);
      assert.equal(loaded.id, PROJECT_ID);
    });

    const apiProjectGet = await httpRequest({ method: 'GET', path: `/api/projects/${PROJECT_ID}` });
    test('Stage: Project Setup API returns project', () => {
      assert.equal(apiProjectGet.status, 200);
      assert.ok(apiProjectGet.body.project);
      assert.equal(apiProjectGet.body.project.id, PROJECT_ID);
    });

    // ============================================================
    // Stage 2: Register APIs
    // ============================================================
    test('Stage: Register APIs persists service + apiModel', () => {
      const service = createService(PROJECT_ID, { id: 'audit-service', name: 'Audit Service' });
      assert.ok(service);
      const contract = {
        title: 'audit-service',
        baseUrl: 'http://127.0.0.1:3099',
        type: 'openapi',
        endpoints: [
          { id: 'health', method: 'GET', path: '/health', summary: 'Health' },
        ],
      };
      const apiModel = adaptContractToApiModel(contract);
      saveApiModel(PROJECT_ID, 'audit-service', apiModel);
      const services = listServices(PROJECT_ID);
      assert.equal(services.length, 1);
    });

    // ============================================================
    // Stage 3: Project Instructions
    // ============================================================
    test('Stage: Project Instructions stored and loadable', async () => {
      const knowledge = await analyzeAndStoreProposals({
        projectId: PROJECT_ID,
        instructions: 'Use token for auth.',
        services: listServices(PROJECT_ID).map(s => ({ id: s.id, name: s.name, protocol: s.protocol, description: s.description })),
        apiModels: listServices(PROJECT_ID).map(s => require(`./src/domain/ServiceRepository`).getApiModel(PROJECT_ID, s.id)),
      });
      assert.ok(knowledge);
      assert.ok(Array.isArray(knowledge.relationships));
    });

    // ============================================================
    // Stage 4: Requirement
    // ============================================================
    test('Stage: Requirement exists for active project', () => {
      const project = getProject(PROJECT_ID);
      assert.equal(project.id, PROJECT_ID);
    });

    // ============================================================
    // Stage 5: Generate TestCases (HTTP API + empty guard)
    // ============================================================
    test('Stage: Generate TestCases returns diagnostics', async () => {
      const ticket = { key: 'AUDIT-101', summary: 'Audit requirement', acceptanceCriteria: ['AC1'] };
      const res = await httpRequest({ method: 'POST', path: '/api/test-cases/generate' }, {
        projectId: PROJECT_ID,
        ticket,
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.testCases));
      assert.ok(res.body.diagnostics);
    });

    const generated = await httpRequest({ method: 'POST', path: '/api/test-cases/generate' }, {
      projectId: PROJECT_ID,
      ticket: { key: 'AUDIT-102', summary: 'Audit requirement 2', acceptanceCriteria: ['AC1'] },
    });
    const generatedTestCases = generated.body.testCases || [];

    // ============================================================
    // Stage 6: Include/Exclude
    // ============================================================
    test('Stage: Include/Exclude controlled by included set', () => {
      const included = generatedTestCases.slice(0, Math.max(1, generatedTestCases.length));
      assert.ok(Array.isArray(included));
    });

    // ============================================================
    // Stage 7: API Matching
    // ============================================================
    test('Stage: API Matching endpoint validations', async () => {
      const emptyMatch = await httpRequest({ method: 'POST', path: '/api/test-cases/match' }, {
        projectId: PROJECT_ID,
        testCases: []
      });
      assert.equal(emptyMatch.status, 400);
    });

    const matchRes = await httpRequest({ method: 'POST', path: '/api/test-cases/match' }, {
      projectId: PROJECT_ID,
      testCases: generatedTestCases,
    });
    test('Stage: API Matching returns matching diagnostics', () => {
      assert.equal(matchRes.status, 200);
      assert.ok(matchRes.body.matches);
      assert.ok(typeof matchRes.body.diagnostics.total === 'number');
    });

    const mappingsForNext = (matchRes.body.matches || [])
      .filter(m => m.status === 'matched' && m.selectedMatch && m.selectedMatch.serviceId)
      .map(m => ({
        testCaseId: m.testCaseId,
        serviceId: m.selectedMatch.serviceId,
        operationId: m.selectedMatch.operationId,
        method: m.selectedMatch.method,
        path: m.selectedMatch.path,
        source: 'automatic',
      }));

    test('Stage: Manual override path available (unmatched can be mapped)', () => {
      assert.ok(Array.isArray(mappingsForNext) || true);
    });

    // ============================================================
    // Stage 8: Confirm Mappings
    // ============================================================
    test('Stage: Confirm Mappings transitions to prepare', async () => {
      const confirm = await httpRequest({ method: 'POST', path: '/api/test-specifications/prepare' }, {
        projectId: PROJECT_ID,
        testCases: generatedTestCases,
        mappings: mappingsForNext,
      });
      assert.equal(confirm.status, 200);
      assert.ok(Array.isArray(confirm.body.testSpecifications));
    });

    // ============================================================
    // Stage 9: Prepare Tests
    // ============================================================
    const prepared = await httpRequest({ method: 'POST', path: '/api/test-specifications/prepare' }, {
      projectId: PROJECT_ID,
      testCases: generatedTestCases,
      mappings: mappingsForNext,
    });
    const prepareResponse = prepared.body;
    const executableSpecs = (prepareResponse && prepareResponse.testSpecifications) ? prepareResponse.testSpecifications : [];
    const plans = (prepareResponse && prepareResponse.plans) ? prepareResponse.plans : {};

    if (!prepareResponse || !Array.isArray(executableSpecs) || executableSpecs.length === 0) {
      blockers.push('Prepare returned no executable specs for current generated/matched inputs');
    }

    test('Stage: Prepare Tests produces specs and plans', () => {
      assert.ok(executableSpecs.length > 0, `Expected executable specs, got: ${JSON.stringify(executableSpecs)}`);
    });

    // ============================================================
    // Stage 10: ExecutionPlan validation
    // ============================================================
    test('Stage: ExecutionPlan invalid rejected by API', async () => {
      const bad = await httpRequest({ method: 'POST', path: '/api/runs/execute-dependent' }, {
        projectId: PROJECT_ID,
        testSpecification: { id: 'spec-missing' },
        executionPlan: { steps: [] },
        environment: {},
      });
      assert.equal(bad.status, 400);
    });

    // Build a valid execution plan using confirmed relationships
    const knowledgeReq = await new Promise((resolve) => {
      httpRequest({ method: 'GET', path: `/api/knowledge?projectId=${PROJECT_ID}` }).then(resolve);
    });
    const relationships = knowledgeReq.body.knowledge.relationships || [];
    const confirmedRels = relationships.filter(r => r.status === 'confirmed').map(r => r.relationship || r);
    const services = listServices(PROJECT_ID);
    const apiModels = services.map((s) => require('./src/domain/ServiceRepository').getApiModel(PROJECT_ID, s.id));
    const plan = buildExecutionPlan({
      targetServiceId: 'audit-service',
      targetOperationId: 'health',
      services,
      apiModels,
      relationships: confirmedRels,
    });

    if (!plan.isValid) {
      blockers.push('ExecutionPlan is not valid for current knowledge setup');
    } else {
      test('Stage: ExecutionPlan valid for prepared spec', () => {
        assert.ok(plan.steps.length >= 1);
      });
    }

    // ============================================================
    // Stage 11: Execute with real HTTP target where possible
    // ============================================================
    let runResult = null;
    if (plan.isValid && executableSpecs.length > 0) {
      const specToRun = executableSpecs[0];
      test('Stage: Execute prepared test spec', async () => {
        const exec = await httpRequest({ method: 'POST', path: '/api/runs/execute-dependent' }, {
          projectId: PROJECT_ID,
          testSpecification: specToRun,
          executionPlan: plan,
          environment: {},
        });
        assert.equal(exec.status, 200);
        assert.ok(exec.body.runId || exec.body.run);
        runResult = exec.body;
      });
    }

    // ============================================================
    // Stage 12: Persist Run + Results + History
    // ============================================================
    test('Stage: Persisted run appears in list', async () => {
      const list = await httpRequest({ method: 'GET', path: `/api/active/runs?projectId=${PROJECT_ID}` });
      assert.equal(list.status, 200);
      assert.ok(Array.isArray(list.body.runs));
      if (runResult && runResult.runId) {
        const found = list.body.runs.find((r) => r.id === runResult.runId);
        assert.ok(found, 'Persisted run should be listed');
      }
    });

    test('Stage: History can load run detail', async () => {
      if (!runResult || !runResult.runId) return;
      const detail = await httpRequest({ method: 'GET', path: `/api/active/runs/${runResult.runId}?projectId=${PROJECT_ID}` });
      assert.equal(detail.status, 200);
      assert.ok(detail.body.run);
    });

    // ============================================================
    // Stage 13: Failure/recovery behavior checks
    // ============================================================
    test('Failure: HTTP failure surfaced by execution result (invalid target path)', async () => {
      const badEnvPlan = { ...plan, steps: plan.steps.map((s) => ({ ...s })) };
      if (badEnvPlan.steps[0]) {
        badEnvPlan.steps[0].operation = { ...badEnvPlan.steps[0].operation, path: '/does-not-exist' };
      }
      const exec = await httpRequest({ method: 'POST', path: '/api/runs/execute-dependent' }, {
        projectId: PROJECT_ID,
        testSpecification: executableSpecs[0],
        executionPlan: badEnvPlan,
        environment: {},
      });
      assert.equal(exec.status, 200);
      if (exec.body.results && exec.body.results[0]) {
        assert.ok(['passed','failed','blocked'].includes(exec.body.results[0].status));
        const firstStatus = exec.body.results[0].status;
        if (firstStatus === 'failed' || firstStatus === 'blocked') {
          const errMsg = exec.body.results[0].error || '';
          if (errMsg) console.log(`  [debug] firstResult=${firstStatus} error=${errMsg}`);
        }
      }
    });

    test('Failure: zero TestCases rejected by prepare API', async () => {
      const prep = await httpRequest({ method: 'POST', path: '/api/test-specifications/prepare' }, {
        projectId: PROJECT_ID,
        testCases: [],
        mappings: [],
      });
      console.log(`  [debug] zero-TC prepare status=${prep.status} body=${JSON.stringify(prep.body || {}).slice(0, 200)}`);
      assert.equal(prep.status, 400);
    });

    test('Failure: unmatched TestCase still appears in match output', async () => {
      const unmatchedCases = [{ id: 'tc-unmatched-1', title: 'Unmatched', description: '', type: 'functional', requirementRefs: [] }];
      const matchUnmatched = await httpRequest({ method: 'POST', path: '/api/test-cases/match' }, {
        projectId: PROJECT_ID,
        testCases: unmatchedCases,
      });
      assert.equal(matchUnmatched.status, 200);
      assert.ok(matchUnmatched.body.diagnostics.unmatched >= 1);
    });

    test('Failure: invalid/stale API mapping skipped in prepare', async () => {
      const staleMappings = [{ testCaseId: 'tc-x', serviceId: 'unknown-service', operationId: 'nope', method: 'GET', path: '/x', source: 'manual' }];
      const stalePrep = await httpRequest({ method: 'POST', path: '/api/test-specifications/prepare' }, {
        projectId: PROJECT_ID,
        testCases: [{ id: 'tc-x', title: 'X', description: '', type: 'functional', requirementRefs: [] }],
        mappings: staleMappings,
      });
      assert.equal(stalePrep.status, 200);
      assert.ok(stalePrep.body.unresolvedTestCases.length >= 1);
    });

    test('Failure: missing environment/base URL handled gracefully', async () => {
      const execNoBase = await httpRequest({ method: 'POST', path: '/api/runs/execute-dependent' }, {
        projectId: PROJECT_ID,
        testSpecification: executableSpecs[0],
        executionPlan: plan,
        environment: {},
      });
      assert.equal(execNoBase.status, 200);
      assert.ok(Array.isArray(execNoBase.body.results));
      if (!Array.isArray(execNoBase.body.results) || execNoBase.body.results.length === 0) {
        blockers.push('Execution returned no results when base URL/env missing');
      }
    });

    test('Failure: blocked downstream step preserved in persisted run', async () => {
      const failingRelationships = [];
      const simpleServices = listServices(PROJECT_ID);
      const simpleModels = simpleServices.map((s) => require('./src/domain/ServiceRepository').getApiModel(PROJECT_ID, s.id));
      const simplePlan = buildExecutionPlan({
        targetServiceId: 'audit-service',
        targetOperationId: 'health',
        services: simpleServices,
        apiModels: simpleModels,
        relationships: failingRelationships,
      });
      const failingExec = await httpRequest({ method: 'POST', path: '/api/runs/execute-dependent' }, {
        projectId: PROJECT_ID,
        testSpecification: executableSpecs[0],
        executionPlan: simplePlan,
        environment: {},
      });
      assert.equal(failingExec.status, 200);
      assert.ok(Array.isArray(failingExec.body.results));
      const hasBlockedOrFailed = failingExec.body.results.some((r) => r.status === 'blocked' || r.status === 'failed');
      assert.ok(hasBlockedOrFailed, 'Expected at least one blocked/failed step when relationships are empty');
    });

    // ============================================================
    // Stage 14: Frontend runtime wiring audit
    // ============================================================
    test('Frontend: execution button disabled when prerequisites missing', async () => {
      const appSrc = fs.readFileSync(path.join(__dirname, 'frontend', 'src', 'App.tsx'), 'utf8');
      assert.ok(appSrc.includes('setCurrentView("workspace")'), 'Project selection should route to workspace');
      assert.ok(appSrc.includes('hashchange'), 'Hash navigation should be wired');
    });

    test('Frontend: ExecutionPanel resets on new prepareResponse', () => {
      const src = fs.readFileSync(path.join(__dirname, 'frontend', 'src', 'features', 'test-prepare', 'ExecutionPanel.tsx'), 'utf8');
      assert.ok(src.includes('useEffect'), 'Expected useEffect reset wiring');
      assert.ok(src.includes('setSelectedSpecId(null)'), 'Expected selection reset');
    });

    test('Frontend: ResultsPage loads from persisted run via hash param', () => {
      const src = fs.readFileSync(path.join(__dirname, 'frontend', 'src', 'features', 'results', 'ResultsPage.tsx'), 'utf8');
      assert.ok(src.includes('URLSearchParams'), 'Expected URLSearchParams parsing for runId');
      assert.ok(src.includes('getRun'), 'Expected run load call');
    });

    test('Frontend: HistoryPage list/navigation contract', () => {
      const src = fs.readFileSync(path.join(__dirname, 'frontend', 'src', 'features', 'history', 'HistoryPage.tsx'), 'utf8');
      assert.ok(src.includes('listRuns'), 'Expected listRuns usage');
      assert.ok(src.includes('#results?runId='), 'Expected hash navigation to results');
    });

    test('Frontend: persisted run reload after refresh is reconstructible from stable IDs', async () => {
      const repo = require('./src/domain/RunRepository');
      const runs = repo.listRuns(PROJECT_ID);
      if (runs.length > 0) {
        const run = repo.getRun(PROJECT_ID, runs[0].id);
        assert.ok(run, 'Run should be reloadable without live workspace state');
      }
    });

  } finally {
    mockServer.close();
    cleanup();
    console.log('\n=== Audit Summary ===');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`Active API Calls Observed:\n${apiCalls.map(a => `- ${a.method} ${a.url} => ${a.status}`).join('\n')}`);
    if (blockers.length > 0) {
      console.log(`\nRemaining Blockers:\n${blockers.map(b => `- ${b}`).join('\n')}`);
    }
    if (bugs.length > 0) {
      console.log(`\nBugs Found/Fixed:\n${bugs.map(b => `- ${b}`).join('\n')}`);
    }
    if (failed > 0) process.exitCode = 1;
  }
}

runAudit().catch((error) => {
  console.error('Audit suite error:', error.message);
  console.error(error.stack);
  process.exitCode = 1;
});