/**
 * Focused tests for Sprint 01 ProjectIdentity validation additions.
 * Run: node test-domain-ProjectIdentity-validation.js
 */

const assert = require('node:assert');
const {
  DEFAULT_PROJECT,
  validateProjectId,
  validateProjectName,
} = require('./src/domain/ProjectIdentity');

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

function assertThrows(fn) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
  }
  assert.ok(threw, 'Expected function to throw.');
}

function assertThrowsWithMessage(fn, expectedMessage) {
  let actualMessage = null;
  try {
    fn();
  } catch (error) {
    actualMessage = error && error.message ? error.message : String(error);
  }
  assert.ok(actualMessage, 'Expected function to throw.');
  assert.strictEqual(actualMessage, expectedMessage);
}

// validateProjectId tests

test('validateProjectId accepts valid IDs', () => {
  validateProjectId('payments-api');
  validateProjectId('default');
  validateProjectId('proj_123');
  validateProjectId('my.project');
  validateProjectId('a'.repeat(100));
});

test('validateProjectId throws for empty id', () => {
  assertThrowsWithMessage(() => validateProjectId(''), 'Project id must be a non-empty string.');
  assertThrowsWithMessage(() => validateProjectId('   '), 'Project id must be a non-empty string.');
});

test('validateProjectId throws for non-string id', () => {
  assertThrowsWithMessage(() => validateProjectId(123), 'Project id must be a non-empty string.');
  assertThrowsWithMessage(() => validateProjectId(null), 'Project id must be a non-empty string.');
});

test('validateProjectId throws for ids over 100 chars', () => {
  assertThrowsWithMessage(() => validateProjectId('a'.repeat(101)), 'Project id must be at most 100 characters.');
});

test('validateProjectId throws for invalid characters', () => {
  assertThrowsWithMessage(() => validateProjectId('payments api'), 'Project id must contain only alphanumeric characters, hyphens, underscores, and dots.');
  assertThrowsWithMessage(() => validateProjectId('payments@api'), 'Project id must contain only alphanumeric characters, hyphens, underscores, and dots.');
  assertThrowsWithMessage(() => validateProjectId('payments/api'), 'Project id must contain only alphanumeric characters, hyphens, underscores, and dots.');
});

test('validateProjectId allows documented character set', () => {
  validateProjectId('aA0._-');
});

// validateProjectName tests

test('validateProjectName accepts valid names', () => {
  validateProjectName('Payments API');
  validateProjectName('Default Project');
});

test('validateProjectName throws for empty name', () => {
  assertThrowsWithMessage(() => validateProjectName(''), 'Project name must be a non-empty string.');
  assertThrowsWithMessage(() => validateProjectName('   '), 'Project name must be a non-empty string.');
});

test('validateProjectName throws for non-string name', () => {
  assertThrowsWithMessage(() => validateProjectName(123), 'Project name must be a non-empty string.');
  assertThrowsWithMessage(() => validateProjectName(null), 'Project name must be a non-empty string.');
});

console.log(`\nProjectIdentity validation tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}