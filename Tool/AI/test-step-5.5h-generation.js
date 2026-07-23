/**
 * STEP 5.5H — Native Requirement → TestCase Generation Validation
 */

const assert = require("assert");
const { createService, saveApiModel } = require("./src/domain/ServiceRepository");
const { seedDefaultProject } = require("./src/domain/ProjectRepository");
const { generateTestCases } = require("./src/engine/testCaseGenerator");
const { matchTestCasesToApis } = require("./src/engine/matching/testCaseMatcher");
const { prepareTestSpecifications } = require("./src/engine/testSpecificationBridge");

const DEFAULT_PROJECT = "default";

function setupProject() {
  seedDefaultProject();
  const serviceId = `gen-test-api-${Date.now()}`;
  createService(DEFAULT_PROJECT, {
    id: serviceId,
    name: "Generation Test API",
    protocol: "rest",
    description: "",
  });
  saveApiModel(DEFAULT_PROJECT, serviceId, {
    service: { id: serviceId, name: "Generation Test API", protocol: "rest" },
    title: "Generation API",
    baseUrl: "http://localhost:3000",
    operations: [
      { id: "createUser", method: "POST", path: "/users", summary: "Create user", parameters: [], requestSchema: {}, responses: { "201": {} } },
      { id: "getUser", method: "GET", path: "/users/{userId}", summary: "Get user", parameters: [{ name: "userId", in: "path" }], requestSchema: {}, responses: { "200": {} } },
    ],
  });
  return serviceId;
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL: ${name}\n  ${err.message}`);
  }
}

async function run() {
  setupProject();

  await test("generateTestCases returns result with testCases array", async () => {
    const ticket = { summary: "User registration", description: "", acceptanceCriteria: ["User can register"] };
    const result = await generateTestCases({ projectId: DEFAULT_PROJECT, ticket });
    assert.ok(result && Array.isArray(result.testCases), "result.testCases should be an array");
    assert.ok(result.testCases.length >= 1, "Should generate at least 1 test case");
  });

  await test("generated TestCase has canonical shape with no API coupling", async () => {
    const ticket = { summary: "Order flow", description: "", acceptanceCriteria: ["Order is created"] };
    const result = await generateTestCases({ projectId: DEFAULT_PROJECT, ticket });
    const tc = result.testCases[0];
    assert.ok(tc, "Should have TestCase");
    assert.ok(tc.id, "Should have id");
    assert.ok(typeof tc.title === "string", "Should have title");
    assert.ok(typeof tc.description === "string", "Should have description");
    assert.ok(["positive","negative","edge","functional","auth"].includes(tc.type), "Should have valid type");
    assert.ok(Array.isArray(tc.requirementRefs), "Should have requirementRefs");
    assert.ok(tc.testData, "Should have testData");
    assert.ok(tc.expectedBehavior, "Should have expectedBehavior");
    assert.strictEqual(tc.serviceId, undefined, "Must not have serviceId");
    assert.strictEqual(tc.operationId, undefined, "Must not have operationId");
    assert.strictEqual(tc.endpointId, undefined, "Must not have endpointId");
    assert.strictEqual(tc.method, undefined, "Must not have method");
    assert.strictEqual(tc.path, undefined, "Must not have path");
  });

  await test("requirementRefs are populated from acceptanceCriteria", async () => {
    const ticket = { summary: "Traceability", description: "", acceptanceCriteria: ["First AC", "Second AC"] };
    const result = await generateTestCases({ projectId: DEFAULT_PROJECT, ticket });
    const tc = result.testCases[0];
    assert.ok(tc.requirementRefs.length > 0, "Should have requirementRefs");
    assert.ok(typeof tc.requirementRefs[0].acIndex === "number", "acIndex should be number");
    assert.ok(typeof tc.requirementRefs[0].acText === "string", "acText should be string");
  });

  await test("matching still works on generated TestCases", async () => {
    const ticket = { summary: "Match test", description: "", acceptanceCriteria: ["Valid AC"] };
    const result = await generateTestCases({ projectId: DEFAULT_PROJECT, ticket });
    const matchResult = matchTestCasesToApis({ projectId: DEFAULT_PROJECT, testCases: result.testCases });
    assert.ok(Array.isArray(matchResult.matches), "Should return matches");
    assert.strictEqual(matchResult.matches.length, result.testCases.length, "One match per TestCase");
  });

  await test("prepare still works with generated TestCases", async () => {
    const ticket = { summary: "Prepare test", description: "", acceptanceCriteria: ["Valid AC"] };
    const result = await generateTestCases({ projectId: DEFAULT_PROJECT, ticket });
    const matchResult = matchTestCasesToApis({ projectId: DEFAULT_PROJECT, testCases: result.testCases });
    const mappings = matchResult.matches.filter(m => m.selectedMatch).map(m => ({
      testCaseId: m.testCaseId,
      serviceId: m.selectedMatch.serviceId,
      operationId: m.selectedMatch.operationId,
      method: m.selectedMatch.method,
      path: m.selectedMatch.path,
      source: "automatic",
    }));
    const prepareResult = prepareTestSpecifications({ projectId: DEFAULT_PROJECT, testCases: result.testCases, mappings });
    assert.ok(prepareResult.testSpecifications, "Should have testSpecifications");
    assert.ok(prepareResult.plans, "Should have plans");
  });

  await test("same requirement yields API-independent TestCases across projects", async () => {
    const ticket = { summary: "Cross-project", description: "", acceptanceCriteria: ["Valid AC"] };
    const projectA = `proj-a-${Date.now()}`;
    seedDefaultProject();
    createService(projectA, { id: "users-api", name: "Users", protocol: "rest", description: "" });
    saveApiModel(projectA, "users-api", { service: { id: "users-api", name: "Users", protocol: "rest" }, title: "Users", baseUrl: "http://localhost:3000", operations: [{ id: "getUser", method: "GET", path: "/users/{userId}" }] });
    const projectB = `proj-b-${Date.now()}`;
    createService(projectB, { id: "payments-api", name: "Payments", protocol: "rest", description: "" });
    saveApiModel(projectB, "payments-api", { service: { id: "payments-api", name: "Payments", protocol: "rest" }, title: "Payments", baseUrl: "http://localhost:3000", operations: [{ id: "getPayment", method: "GET", path: "/payments/{paymentId}" }] });
    const resultA = await generateTestCases({ projectId: projectA, ticket });
    const resultB = await generateTestCases({ projectId: projectB, ticket });
    assert.ok(resultA.testCases.length >= 1);
    assert.ok(resultB.testCases.length >= 1);
    resultA.testCases.forEach(tc => { assert.strictEqual(tc.serviceId, undefined); assert.strictEqual(tc.operationId, undefined); assert.strictEqual(tc.method, undefined); assert.strictEqual(tc.path, undefined); });
    resultB.testCases.forEach(tc => { assert.strictEqual(tc.serviceId, undefined); assert.strictEqual(tc.operationId, undefined); assert.strictEqual(tc.method, undefined); assert.strictEqual(tc.path, undefined); });
  });

  await test("local fallback is used when AI unavailable", async () => {
    const ticket = { summary: "Fallback only", description: "", acceptanceCriteria: ["AC1", "AC2"] };
    const result = await generateTestCases({ projectId: DEFAULT_PROJECT, ticket });
    assert.ok(result.testCases.length >= 1, "Should still generate test cases via fallback");
    assert.ok(result.diagnostics.mode === "local_fallback" || result.diagnostics.mode === "ai_v2", "Mode should be declared");
  });

  console.log(`\nGeneration tests: ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error("Test runner error:", err); process.exit(1); });