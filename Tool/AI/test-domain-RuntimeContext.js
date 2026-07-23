/**
 * Focused tests for RuntimeContext/value binding.
 * Run: node test-domain-RuntimeContext.js
 */

const assert = require('node:assert');
const { createRuntimeContext, extractValue, transformValue, injectValue, parseLocation } = require('./src/domain/RuntimeContext');

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

test('parseLocation recognizes valid locations', () => {
  const loc = parseLocation('response.body.token');
  assert.ok(loc);
  assert.equal(loc.kind, 'response');
  assert.equal(loc.requestTarget, 'body');
  assert.deepEqual(loc.path, ['token']);
});

test('parseLocation rejects invalid locations', () => {
  assert.ok(!parseLocation('invalid'));
  assert.ok(!parseLocation('response.invalid.token'));
  assert.ok(!parseLocation('header.Authorization'));
});

test('extractValue retrieves nested values', () => {
  const response = { body: { token: 'abc123', nested: { deep: 'value' } } };
  assert.equal(extractValue(response, 'response.body.token'), 'abc123');
  assert.equal(extractValue(response, 'response.body.nested.deep'), 'value');
  assert.equal(extractValue(response, 'response.body.missing'), undefined);
});

test('transformValue replaces {{value}} placeholder', () => {
  assert.equal(transformValue('token', 'Bearer {{value}}'), 'Bearer token');
  assert.equal(transformValue('token', ''), 'token');
  assert.equal(transformValue(123, 'prefix_{{value}}'), 'prefix_123');
});

test('injectValue sets header, body, query, path', () => {
  const target = {};
  injectValue(target, 'request.header.Authorization', 'Bearer token');
  assert.equal(target.headers.Authorization, 'Bearer token');

  const bodyTarget = {};
  injectValue(bodyTarget, 'request.body.accessToken', 'login-token');
  assert.equal(bodyTarget.body.accessToken, 'login-token');

  const queryTarget = {};
  injectValue(queryTarget, 'request.query.limit', '10');
  assert.equal(queryTarget.query.limit, '10');

  const pathTarget = {};
  injectValue(pathTarget, 'request.path.userId', '123');
  assert.equal(pathTarget.path.userId, '123');
});

test('source reused by multiple targets', () => {
  const ctx = createRuntimeContext();
  ctx.setResponse('auth::generate-token', { body: { token: 'shared-token' } });

  ctx.addBinding({
    relationship: { type: 'authentication', source: { location: 'response.body.token' }, target: { location: 'request.header.Authorization' }, transform: 'Bearer {{value}}' },
    from: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
    to: { serviceId: 'auth', operationId: 'login', location: 'request.header.Authorization' },
  });

  ctx.addBinding({
    relationship: { type: 'authentication', source: { location: 'response.body.token' }, target: { location: 'request.header.Authorization' }, transform: 'Bearer {{value}}' },
    from: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
    to: { serviceId: 'profile', operationId: 'update-profile', location: 'request.header.Authorization' },
  });

  const loginReq = ctx.applyBindings({});
  assert.equal(loginReq.headers.Authorization, 'Bearer shared-token');

  const profileReq = ctx.applyBindings({});
  assert.equal(profileReq.headers.Authorization, 'Bearer shared-token');
});

test('multiple upstream values injected into one request', () => {
  const ctx = createRuntimeContext();
  ctx.setResponse('auth::generate-token', { body: { token: 'gen-token' } });
  ctx.setResponse('auth::login', { body: { accessToken: 'login-token' } });

  ctx.addBinding({
    relationship: { type: 'authentication', source: { location: 'response.body.token' }, target: { location: 'request.header.Authorization' }, transform: 'Bearer {{value}}' },
    from: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
    to: { serviceId: 'profile', operationId: 'update-profile', location: 'request.header.Authorization' },
  });

  ctx.addBinding({
    relationship: { type: 'data_dependency', source: { location: 'response.body.accessToken' }, target: { location: 'request.body.accessToken' }, transform: '' },
    from: { serviceId: 'auth', operationId: 'login', location: 'response.body.accessToken' },
    to: { serviceId: 'profile', operationId: 'update-profile', location: 'request.body.accessToken' },
  });

  const request = ctx.applyBindings({});
  assert.equal(request.headers.Authorization, 'Bearer gen-token');
  assert.equal(request.body.accessToken, 'login-token');
});

test('missing source value is skipped', () => {
  const ctx = createRuntimeContext();
  ctx.setResponse('auth::generate-token', { body: {} });

  ctx.addBinding({
    relationship: { type: 'authentication', source: { location: 'response.body.token' }, target: { location: 'request.header.Authorization' } },
    from: { serviceId: 'auth', operationId: 'generate-token', location: 'response.body.token' },
    to: { serviceId: 'auth', operationId: 'login', location: 'request.header.Authorization' },
  });

  const request = ctx.applyBindings({});
  assert.equal(request.headers, undefined);
});

test('invalid source/target location is ignored', () => {
  const ctx = createRuntimeContext();
  ctx.setResponse('auth::generate-token', { body: { token: 't' } });

  ctx.addBinding({
    relationship: { type: 'authentication', source: { location: 'invalid.location' }, target: { location: 'request.header.Authorization' } },
    from: { serviceId: 'auth', operationId: 'generate-token', location: 'invalid.location' },
    to: { serviceId: 'auth', operationId: 'login', location: 'request.header.Authorization' },
  });

  const request = ctx.applyBindings({});
  assert.equal(request.headers, undefined);
});

test('nested JSON extraction/injection', () => {
  const ctx = createRuntimeContext();
  ctx.setResponse('auth::login', { body: { user: { session: { token: 'deep-token' } } } });

  ctx.addBinding({
    relationship: { type: 'data_dependency', source: { location: 'response.body.user.session.token' }, target: { location: 'request.body.auth.token' }, transform: '' },
    from: { serviceId: 'auth', operationId: 'login', location: 'response.body.user.session.token' },
    to: { serviceId: 'profile', operationId: 'update-profile', location: 'request.body.auth.token' },
  });

  const request = ctx.applyBindings({});
  assert.equal(request.body.auth.token, 'deep-token');
});

console.log(`\nRuntimeContext tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}