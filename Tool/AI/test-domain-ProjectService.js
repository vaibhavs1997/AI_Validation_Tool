/**
 * Focused tests for Sprint 01 ProjectService.
 * Run: node test-domain-ProjectService.js
 */

const assert = require('node:assert');
const { ProjectService } = require('./src/domain/ProjectService');

let passed = 0;
let failed = 0;

const testPromises = [];

async function test(name, fn) {
  testPromises.push(
    Promise.resolve()
      .then(() => {
        try {
          fn();
          passed++;
        } catch (error) {
          failed++;
          console.error(`FAIL: ${name}`);
          console.error(error && error.message ? error.message : error);
        }
      })
      .catch((error) => {
        failed++;
        console.error(`FAIL: ${name}`);
        console.error(error && error.message ? error.message : error);
      })
  );
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

async function assertThrowsWithMessage(fn, expectedMessage) {
  let actualMessage = null;
  try {
    await fn();
  } catch (error) {
    actualMessage = error && error.message ? error.message : String(error);
  }
  assert.ok(actualMessage, 'Expected function to throw.');
  assert.ok(actualMessage.includes(expectedMessage), `Expected message to include "${expectedMessage}", got: "${actualMessage}"`);
}

// Mock repository
function createMockRepository() {
  const projects = new Map();
  const repository = {
    async createProject(input) {
      const id = input.id;
      if (projects.has(id)) {
        throw new Error(`Project already exists: ${id}`);
      }
      const project = {
        id,
        name: input.name || id,
        createdAt: input.createdAt || new Date().toISOString(),
        updatedAt: input.updatedAt || new Date().toISOString(),
      };
      projects.set(id, project);
      return project;
    },
    async getProject(id) {
      return projects.get(id) || null;
    },
    async listProjects(options) {
      let result = Array.from(projects.values());
      const search = (options && options.search) || '';
      if (search) {
        const query = search.toLowerCase();
        result = result.filter((p) => String(p.id).toLowerCase().includes(query) || String(p.name).toLowerCase().includes(query));
      }
      return result;
    },
    async searchProjects(query) {
      const all = await this.listProjects();
      const lowerQuery = String(query || '').toLowerCase();
      if (!lowerQuery) return all;
      return all.filter((p) => String(p.id).toLowerCase().includes(lowerQuery) || String(p.name).toLowerCase().includes(lowerQuery));
    },
    async updateProject(id, updates) {
      const project = projects.get(id);
      if (!project) {
        throw new Error(`Project not found: ${id}`);
      }
      project.name = updates.name;
      project.updatedAt = new Date().toISOString();
      return project;
    },
    async deleteProject(id) {
      if (!projects.has(id)) {
        throw new Error(`Project not found: ${id}`);
      }
      projects.delete(id);
    },
    async projectExists(id) {
      return projects.has(id);
    },
  };
  return repository;
}

// Tests

test('createProject creates a new project with valid input', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  const project = await service.createProject({ id: 'test_create', name: 'Test Create' });

  assertEqual(project.id, 'test_create');
  assertEqual(project.name, 'Test Create');
});

test('createProject defaults name to id when name is not provided', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  const project = await service.createProject({ id: 'test_default_name' });

  assertEqual(project.name, 'test_default_name');
});

test('createProject throws for missing id', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await assertThrowsWithMessage(() => service.createProject({}), 'Project id is required.');
});

test('createProject throws for empty id', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await assertThrowsWithMessage(() => service.createProject({ id: '' }), 'Project id is required.');
});

test('createProject throws for invalid id format', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await assertThrowsWithMessage(() => service.createProject({ id: 'invalid id!' }), 'Project id must contain only alphanumeric characters');
});

test('createProject throws for duplicate id', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await service.createProject({ id: 'dup', name: 'First' });
  await assertThrowsWithMessage(() => service.createProject({ id: 'dup', name: 'Second' }), 'Project already exists: dup');
});

test('getProject returns project by id', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await repository.createProject({ id: 'get_test', name: 'Get Me' });
  const project = await service.getProject('get_test');

  assertEqual(project.id, 'get_test');
  assertEqual(project.name, 'Get Me');
});

test('getProject throws for missing project', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await assertThrowsWithMessage(() => service.getProject('nonexistent'), 'Project not found: nonexistent');
});

test('listProjects returns all projects', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await repository.createProject({ id: 'list1', name: 'List One' });
  await repository.createProject({ id: 'list2', name: 'List Two' });

  const projects = await service.listProjects();

  assert.ok(projects.some((p) => p.id === 'list1'));
  assert.ok(projects.some((p) => p.id === 'list2'));
});

test('listProjects supports search', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await repository.createProject({ id: 'search1', name: 'Unique Search Name' });

  const results = await service.listProjects({ search: 'Unique Search Name' });

  assertEqual(results.length, 1);
  assertEqual(results[0].id, 'search1');
});

test('searchProjects returns matching projects', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await repository.createProject({ id: 'search_test', name: 'Searchable Project' });

  const results = await service.searchProjects('Searchable');

  assert.ok(results.some((p) => p.id === 'search_test'));
});

test('updateProject updates project name', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await repository.createProject({ id: 'update_test', name: 'Original' });
  const updated = await service.updateProject('update_test', { name: 'Updated' });

  assertEqual(updated.name, 'Updated');
});

test('updateProject throws for missing project', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await assertThrowsWithMessage(() => service.updateProject('nonexistent', { name: 'New' }), 'Project not found: nonexistent');
});

test('updateProject throws for missing name', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await repository.createProject({ id: 'update_no_name', name: 'Original' });
  await assertThrowsWithMessage(() => service.updateProject('update_no_name', {}), 'Project name is required for update.');
});

test('deleteProject removes project', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await repository.createProject({ id: 'delete_test', name: 'Delete Me' });
  await service.deleteProject('delete_test');
  const project = await repository.getProject('delete_test');

  assert.strictEqual(project, null);
});

test('deleteProject throws for default project', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await assertThrowsWithMessage(() => service.deleteProject('default'), 'Cannot delete the default project');
});

test('deleteProject throws for missing project', async () => {
  const repository = createMockRepository();
  const service = new ProjectService(repository);

  await assertThrowsWithMessage(() => service.deleteProject('nonexistent'), 'Project not found: nonexistent');
});

Promise.all(testPromises).then(() => {
  console.log(`\nProjectService tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
});
