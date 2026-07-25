/**
 * Focused tests for Sprint 01 ProjectRepository enhancements.
 * Run: node test-domain-project-repository.js
 */

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { seedDefaultProject, createProject, getProject, listProjects, updateProject, deleteProject, searchProjects, projectExists } = require('./src/domain/ProjectRepository');
const { DEFAULT_PROJECT } = require('./src/domain/ProjectIdentity');
const config = require('./src/config');

const uid = () => `repo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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

// Setup/teardown helpers

const projectsDir = path.join(config.dataDir, 'projects');

function cleanTestProjects() {
  if (!fs.existsSync(projectsDir)) return;
  const files = fs.readdirSync(projectsDir).filter((f) => f.startsWith('repo_') || f.startsWith('test_repo_'));
  files.forEach((file) => {
    try {
      fs.unlinkSync(path.join(projectsDir, file));
    } catch (e) {
      // ignore cleanup errors
    }
  });
}

// Tests

test('seedDefaultProject creates default project if missing', () => {
  cleanTestProjects();
  const project = seedDefaultProject();
  assertEqual(project.id, DEFAULT_PROJECT.id);
  assertEqual(project.name, DEFAULT_PROJECT.name);
});

test('createProject creates a new project', () => {
  cleanTestProjects();
  seedDefaultProject();
  const id = 'repo_' + uid();
  const project = createProject({ id, name: 'Repository Test Project' });
  assertEqual(project.id, id);
  assertEqual(project.name, 'Repository Test Project');
  assert.ok(project.createdAt instanceof Date);
  assert.ok(project.updatedAt instanceof Date);
});

test('createProject rejects duplicate IDs', () => {
  cleanTestProjects();
  seedDefaultProject();
  const id = 'repo_dup_' + uid();
  createProject({ id, name: 'Original' });
  assertThrows(() => createProject({ id, name: 'Duplicate' }));
});

test('getProject returns project by ID', () => {
  cleanTestProjects();
  seedDefaultProject();
  const id = 'repo_get_' + uid();
  createProject({ id, name: 'Get Me' });
  const project = getProject(id);
  assert.ok(project);
  assertEqual(project.id, id);
  assertEqual(project.name, 'Get Me');
});

test('getProject returns null for missing project', () => {
  cleanTestProjects();
  seedDefaultProject();
  const project = getProject('repo_missing_' + uid());
  assert.strictEqual(project, null);
});

test('projectExists returns true for existing project', () => {
  cleanTestProjects();
  seedDefaultProject();
  const id = 'repo_exists_' + uid();
  createProject({ id, name: 'Exists' });
  assert.ok(projectExists(id));
});

test('projectExists returns false for missing project', () => {
  cleanTestProjects();
  seedDefaultProject();
  assert.ok(!projectExists('repo_notexists_' + uid()));
});

test('listProjects returns all projects', () => {
  cleanTestProjects();
  seedDefaultProject();
  const id1 = 'repo_list_' + uid();
  const id2 = 'repo_list2_' + uid();
  createProject({ id: id1, name: 'List One' });
  createProject({ id: id2, name: 'List Two' });

  const projects = listProjects();
  assert.ok(projects.some((p) => p.id === id1));
  assert.ok(projects.some((p) => p.id === id2));
  assert.ok(projects.some((p) => p.id === DEFAULT_PROJECT.id));
});

test('listProjects supports search', () => {
  cleanTestProjects();
  seedDefaultProject();
  const id = 'repo_search_' + uid();
  createProject({ id, name: 'Unique Search Name' });

  const all = listProjects();
  assert.ok(all.length >= 2);

  const filtered = listProjects({ search: 'Unique Search Name' });
  assertEqual(filtered.length, 1);
  assertEqual(filtered[0].id, id);
});

test('listProjects supports sort and order', () => {
  cleanTestProjects();
  seedDefaultProject();
  const idA = 'repo_sort_a_' + uid();
  const idB = 'repo_sort_b_' + uid();
  createProject({ id: idA, name: 'Project B' });
  createProject({ id: idB, name: 'Project A' });

  const sorted = listProjects({ sort: 'name', order: 'asc' });
  const names = sorted.map((p) => p.name);
  const aIndex = names.findIndex((n) => n === 'Project A');
  const bIndex = names.findIndex((n) => n === 'Project B');
  assert.ok(aIndex >= 0 && bIndex >= 0 && aIndex < bIndex);
});

test('listProjects supports limit and offset', () => {
  cleanTestProjects();
  seedDefaultProject();
  const total = 5;
  for (let i = 0; i < total; i++) {
    createProject({ id: `repo_limit_${i}_${uid()}`, name: `Limit ${i}` });
  }

  const page1 = listProjects({ limit: 2, offset: 0 });
  assert.equal(page1.length, 2);

  const page2 = listProjects({ limit: 2, offset: 2 });
  assert.equal(page2.length, 2);
  assert.ok(page1[0].id !== page2[0].id);
});

test('updateProject updates project name and timestamp', () => {
  cleanTestProjects();
  seedDefaultProject();
  const id = 'repo_update_' + uid();
  const created = createProject({ id, name: 'Original' });
  const updated = updateProject(id, { name: 'Updated Name' });

  assertEqual(updated.name, 'Updated Name');
  assert.ok(updated.updatedAt > created.updatedAt);
});

test('updateProject throws for missing project', () => {
  cleanTestProjects();
  seedDefaultProject();
  assertThrows(() => updateProject('repo_missing_' + uid(), { name: 'New Name' }));
});

test('deleteProject removes project', () => {
  cleanTestProjects();
  seedDefaultProject();
  const id = 'repo_delete_' + uid();
  createProject({ id, name: 'Delete Me' });
  assert.ok(projectExists(id));

  deleteProject(id);
  assert.ok(!projectExists(id));
  assert.strictEqual(getProject(id), null);
});

test('deleteProject throws for default project', () => {
  cleanTestProjects();
  seedDefaultProject();
  assertThrows(() => deleteProject(DEFAULT_PROJECT.id));
});

test('deleteProject throws for missing project', () => {
  cleanTestProjects();
  seedDefaultProject();
  assertThrows(() => deleteProject('repo_missing_' + uid()));
});

test('searchProjects returns matching projects', () => {
  cleanTestProjects();
  seedDefaultProject();
  const id = 'repo_query_' + uid();
  createProject({ id, name: 'Searchable Project' });

  const results = searchProjects('Searchable');
  assert.ok(results.some((p) => p.id === id));
  assert.ok(!results.some((p) => p.id === DEFAULT_PROJECT.id));
});

test('searchProjects is case-insensitive', () => {
  cleanTestProjects();
  seedDefaultProject();
  const id = 'repo_case_' + uid();
  createProject({ id, name: 'Case Sensitive' });

  const lower = searchProjects('case');
  const upper = searchProjects('CASE');
  assert.ok(lower.some((p) => p.id === id));
  assert.ok(upper.some((p) => p.id === id));
});

test('searchProjects returns all for empty query', () => {
  cleanTestProjects();
  seedDefaultProject();
  const id = 'repo_empty_' + uid();
  createProject({ id, name: 'Empty Search' });

  const results = searchProjects('');
  assert.ok(results.length >= 2);
});

console.log(`\nProjectRepository tests: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exitCode = 1;
}