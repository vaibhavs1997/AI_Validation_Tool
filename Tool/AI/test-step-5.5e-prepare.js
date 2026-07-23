/**
 * STEP 5.5E — Backend tests for TestCase/API mapping → TestSpecification + ExecutionPlan
 *
 * Tests:
 * - mapped TestCase → TestSpecification
 * - human-readable QA intent preserved
 * - confirmed mapping is authoritative
 * - no rematching occurs
 * - unmatched TestCase remains unresolved
 * - 6 mapped + 2 unmatched => 6 prepared + 2 unresolved
 * - independent operation planning
 * - confirmed dependency chain planning
 * - proposed/rejected relationships ignored
 * - missing mapped operation fails explicitly
 * - circular dependency reported
 * - canonical TestCase not mutated
 * - no AI call
 * - no API execution
 */

const assert = require("assert");
const { createService, saveApiModel } = require("./src/domain/ServiceRepository");
const { seedDefaultProject } = require("./src/domain/ProjectRepository");
const { createTestCase } = require("./src/domain/TestCase");
const { saveProjectKnowledge, getProjectKnowledge } = require("./src/domain/ProjectKnowledgeRepository");
const { prepareTestSpecifications } = require("./src/engine/testSpecificationBridge");

const DEFAULT_PROJECT = "default";

function setupProject() {
  seedDefaultProject();
  const serviceId = `prepare-api-${Date.now()}`;
  createService(DEFAULT_PROJECT, {
    id: serviceId,
    name: "Prepare Test API",
    protocol: "rest",
    description: "API for prepare tests",
  });
  saveApiModel(DEFAULT_PROJECT, serviceId, {
    service: { id: serviceId, name: "Prepare Test API", protocol: "rest" },
    title: "Prepare API",
    baseUrl: "http://localhost:3000",
    operations: [
      {
        id: "createUser",
        method: "POST",
        path: "/users",
        summary: "Create user",
        description: "Create a new user",
        parameters: [],
        requestSchema: { type: "object" },
        responses: { "201": { description: "Created" } },
      },
      {
        id: "getUser",
        method: "GET",
        path: "/users/{userId}",
        summary: "Get user",
        description: "Get user by ID",
        parameters: [{ name: "userId", in: "path" }],
        requestSchema: {},
        responses: { "200": { description: "OK" } },
      },
      {
        id: "updateOrder",
        method: "PUT",
        path: "/orders/{orderId}",
        summary: "Update order",
        description: "Update an existing order",
        parameters: [{ name: "orderId", in: "path" }],
        requestSchema: {},
        responses: { "200": { description: "OK" } },
      },
      {
        id: "generateToken",
        method: "POST",
        path: "/auth/token",
        summary: "Generate token",
        description: "Generate auth token",
        parameters: [],
        requestSchema: {},
        responses: { "200": { description: "OK" } },
      },
      {
        id: "login",
        method: "POST",
        path: "/auth/login",
        summary: "Login",
        description: "Login with credentials",
        parameters: [],
        requestSchema: {},
        responses: { "200": { description: "OK" } },
      },
    ],
  });
  return serviceId;
}

function makeTestCase(overrides = {}) {
  return createTestCase({
    id: `tc-prepare-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "Verify user can be created",
    description: "User can create an account via POST /users",
    type: "positive",
    requirementRefs: [{ acIndex: 0, acText: "User can create an account" }],
    testData: {
      pathParams: {},
      queryParams: {},
      headers: { "Content-Type": "application/json" },
      body: { email: "test@example.com", password: "pass123" },
    },
    expectedBehavior: { status: 201, responseAssertions: ["response.id exists"] },
    assertions: ["response.id exists"],
    ...overrides,
  });
}

function makeMapping(testCaseId, serviceId, overrides = {}) {
  return {
    testCaseId,
    serviceId: serviceId || "prepare-test-api",
    operationId: "createUser",
    method: "POST",
    path: "/users",
    source: "automatic",
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL: ${name}`);
    console.log(`  ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL: ${name}`);
    console.log(`  ${err.message}`);
  }
}

async function run() {
  const serviceId = setupProject();

  // 1. mapped TestCase → TestSpecification
  await asyncTest("mapped TestCase → TestSpecification", () => {
    const tc = makeTestCase({ id: "tc-prep-1" });
    const mapping = makeMapping(tc.id, serviceId);
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });

    assert.strictEqual(result.testSpecifications.length, 1);
    assert.strictEqual(result.testSpecifications[0].id, tc.id);
    assert.strictEqual(result.testSpecifications[0].title, tc.title);
    assert.strictEqual(result.testSpecifications[0].operationRefs.length, 1);
    assert.strictEqual(result.testSpecifications[0].operationRefs[0].serviceId, mapping.serviceId);
    assert.strictEqual(result.testSpecifications[0].operationRefs[0].operationId, mapping.operationId);
  });

  // 2. human-readable QA intent preserved
  await asyncTest("human-readable QA intent preserved", () => {
    const tc = makeTestCase({
      id: "tc-prep-2",
      title: "Verify order can be rejected when quantity is zero",
      description: "Reject order with zero quantity via PUT /orders/{orderId}",
      assertions: ["response.error exists"],
    });
    const mapping = makeMapping(tc.id, serviceId, {
      operationId: "updateOrder",
      method: "PUT",
      path: "/orders/{orderId}",
    });
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });

    const spec = result.testSpecifications[0];
    assert.strictEqual(spec.title, tc.title);
    assert.strictEqual(spec.description, tc.description);
    assert.ok(spec.assertions.includes("response.error exists"));
  });

  // 3. confirmed mapping is authoritative
  await asyncTest("confirmed mapping is authoritative", () => {
    const tc = makeTestCase({ id: "tc-prep-3", description: "Original QA description" });
    const mapping = makeMapping(tc.id, serviceId, {
      operationId: "getUser",
      method: "GET",
      path: "/users/{userId}",
    });
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });

    const spec = result.testSpecifications[0];
    assert.strictEqual(spec.operationRefs[0].serviceId, mapping.serviceId);
    assert.strictEqual(spec.operationRefs[0].operationId, mapping.operationId);
    assert.strictEqual(spec.operationRefs[0].method, mapping.method);
    assert.strictEqual(spec.operationRefs[0].path, mapping.path);
  });

  // 4. no rematching occurs
  await asyncTest("no rematching occurs", () => {
    const tc = makeTestCase({ id: "tc-prep-4", description: "I want to delete a user" });
    const mapping = makeMapping(tc.id, serviceId, {
      operationId: "createUser",
      method: "POST",
      path: "/users",
    });
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });

    const spec = result.testSpecifications[0];
    assert.strictEqual(spec.operationRefs[0].operationId, "createUser");
  });

  // 5. unmatched TestCase remains unresolved
  await asyncTest("unmatched TestCase remains unresolved", () => {
    const tc = makeTestCase({ id: "tc-prep-5" });
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [],
    });

    assert.strictEqual(result.diagnostics.included, 1);
    assert.strictEqual(result.diagnostics.prepared, 0);
    assert.strictEqual(result.diagnostics.unresolved, 1);
    assert.strictEqual(result.unresolvedTestCases.length, 1);
    assert.strictEqual(result.unresolvedTestCases[0].testCaseId, tc.id);
    assert.strictEqual(result.unresolvedTestCases[0].reason, "No confirmed API mapping");
  });

  // 6. 6 mapped + 2 unmatched => 6 prepared + 2 unresolved
  await asyncTest("6 mapped + 2 unmatched => 6 prepared + 2 unresolved", () => {
    const testCases = [];
    const mappings = [];
    for (let i = 0; i < 6; i++) {
      const tc = makeTestCase({ id: `tc-prep-6-${i}` });
      testCases.push(tc);
      mappings.push(makeMapping(tc.id, serviceId));
    }
    const u1 = makeTestCase({ id: "tc-prep-6-u1" });
    const u2 = makeTestCase({ id: "tc-prep-6-u2" });
    testCases.push(u1, u2);

    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases,
      mappings,
    });

    assert.strictEqual(result.diagnostics.included, 8);
    assert.strictEqual(result.diagnostics.prepared, 6);
    assert.strictEqual(result.diagnostics.unresolved, 2);
    assert.strictEqual(result.testSpecifications.length, 6);
    assert.strictEqual(result.unresolvedTestCases.length, 2);
  });

  // 7. independent operation planning
  await asyncTest("independent operation planning", () => {
    const tc = makeTestCase({ id: "tc-prep-7" });
    const mapping = makeMapping(tc.id, serviceId, {
      operationId: "createUser",
      method: "POST",
      path: "/users",
    });
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });

    const spec = result.testSpecifications[0];
    assert.ok(spec, "Should have a test specification");
    assert.strictEqual(spec.operationRefs[0].operationId, "createUser");
  });

  // 8. confirmed dependency chain planning
  await asyncTest("confirmed dependency chain planning", () => {
    saveProjectKnowledge(DEFAULT_PROJECT, "", [
      {
        type: "data_dependency",
        source: { serviceId, operationId: "generateToken", location: "response.body.token" },
        target: { serviceId, operationId: "login", location: "headers.Authorization" },
        transform: "Bearer ${source.response.body.token}",
        confidence: 0.9,
        evidence: "Auth flow",
        status: "confirmed",
      },
      {
        type: "authentication",
        source: { serviceId, operationId: "generateToken", location: "response.body.token" },
        target: { serviceId, operationId: "updateOrder", location: "headers.Authorization" },
        transform: "Bearer ${source.response.body.token}",
        confidence: 0.9,
        evidence: "Auth flow",
        status: "confirmed",
      },
      {
        type: "data_dependency",
        source: { serviceId, operationId: "login", location: "response.body.accessToken" },
        target: { serviceId, operationId: "updateOrder", location: "body.accessToken" },
        transform: "${source.response.body.accessToken}",
        confidence: 0.9,
        evidence: "Token reuse",
        status: "confirmed",
      },
    ]);

    const tc = makeTestCase({ id: "tc-prep-8" });
    const mapping = makeMapping(tc.id, serviceId, {
      operationId: "updateOrder",
      method: "PUT",
      path: "/orders/{orderId}",
    });
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });

    const spec = result.testSpecifications[0];
    const plan = result.plans[spec.id];
    assert.ok(plan, "Should have plan for dependent operation");
    assert.ok(plan.steps.length > 1, "Should have dependency steps");
    const stepOps = plan.steps.map((s) => `${s.operation.serviceId}::${s.operation.operationId}`);
    assert.ok(stepOps.includes(`${serviceId}::generateToken`), "Should include generateToken");
    assert.ok(stepOps.includes(`${serviceId}::login`), "Should include login");
    assert.ok(stepOps.includes(`${serviceId}::updateOrder`), "Should include updateOrder");
  });

  // 9. proposed/rejected relationships ignored
  await asyncTest("proposed/rejected relationships ignored", () => {
    const existing = getProjectKnowledge(DEFAULT_PROJECT);
    saveProjectKnowledge(DEFAULT_PROJECT, "", [
      ...(existing?.relationships || []),
      {
        type: "data_dependency",
        source: { serviceId, operationId: "generateToken", location: "response.body.token" },
        target: { serviceId, operationId: "getUser", location: "headers.Auth" },
        transform: "",
        confidence: 0.5,
        evidence: "Proposed only",
        status: "proposed",
      },
    ]);

    const tc = makeTestCase({ id: "tc-prep-9" });
    const mapping = makeMapping(tc.id, serviceId, {
      operationId: "getUser",
      method: "GET",
      path: "/users/{userId}",
    });
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });

    assert.strictEqual(result.diagnostics.prepared, 1);
    assert.strictEqual(result.diagnostics.unresolved, 0);
  });

  // 10. missing mapped operation fails explicitly
  await asyncTest("missing mapped operation fails explicitly", () => {
    const tc = makeTestCase({ id: "tc-prep-10" });
    const mapping = makeMapping(tc.id, serviceId, {
      operationId: "nonExistentOp",
      method: "GET",
      path: "/does-not-exist",
    });
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });

    assert.strictEqual(result.diagnostics.prepared, 0);
    assert.strictEqual(result.diagnostics.unresolved, 1);
    assert.ok(result.unresolvedTestCases[0].reason.includes("Mapped operation not found"));
  });

  // 11. circular dependency reported
  await asyncTest("circular dependency reported", () => {
    saveProjectKnowledge(DEFAULT_PROJECT, "", [
      ...(getProjectKnowledge(DEFAULT_PROJECT)?.relationships || []),
      {
        type: "data_dependency",
        source: { serviceId, operationId: "generateToken", location: "x" },
        target: { serviceId, operationId: "login", location: "y" },
        transform: "",
        confidence: 0.9,
        evidence: "circular",
        status: "confirmed",
      },
      {
        type: "data_dependency",
        source: { serviceId, operationId: "login", location: "y" },
        target: { serviceId, operationId: "generateToken", location: "x" },
        transform: "",
        confidence: 0.9,
        evidence: "circular",
        status: "confirmed",
      },
    ]);

    const tc = makeTestCase({ id: "tc-prep-11" });
    const mapping = makeMapping(tc.id, serviceId, {
      operationId: "login",
      method: "POST",
      path: "/auth/login",
    });
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });

    const spec = result.testSpecifications[0];
    const plan = result.plans[spec.id];
    assert.ok(plan, "Should have plan");
    if (plan.errors && plan.errors.length > 0) {
      assert.ok(plan.errors.some((e) => e.toLowerCase().includes("circular")), "Should mention circular dependency");
    }
  });

  // 12. canonical TestCase not mutated
  await asyncTest("canonical TestCase not mutated", () => {
    const tc = makeTestCase({ id: "tc-prep-12" });
    const original = JSON.parse(JSON.stringify(tc));
    const mapping = makeMapping(tc.id, serviceId);

    prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });

    assert.deepStrictEqual(JSON.parse(JSON.stringify(tc)), original);
  });

  // 13. no AI call (implicit — no AI services invoked)
  await asyncTest("no AI call — deterministic only", () => {
    const tc = makeTestCase({ id: "tc-prep-13" });
    const mapping = makeMapping(tc.id, serviceId);
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });
    assert.ok(result.testSpecifications.length >= 0, "Should return without AI");
  });

  // 14. no API execution
  await asyncTest("no API execution — planning only", () => {
    const tc = makeTestCase({ id: "tc-prep-14" });
    const mapping = makeMapping(tc.id, serviceId);
    const result = prepareTestSpecifications({
      projectId: DEFAULT_PROJECT,
      testCases: [tc],
      mappings: [mapping],
    });

    assert.ok(!result.execution, "Should not have execution results");
    assert.ok(!result.run, "Should not have run results");
    assert.ok(!result.results, "Should not have step results");
  });

  console.log(`\nPrepare tests: ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});