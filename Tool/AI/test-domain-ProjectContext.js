/**
 * Focused tests for ProjectContext.
 * Run: node test-domain-ProjectContext.js
 */

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createProjectContext, resolveProject } = require('./src/domain/ProjectContext');
const { seedDefaultProject, createProject, getProject, listProjects, projectExists } = require('./src/domain/ProjectRepository');
const { DEFAULT_PROJECT } = require('./src/domain/ProjectIdentity');
const config = require('./src/config');

const uid = () => `test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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

test('default project context resolves to default project identity', () => {
  seedDefaultProject();
  const context = createProjectContext();
  const resolved = resolveProject();

  assertEqual(context.projectId, DEFAULT_PROJECT.id);
  assertEqual(context.project.id, DEFAULT_PROJECT.id);
  assertEqual(context.project.name, DEFAULT_PROJECT.name);
  assert.ok(context.isDefault);
  assert.ok(typeof context.project.toString === 'function');
});

test('default project context with empty/missing/null/undefined returns default', () => {
  seedDefaultProject();
  [{}, { projectId: '' }, { projectId: '   ' }, { projectId: null }, { projectId: undefined }].forEach((options) => {
    const ctx = createProjectContext(options);
    assertEqual(ctx.projectId, DEFAULT_PROJECT.id);
    assertEqual(ctx.isDefault, true);
  });
});

test('explicit persisted projectId resolves persisted project', () => {
  seedDefaultProject();
  const id = 'custom_acme_' + uid();
  createProject({ id, name: 'Custom Acme' });

  const ctx = createProjectContext({ projectId: id });

  assertEqual(ctx.project.id, id);
  assertEqual(ctx.project.name, 'Custom Acme');
  assert.ok(ctx.project.createdAt instanceof Date);
  assert.ok(ctx.project.updatedAt instanceof Date);
  assert.ok(ctx.isDefault === false);
});

test('resolveProject returns deterministic default instance', () => {
  seedDefaultProject();
  const first = resolveProject();
  const second = resolveProject();

  assertEqual(first.id, DEFAULT_PROJECT.id);
  assertEqual(first.name, DEFAULT_PROJECT.name);
  assertEqual(first.toString(), second.toString());
});

test('project context exposes projectId consistently for persisted project', () => {
  seedDefaultProject();
  const id = 'proj_1_' + uid();
  createProject({ id, name: 'Project One' });

  const ctx = createProjectContext({ projectId: id });
  assertEqual(ctx.projectId, ctx.project.id);
  assertEqual(ctx.projectId, id);
});

test('unknown projectId falls back to default and reports error', () => {
  seedDefaultProject();
  const ctx = createProjectContext({ projectId: 'unknown_project' });

  assertEqual(ctx.projectId, 'unknown_project');
  assert.ok(ctx.project.id === DEFAULT_PROJECT.id);
  assert.ok(ctx.isDefault);
  assert.ok(/Unknown projectId/.test(ctx.error));
});

test('resolveProject returns persisted project fields', () => {
  seedDefaultProject();
  const id = 'proj_fields_' + uid();
  createProject({ id, name: 'Project Fields' });
  const project = resolveProject({ projectId: id });

  assertEqual(project.id, id);
  assertEqual(project.name, 'Project Fields');
  assert.ok(project.createdAt instanceof Date);
  assert.ok(project.updatedAt instanceof Date);
});

test('duplicate project ID is rejected by repository', () => {
  seedDefaultProject();
  const id = 'dup_project_' + uid();
  createProject({ id, name: 'Original' });
  let threw = false;
  try {
    createProject({ id, name: 'Duplicate' });
  } catch (e) {
    threw = true;
  }
  assert.ok(threw, 'Expected duplicate project creation to throw.');
  assert.ok(projectExists(id));
  assert.equal(getProject(id).name, 'Original');
});

test('persistence across repository implementations is file-backed', () => {
  seedDefaultProject();
  const projectsDir = path.join(config.dataDir, 'projects');
  const beforeFiles = fs.readdirSync(projectsDir).filter((f) => f.endsWith('.json')).length;
  const id = 'persisted_1_' + uid();

  createProject({ id, name: 'Persisted One' });
  const afterFiles = fs.readdirSync(projectsDir).filter((f) => f.endsWith('.json')).length;

  assertEqual(afterFiles, beforeFiles + 1);
  assert.ok(projectExists(id));
  assert.ok(getProject(id).id === id);

  const listed = listProjects();
  assert.ok(listed.some((p) => p.id === id));
});

console.log(`\nProjectContext tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}