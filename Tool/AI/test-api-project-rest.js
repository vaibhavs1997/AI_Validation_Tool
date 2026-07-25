/**
 * HTTP-level tests for Project REST API endpoints.
 * Run: node test-api-project-rest.js
 */

const assert = require('node:assert');
const http = require('http');

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function waitForServer() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      request('GET', '/api/health').then((res) => {
        if (res.status === 200) { clearInterval(interval); resolve(); }
      }).catch(() => {});
    }, 100);
    setTimeout(() => { clearInterval(interval); resolve(); }, 10000);
  });
}

async function runTests() {
  await waitForServer();

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try { fn(); passed++; }
    catch (error) { failed++; console.error(`FAIL: ${name}`); console.error(error && error.message ? error.message : error); }
  }

  function assertEqual(actual, expected) { assert.strictEqual(actual, expected); }

  test('GET /api/health is 200', async () => {
    const res = await request('GET', '/api/health');
    assertEqual(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  test('GET /api/projects is 200 and returns projects', async () => {
    const res = await request('GET', '/api/projects');
    assertEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.projects));
    assert.ok(res.body.projects.length >= 1);
  });

  test('GET /api/projects/:id returns project', async () => {
    const res = await request('GET', '/api/projects/default');
    assertEqual(res.status, 200);
    assert.ok(res.body.project);
    assert.equal(res.body.project.id, 'default');
  });

  test('GET /api/projects/:id returns 404 for missing', async () => {
    const res = await request('GET', '/api/projects/nonexistent-api-456');
    assertEqual(res.status, 404);
    assert.ok(/Project not found/.test(res.body.error));
  });

  test('POST /api/projects creates with 201', async () => {
    const id = 'rest-api-' + Date.now().toString(36);
    const res = await request('POST', '/api/projects', { id, name: 'REST API Test' });
    assertEqual(res.status, 201);
    assert.equal(res.body.project.id, id);
    assert.equal(res.body.project.name, 'REST API Test');
  });

  test('POST /api/projects returns 400 when id missing', async () => {
    const res = await request('POST', '/api/projects', {});
    assertEqual(res.status, 400);
  });

  test('POST /api/projects returns 409 on duplicate', async () => {
    const id = 'rest-dup-' + Date.now().toString(36);
    await request('POST', '/api/projects', { id, name: 'First' });
    const res = await request('POST', '/api/projects', { id, name: 'Second' });
    assertEqual(res.status, 409);
  });

  test('PATCH /api/projects/:id updates with 200', async () => {
    const id = 'rest-update-' + Date.now().toString(36);
    await request('POST', '/api/projects', { id, name: 'Before' });
    const res = await request('PATCH', `/api/projects/${id}`, { name: 'After' });
    assertEqual(res.status, 200);
    assert.equal(res.body.project.name, 'After');
  });

  test('PATCH /api/projects/:id returns 404 for missing', async () => {
    const res = await request('PATCH', '/api/projects/nonexistent-api-789', { name: 'X' });
    assertEqual(res.status, 404);
  });

  test('DELETE /api/projects/:id deletes with 200', async () => {
    const id = 'rest-delete-' + Date.now().toString(36);
    await request('POST', '/api/projects', { id, name: 'Delete Me' });
    const res = await request('DELETE', `/api/projects/${id}`);
    assertEqual(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.id, id);
  });

  test('DELETE /api/projects/:id returns 404 for missing', async () => {
    const res = await request('DELETE', '/api/projects/nonexistent-api-999');
    assertEqual(res.status, 404);
  });

  test('DELETE /api/projects/:id returns 400 for default project', async () => {
    const res = await request('DELETE', '/api/projects/default');
    assertEqual(res.status, 400);
  });

  test('GET /api/projects supports search query', async () => {
    const unique = 'rest-search-' + Date.now().toString(36);
    await request('POST', '/api/projects', { id: unique, name: 'UniqueSearchName123' });
    const res = await request('GET', `/api/projects?search=UniqueSearchName123`);
    assertEqual(res.status, 200);
    assert.ok(res.body.projects.some((p) => p.id === unique));
  });

  test('GET /api/projects supports sort and order', async () => {
    const res = await request('GET', `/api/projects?sort=id&order=desc`);
    assertEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.projects));
  });

  test('GET /api/projects supports limit and offset', async () => {
    const res = await request('GET', `/api/projects?limit=1`);
    assertEqual(res.status, 200);
    assert.ok(res.body.projects.length <= 1);
  });

  console.log(`\nProject REST API tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) { process.exitCode = 1; }
}

runTests();