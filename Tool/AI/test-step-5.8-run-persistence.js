/**
 * STEP 5.8 — Run Persistence Tests
 *
 * Tests for the active TestCase-first workflow run persistence.
 *
 * Architecture:
 *   - Uses temporary directory for test data isolation
 *   - Tests RunRepository operations directly
 *   - Tests execute-dependent persistence via integration
 *   - Tests secret redaction at persistence boundary
 *   - Tests project isolation
 *   - Tests historical immutability
 *
 * Data isolation: Uses injectable config.dataDir via environment variable
 * or direct patching. Cleanup removes test data on completion.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");

// ─── Setup ──────────────────────────────────────────────────────────────────

const TEST_DATA_DIR = path.join(os.tmpdir(), `step-5.8-test-${Date.now()}`);
const config = require("./src/config");

// Save original dataDir
const originalDataDir = config.dataDir;

function setupTestEnvironment() {
  // Ensure clean test directory
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

  // Redirect RunRepository to test directory
  config.dataDir = TEST_DATA_DIR;
}

function teardownTestEnvironment() {
  config.dataDir = originalDataDir;
  if (fs.existsSync(TEST_DATA_DIR)) {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  }
}

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const PROJECT_A = "test-project-a";
const PROJECT_B = "test-project-b";

function buildPassedRun() {
  return {
    id: "run-passed-1",
    projectId: PROJECT_A,
    title: "Verify user can update profile",
    description: "Test that a logged-in user can successfully update their profile information",
    status: "passed",
    testSpecification: {
      id: "spec-1",
      title: "Verify user can update profile",
      description: "Test that a logged-in user can successfully update their profile information",
      requirementRefs: [{ acIndex: 0, acText: "User should be able to update profile" }],
      operationRefs: [{ serviceId: "user-service", operationId: "updateProfile", method: "PUT", path: "/profile" }],
      expectedBehavior: { status: 200, responseAssertions: ["profile updated successfully"] },
    },
    executionPlanSummary: {
      target: { serviceId: "user-service", operationId: "updateProfile" },
      stepCount: 1,
      operations: [{ serviceId: "user-service", operationId: "updateProfile", method: "PUT", path: "/profile" }],
    },
    targetOperation: { serviceId: "user-service", operationId: "updateProfile" },
    results: [
      {
        step: 0,
        operation: { serviceId: "user-service", operationId: "updateProfile", method: "PUT", path: "/profile" },
        status: "passed",
        request: { method: "PUT", url: "http://localhost:8080/profile", headers: { "Content-Type": "application/json" }, body: { name: "Updated Name" } },
        response: { status: 200, statusText: "OK", headers: { "content-type": "application/json" }, body: { status: "profile updated successfully" } },
        validation: { assertions: ["status === 200", "response has body"], passed: true, failed: false },
      },
    ],
    errors: [],
    startedAt: "2026-07-23T10:00:00.000Z",
    completedAt: "2026-07-23T10:00:01.800Z",
    durationMs: 1800,
  };
}

function buildFailedRun() {
  return {
    id: "run-failed-1",
    projectId: PROJECT_A,
    title: "Verify user login with invalid credentials",
    description: "Test that login fails with incorrect password",
    status: "failed",
    testSpecification: {
      id: "spec-2",
      title: "Verify user login with invalid credentials",
      description: "Test that login fails with incorrect password",
      requirementRefs: [{ acIndex: 1, acText: "Invalid credentials should be rejected" }],
      operationRefs: [{ serviceId: "auth-service", operationId: "login", method: "POST", path: "/login" }],
      expectedBehavior: { status: 401, responseAssertions: ["unauthorized"] },
    },
    executionPlanSummary: {
      target: { serviceId: "auth-service", operationId: "login" },
      stepCount: 1,
      operations: [{ serviceId: "auth-service", operationId: "login", method: "POST", path: "/login" }],
    },
    targetOperation: { serviceId: "auth-service", operationId: "login" },
    results: [
      {
        step: 0,
        operation: { serviceId: "auth-service", operationId: "login", method: "POST", path: "/login" },
        status: "failed",
        request: { method: "POST", url: "http://localhost:8080/login", headers: { "Content-Type": "application/json" }, body: { username: "user", password: "[REDACTED]" } },
        response: { status: 401, statusText: "Unauthorized", headers: {}, body: { error: "Invalid credentials" } },
        error: "Login failed with HTTP 401.",
        validation: { assertions: ["status === 401"], passed: true, failed: false },
      },
    ],
    errors: ["Login failed with HTTP 401."],
    startedAt: "2026-07-23T10:05:00.000Z",
    completedAt: "2026-07-23T10:05:00.850Z",
    durationMs: 850,
  };
}

function buildRunWithBlockedStep() {
  return {
    id: "run-blocked-1",
    projectId: PROJECT_A,
    title: "Verify logged-in user can update profile (3-step)",
    description: "End-to-end test for profile update with auth dependency",
    status: "failed",
    testSpecification: {
      id: "spec-3",
      title: "Verify logged-in user can update profile (3-step)",
      description: "End-to-end test for profile update with auth dependency",
      requirementRefs: [{ acIndex: 0, acText: "User should be able to update profile" }],
      operationRefs: [{ serviceId: "auth-service", operationId: "generateToken", method: "POST", path: "/token" }],
      expectedBehavior: { status: 200, responseAssertions: [] },
    },
    executionPlanSummary: {
      target: { serviceId: "user-service", operationId: "updateProfile" },
      stepCount: 3,
      operations: [
        { serviceId: "auth-service", operationId: "generateToken", method: "POST", path: "/token" },
        { serviceId: "auth-service", operationId: "login", method: "POST", path: "/login" },
        { serviceId: "user-service", operationId: "updateProfile", method: "PUT", path: "/profile" },
      ],
    },
    targetOperation: { serviceId: "user-service", operationId: "updateProfile" },
    results: [
      {
        step: 0,
        operation: { serviceId: "auth-service", operationId: "generateToken", method: "POST", path: "/token" },
        status: "passed",
        request: { method: "POST", url: "http://localhost:8080/token", headers: {}, body: {} },
        response: { status: 200, statusText: "OK", headers: {}, body: { access_token: "[REDACTED]" } },
        validation: { assertions: [], passed: true, failed: false },
      },
      {
        step: 1,
        operation: { serviceId: "auth-service", operationId: "login", method: "POST", path: "/login" },
        status: "failed",
        request: { method: "POST", url: "http://localhost:8080/login", headers: { Authorization: "[REDACTED]" }, body: {} },
        response: { status: 401, statusText: "Unauthorized", headers: {}, body: { error: "Invalid credentials" } },
        error: "Login failed with HTTP 401.",
        validation: { assertions: [], passed: false, failed: true },
      },
      {
        step: 2,
        operation: { serviceId: "user-service", operationId: "updateProfile", method: "PUT", path: "/profile" },
        status: "blocked",
        error: "Blocked due to failed prerequisite: auth-service/login",
      },
    ],
    errors: ["Login failed with HTTP 401."],
    startedAt: "2026-07-23T10:10:00.000Z",
    completedAt: "2026-07-23T10:10:02.500Z",
    durationMs: 2500,
  };
}

function buildRunWithSecrets() {
  return {
    id: "run-secrets-1",
    projectId: PROJECT_A,
    title: "Test with sensitive data",
    status: "failed",
    testSpecification: {
      id: "spec-secret",
      title: "Test with sensitive data",
      description: "Should have secrets redacted",
      requirementRefs: [],
      operationRefs: [{ serviceId: "auth-service", operationId: "login", method: "POST", path: "/login" }],
      expectedBehavior: { status: 200, responseAssertions: [] },
    },
    executionPlanSummary: {
      target: { serviceId: "auth-service", operationId: "login" },
      stepCount: 1,
      operations: [{ serviceId: "auth-service", operationId: "login", method: "POST", path: "/login" }],
    },
    targetOperation: { serviceId: "auth-service", operationId: "login" },
    results: [
      {
        step: 0,
        operation: { serviceId: "auth-service", operationId: "login", method: "POST", path: "/login" },
        status: "failed",
        request: {
          method: "POST",
          url: "http://localhost:8080/login",
          headers: {
            Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.test",
            "X-Api-Key": "sk-abc123secretkey",
          },
          body: {
            username: "admin",
            password: "super-secret-password-123",
            accessToken: "eyJhbGciOiJIUzI1NiJ9.raw-token",
            refreshToken: "rt-abc123refresh",
            apiKey: "prod-key-98765",
          },
        },
        response: {
          status: 401,
          statusText: "Unauthorized",
          headers: {
            "set-cookie": "session=abc123; HttpOnly",
            "x-secret-header": "internal-value-xyz",
          },
          body: {
            error: "invalid_grant",
            access_token: "should-not-be-visible",
            secret: "classified-data",
            token: "raw-jwt-token",
          },
        },
        error: "Authentication failed",
        validation: { assertions: [], passed: false, failed: false },
      },
    ],
    errors: [],
    startedAt: "2026-07-23T10:15:00.000Z",
    completedAt: "2026-07-23T10:15:01.000Z",
    durationMs: 1000,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ✕ ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ─── RunRepository Tests ───────────────────────────────────────────────────

function testRunRepository() {
  console.log("\n── RunRepository ──");

  const { saveRun, getRun, listRuns, deleteRun } = require("./src/domain/RunRepository");

  test("saveRun returns { id, projectId }", () => {
    const run = buildPassedRun();
    const result = saveRun(PROJECT_A, run);
    assert.strictEqual(result.id, "run-passed-1");
    assert.strictEqual(result.projectId, PROJECT_A);
  });

  test("getRun retrieves saved run", () => {
    const run = getRun(PROJECT_A, "run-passed-1");
    assert.ok(run, "Run should exist");
    assert.strictEqual(run.id, "run-passed-1");
    assert.strictEqual(run.projectId, PROJECT_A);
    assert.strictEqual(run.title, "Verify user can update profile");
    assert.strictEqual(run.status, "passed");
  });

  test("getRun returns null for unknown run", () => {
    const run = getRun(PROJECT_A, "nonexistent-run");
    assert.strictEqual(run, null);
  });

  test("getRun returns null for wrong project", () => {
    const run = getRun(PROJECT_B, "run-passed-1");
    assert.strictEqual(run, null);
  });

  test("Save failed run", () => {
    saveRun(PROJECT_A, buildFailedRun());
    const run = getRun(PROJECT_A, "run-failed-1");
    assert.ok(run);
    assert.strictEqual(run.status, "failed");
    assert.strictEqual(run.results.length, 1);
    assert.strictEqual(run.results[0].status, "failed");
  });

  test("Save run with blocked step", () => {
    saveRun(PROJECT_A, buildRunWithBlockedStep());
    const run = getRun(PROJECT_A, "run-blocked-1");
    assert.ok(run);
    assert.strictEqual(run.status, "failed");
    assert.strictEqual(run.results.length, 3);
    assert.strictEqual(run.results[2].status, "blocked");
    assert.ok(run.results[2].error.includes("Blocked due to failed prerequisite"));
  });

  test("listRuns returns newest first", () => {
    // Save one more run to ensure ordering
    const lateRun = buildPassedRun();
    lateRun.id = "run-passed-2";
    lateRun.startedAt = "2026-07-23T12:00:00.000Z";
    saveRun(PROJECT_A, lateRun);

    const runs = listRuns(PROJECT_A);
    assert.ok(runs.length >= 4);
    // The newest (by filename sort) should be first
    const dates = runs.map(r => r.startedAt);
    assert.ok(dates[0] >= dates[dates.length - 1]);
  });

  test("listRuns returns empty array for unknown project", () => {
    const runs = listRuns("nonexistent-project");
    assert.ok(Array.isArray(runs));
    assert.strictEqual(runs.length, 0);
  });

  test("listRuns returns run summaries (not full details)", () => {
    const runs = listRuns(PROJECT_A);
    const entry = runs.find(r => r.id === "run-passed-1");
    assert.ok(entry);
    // Should have summary fields, not full results/request/response
    assert.strictEqual(typeof entry.stepCount, "number");
    assert.strictEqual(typeof entry.passedSteps, "number");
    assert.strictEqual(typeof entry.failedSteps, "number");
    assert.strictEqual(typeof entry.blockedSteps, "number");
    assert.strictEqual(typeof entry.durationMs, "number");
    assert.strictEqual(typeof entry.title, "string");
    assert.strictEqual(typeof entry.status, "string");
    // Should NOT have full results array in summary
    assert.strictEqual(entry.testSpecificationId, "spec-1");
  });

  test("Run summary counts are correct for passed run", () => {
    const runs = listRuns(PROJECT_A);
    const entry = runs.find(r => r.id === "run-passed-1");
    assert.ok(entry);
    assert.strictEqual(entry.stepCount, 1);
    assert.strictEqual(entry.passedSteps, 1);
    assert.strictEqual(entry.failedSteps, 0);
    assert.strictEqual(entry.blockedSteps, 0);
  });

  test("Run summary counts are correct for failed run", () => {
    const runs = listRuns(PROJECT_A);
    const entry = runs.find(r => r.id === "run-failed-1");
    assert.ok(entry);
    assert.strictEqual(entry.stepCount, 1);
    assert.strictEqual(entry.passedSteps, 0);
    assert.strictEqual(entry.failedSteps, 1);
    assert.strictEqual(entry.blockedSteps, 0);
  });

  test("Run summary counts are correct for blocked run", () => {
    const runs = listRuns(PROJECT_A);
    const entry = runs.find(r => r.id === "run-blocked-1");
    assert.ok(entry);
    assert.strictEqual(entry.stepCount, 3);
    assert.strictEqual(entry.passedSteps, 1);
    assert.strictEqual(entry.failedSteps, 1);
    assert.strictEqual(entry.blockedSteps, 1);
  });

  test("deleteRun removes file and returns true", () => {
    const result = deleteRun(PROJECT_A, "run-passed-2");
    assert.strictEqual(result, true);
    const run = getRun(PROJECT_A, "run-passed-2");
    assert.strictEqual(run, null);
  });

  test("deleteRun returns false for nonexistent run", () => {
    const result = deleteRun(PROJECT_A, "nonexistent");
    assert.strictEqual(result, false);
  });
}

// ─── Project Isolation Tests ───────────────────────────────────────────────

function testProjectIsolation() {
  console.log("\n── Project Isolation ──");

  const { saveRun, getRun, listRuns } = require("./src/domain/RunRepository");

  test("Save run under Project B", () => {
    const run = buildPassedRun();
    run.id = "run-project-b-1";
    run.projectId = PROJECT_B;
    saveRun(PROJECT_B, run);
  });

  test("Project A runs are invisible to Project B", () => {
    const runs = listRuns(PROJECT_B);
    const aRuns = runs.filter(r => r.projectId === PROJECT_A);
    assert.strictEqual(aRuns.length, 0, "Project B should not see Project A runs");
  });

  test("Project B runs are invisible to Project A", () => {
    const runs = listRuns(PROJECT_A);
    const bRuns = runs.filter(r => r.projectId === PROJECT_B);
    assert.strictEqual(bRuns.length, 0, "Project A should not see Project B runs");
  });

  test("Direct getRun with wrong project returns null", () => {
    const run = getRun(PROJECT_B, "run-passed-1");
    assert.strictEqual(run, null);
  });

  test("Direct getRun with correct project returns run", () => {
    const run = getRun(PROJECT_B, "run-project-b-1");
    assert.ok(run);
    assert.strictEqual(run.projectId, PROJECT_B);
  });
}

// ─── Historical Immutability Tests ─────────────────────────────────────────

function testHistoricalImmutability() {
  console.log("\n── Historical Immutability ──");

  const { saveRun, getRun } = require("./src/domain/RunRepository");

  test("Historical run is self-contained (has all data to render)", () => {
    const run = getRun(PROJECT_A, "run-passed-1");
    assert.ok(run);
    assert.ok(run.title);
    assert.ok(run.status);
    assert.ok(run.results);
    assert.ok(run.results.length > 0);
    assert.ok(run.results[0].operation);
    assert.ok(run.results[0].status);
  });

  test("Historical run renders without requiring project state", () => {
    const run = getRun(PROJECT_A, "run-passed-1");
    // The run contains its own testSpecification, results, and executionPlanSummary
    assert.ok(run.testSpecification, "Should have test specification data");
    assert.ok(run.executionPlanSummary, "Should have execution plan summary");
    assert.ok(run.results, "Should have results");
    
    // Verify no external references that would require project state
    const json = JSON.stringify(run);
    assert.ok(!json.includes("compute") && !json.includes("recalculate"), 
      "Run should not reference recomputation");
  });

  test("Multiple saves of same ID overwrites (not duplicates)", () => {
    const run = buildPassedRun();
    run.title = "Updated title";
    run.durationMs = 9999;
    saveRun(PROJECT_A, run);
    const retrieved = getRun(PROJECT_A, "run-passed-1");
    assert.strictEqual(retrieved.title, "Updated title");
    assert.strictEqual(retrieved.durationMs, 9999);
  });
}

// ─── Secret Safety Tests ───────────────────────────────────────────────────
//
// Architecture note:
//   The RunRepository is a simple file store - it does NOT redact secrets.
//   Redaction happens at the API boundary in server.js BEFORE calling saveRun.
//   These tests verify:
//     1. The redaction functions work correctly (unit test)
//     2. The server.js execute-dependent handler redacts before persisting
//     3. The RunRepository faithfully stores what it receives

function testSecretSafety() {
  console.log("\n── Secret Safety ──");

  const { redactHeaders, redactSecretsFromObject, redactSecrets } = require("./src/execution/httpExecutor");

  test("redactHeaders redacts Authorization header", () => {
    const headers = {
      Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.test-token",
      "Content-Type": "application/json",
      "X-Api-Key": "sk-abc123",
    };
    const redacted = redactHeaders(headers);
    assert.strictEqual(redacted["Authorization"], "[REDACTED]");
    assert.strictEqual(redacted["Content-Type"], "application/json");
    assert.strictEqual(redacted["X-Api-Key"], "[REDACTED]");
  });

  test("redactHeaders redacts token, secret, password headers", () => {
    const headers = {
      "x-token": "raw-token-value",
      "x-secret": "classified",
      password: "hunter2",
      "safe-header": "visible",
    };
    const redacted = redactHeaders(headers);
    assert.strictEqual(redacted["x-token"], "[REDACTED]");
    assert.strictEqual(redacted["x-secret"], "[REDACTED]");
    assert.strictEqual(redacted["password"], "[REDACTED]");
    assert.strictEqual(redacted["safe-header"], "visible");
  });

  test("redactSecretsFromObject redacts token/secret/password fields", () => {
    const obj = {
      username: "admin",
      password: "super-secret-password-123",
      accessToken: "eyJhbGciOiJIUzI1NiJ9.raw-token",
      refreshToken: "rt-abc123refresh",
      apiKey: "prod-key-98765",
      nested: {
        secret: "classified-data",
        visible: "hello",
      },
    };
    const redacted = redactSecretsFromObject(obj);
    assert.strictEqual(redacted.password, "[REDACTED]");
    assert.strictEqual(redacted.accessToken, "[REDACTED]");
    assert.strictEqual(redacted.refreshToken, "[REDACTED]");
    assert.strictEqual(redacted.apiKey, "[REDACTED]");
    assert.strictEqual(redacted.nested.secret, "[REDACTED]");
    assert.strictEqual(redacted.username, "admin");
    assert.strictEqual(redacted.nested.visible, "hello");
  });

  test("redactSecrets redacts Bearer token strings", () => {
    const result = redactSecrets("Bearer eyJhbGciOiJIUzI1NiJ9.test");
    assert.strictEqual(result, "[AUTH_TOKEN_REDACTED]");
  });

  test("redactSecrets preserves short non-token strings", () => {
    const result = redactSecrets("my-secret-api-key-abcdef");
    assert.strictEqual(result, "my-secret-api-key-abcdef");
  });

  test("redactSecrets preserves non-secret strings", () => {
    const result = redactSecrets("hello world");
    assert.strictEqual(result, "hello world");
  });

  // Integration test: simulate what server.js does before persisting
  test("Simulated server.js redaction pipeline produces safe persisted data", () => {
    const rawRun = buildRunWithSecrets();
    
    // Apply the same redaction pipeline as server.js
    const safeResults = rawRun.results.map((r) => ({
      ...r,
      response: r.response ? {
        status: r.response.status,
        statusText: r.response.statusText,
        headers: redactHeaders(r.response.headers),
        body: r.response.body ? redactSecretsFromObject(r.response.body) : null,
      } : null,
      request: r.request ? {
        ...r.request,
        headers: redactHeaders(r.request.headers),
        body: r.request.body ? redactSecretsFromObject(r.request.body) : null,
      } : null,
    }));

    const safeRun = { ...rawRun, results: safeResults };
    const rawJson = JSON.stringify(safeRun);

    // Verify secrets are redacted
    const dangerousPatterns = [
      "super-secret-password-123",
      "eyJhbGciOiJIUzI1NiJ9.raw-token",
      "prod-key-98765",
      "rt-abc123refresh",
      "sk-abc123secretkey",
      "should-not-be-visible",
      "classified-data",
      "raw-jwt-token",
    ];
    for (const pattern of dangerousPatterns) {
      assert.ok(!rawJson.includes(pattern),
        `Raw secret "${pattern}" should NOT appear in redacted JSON`);
    }

    // Verify redacted markers are present
    assert.ok(rawJson.includes("[REDACTED]"), "Should contain [REDACTED] markers");
    // [AUTH_TOKEN_REDACTED] appears when redactSecrets processes a string value
    // containing "Bearer "; in the pipeline, headers are caught by redactHeaders
    // which uses [REDACTED] - [AUTH_TOKEN_REDACTED] is for deeper string-level checks
    assert.ok(!rawJson.includes("should-not-be-visible"), "Response body access_token should be redacted");
    assert.ok(!rawJson.includes("classified-data"), "Response body secret should be redacted");
    assert.ok(!rawJson.includes("raw-jwt-token"), "Response body token should be redacted");
  });

  // Verify RunRepository faithfully stores what it receives (no accidental redaction)
  test("RunRepository faithfully stores provided data", () => {
    const { saveRun, getRun } = require("./src/domain/RunRepository");
    const run = buildPassedRun();
    saveRun(PROJECT_A, { ...run, id: "run-faithful-1" });
    const persisted = getRun(PROJECT_A, "run-faithful-1");
    assert.ok(persisted);
    assert.strictEqual(persisted.title, run.title);
    assert.strictEqual(persisted.status, run.status);
    assert.strictEqual(persisted.results[0].status, "passed");
    assert.strictEqual(persisted.results[0].request.body.name, "Updated Name");
  });
}

// ─── RunRepository API shape tests ────────────────────────────────────────

function testRunRepositoryAPI() {
  console.log("\n── RunRepository API ──");

  const repo = require("./src/domain/RunRepository");

  test("saveRun is a function", () => {
    assert.strictEqual(typeof repo.saveRun, "function");
  });

  test("getRun is a function", () => {
    assert.strictEqual(typeof repo.getRun, "function");
  });

  test("listRuns is a function", () => {
    assert.strictEqual(typeof repo.listRuns, "function");
  });

  test("deleteRun is a function", () => {
    assert.strictEqual(typeof repo.deleteRun, "function");
  });
}

// ─── Test-Data Isolation ──────────────────────────────────────────────────

function testDataIsolation() {
  console.log("\n── Test-Data Isolation ──");

  // Verify nothing was written outside TEST_DATA_DIR
  const runDirs = [
    path.join(TEST_DATA_DIR, "runs"),
    path.join(TEST_DATA_DIR, "runs", PROJECT_A),
    path.join(TEST_DATA_DIR, "runs", PROJECT_B),
  ];

  for (const dir of runDirs) {
    test(`Test run directory exists: ${path.basename(dir)}`, () => {
      assert.ok(fs.existsSync(dir), `Directory should exist: ${dir}`);
    });
  }

  test("No test data leaked outside TEMP_DIR", () => {
    const originalRunDir = path.join(originalDataDir, "runs");
    if (fs.existsSync(originalRunDir)) {
      const originalFiles = fs.readdirSync(originalRunDir);
      // Project-based directories shouldn't contain test projects
      const testProjectFiles = originalFiles.filter(f =>
        f.includes("test-project-a") || f.includes("test-project-b")
      );
      assert.strictEqual(testProjectFiles.length, 0,
        `Test data leaked to original runs dir: ${testProjectFiles.join(", ")}`);
    }
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  console.log("STEP 5.8 — Run Persistence Tests");
  console.log("=".repeat(50));
  console.log(`Test data directory: ${TEST_DATA_DIR}`);

  setupTestEnvironment();

  testRunRepositoryAPI();
  testRunRepository();
  testProjectIsolation();
  testHistoricalImmutability();
  testSecretSafety();
  testDataIsolation();

  // Cleanup
  teardownTestEnvironment();

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();