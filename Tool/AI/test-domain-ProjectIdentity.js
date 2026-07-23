/**
 * Focused tests for ProjectIdentity domain model.
 * Run: node test-domain-ProjectIdentity.js
 */

const assert = require('node:assert');
const {
  DEFAULT_PROJECT,
  createProjectIdentity,
  getDefaultProjectIdentity,
  validateProjectIdentity,
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

test('valid creation with explicit values', () => {
  const project = createProjectIdentity({
    id: 'proj_123',
    name: 'Acme Project',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  });

  assertEqual(project.id, 'proj_123');
  assertEqual(project.name, 'Acme Project');
  assert.ok(project.createdAt instanceof Date);
  assert.ok(project.updatedAt instanceof Date);
  assert.ok(typeof project.toString === 'function');
});

test('valid creation with Date objects', () => {
  const createdAt = new Date('2024-01-01T00:00:00.000Z');
  const updatedAt = new Date('2024-01-02T00:00:00.000Z');
  const project = createProjectIdentity({ id: 'p1', name: 'X', createdAt, updatedAt });

  assertEqual(project.createdAt.getTime(), createdAt.getTime());
  assertEqual(project.updatedAt.getTime(), updatedAt.getTime());
});

test('default project has canonical values', () => {
  const defaultProject = getDefaultProjectIdentity();

  assertEqual(defaultProject.id, DEFAULT_PROJECT.id);
  assertEqual(defaultProject.name, DEFAULT_PROJECT.name);
  assertEqual(defaultProject.createdAt.getTime(), new Date(DEFAULT_PROJECT.createdAt).getTime());
  assertEqual(defaultProject.updatedAt.getTime(), new Date(DEFAULT_PROJECT.updatedAt).getTime());
});

test('default properties are frozen', () => {
  assert.ok(Object.isFrozen(DEFAULT_PROJECT), 'DEFAULT_PROJECT should be frozen.');
});

test('throws for invalid id', () => {
  assertThrows(() => createProjectIdentity({ id: '', name: 'X' }));
  assertThrows(() => createProjectIdentity({ id: '   ', name: 'X' }));
  assertThrows(() => createProjectIdentity({ id: 123, name: 'X' }));
  assertThrows(() => createProjectIdentity({ id: null, name: 'X' }));
});

test('throws for invalid name', () => {
  assertThrows(() => createProjectIdentity({ id: 'p1', name: '' }));
  assertThrows(() => createProjectIdentity({ id: 'p1', name: '   ' }));
  assertThrows(() => createProjectIdentity({ id: 'p1', name: null }));
  assertThrows(() => createProjectIdentity({ id: 'p1', name: 123 }));
});

test('throws for invalid timestamps', () => {
  assertThrows(() => createProjectIdentity({ id: 'p1', name: 'X', createdAt: 'not-a-date' }));
  assertThrows(() => createProjectIdentity({ id: 'p1', name: 'X', updatedAt: 'bad' }));
});

test('mutation safety: returned object properties are not live-bound to input', () => {
  const input = { id: 'p1', name: 'P', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' };
  const project = createProjectIdentity(input);

  input.id = 'mutated';
  input.name = 'mutated-name';

  assertEqual(project.id, 'p1');
  assertEqual(project.name, 'P');
  assertEqual(project.createdAt instanceof Date, true);
  assertEqual(project.updatedAt instanceof Date, true);
});

test('toString returns deterministic JSON with ISO timestamps', () => {
  const project = createProjectIdentity({
    id: 'proj_abc',
    name: 'Project ABC',
    createdAt: '2024-03-01T00:00:00.000Z',
    updatedAt: '2024-03-02T00:00:00.000Z',
  });

  const text = project.toString();
  const parsed = JSON.parse(text);

  assertEqual(parsed.id, 'proj_abc');
  assertEqual(parsed.name, 'Project ABC');
  assert.ok(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed.createdAt));
  assert.ok(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed.updatedAt));
});

console.log(`\nProjectIdentity tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}