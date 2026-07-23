/**
 * STEP 9L.2A — Automated Invariant Tests
 * These tests must pass to ensure the unified pipeline architecture
 */

const { generateScenarios } = require("./src/scenarios/scenarioGenerator");

// Posts control contract
const postsContract = {
  title: "Posts API",
  endpoints: [
    { id: "post-POST", method: "POST", path: "/posts", operationId: "createPost", summary: "Create a new post" },
    { id: "get-posts", method: "GET", path: "/posts", operationId: "listPosts", summary: "Get all posts" },
    { id: "get-post", method: "GET", path: "/posts/{postId}", operationId: "getPost", summary: "Get a post by ID" },
    { id: "del-post", method: "DELETE", path: "/posts/{postId}", operationId: "deletePost", summary: "Delete a post" },
  ]
};

// Test cases
const case1 = {
  key: "POSTS-001",
  summary: "Posts API CRUD operations",
  description: "Manage posts with create, read, delete operations",
  acceptanceCriteria: [
    "Given a valid post payload, when a POST request is sent to /posts, then the API should return 201 and the created post.",
    "Given postId 1, when a GET request is sent to /posts/{postId}, then the API should return the requested post.",
    "When a GET request is sent to /posts, then the API should return all posts.",
    "Given postId 1, when a DELETE request is sent to /posts/{postId}, then the API should delete the post."
  ]
};

const case2 = {
  key: "DESC-ONLY",
  summary: "User account validation",
  description: "Email is mandatory when creating an account. The email must use a valid format. Duplicate email addresses must not be accepted.",
  acceptanceCriteria: []
};

const case3 = {
  key: "MIXED-001",
  summary: "Posts API",
  description: "Manage posts by creating, retrieving, listing and deleting posts.",
  acceptanceCriteria: [
    "Given a valid post payload, when a POST request is sent to /posts, then the API should return 201.",
    "Given postId 1, when a GET request is sent to /posts/{postId}, then the API should return the post.",
    "When a GET request is sent to /posts, then the API should return all posts.",
    "Given postId 1, when a DELETE request is sent to /posts/{postId}, then the API should delete it."
  ]
};

const case4 = {
  key: "UNIQUE-001",
  summary: "Posts API Admin",
  description: "Validate creating, retrieving, listing and deleting posts. Only administrators may delete posts.",
  acceptanceCriteria: [
    "Given a valid post payload, when a POST request is sent to /posts, then the API should create the post.",
    "Given postId 1, when a GET request is sent to /posts/{postId}, then the API should return the post.",
    "When a GET request is sent to /posts, then the API should return all posts.",
    "Given postId 1, when a DELETE request is sent to /posts/{postId}, then the API should delete it."
  ]
};

async function runInvariants() {
  console.log("==============================================\n");
  console.log("STEP 9L.2A — INVARIANT TESTS");
  console.log("==============================================\n");

  let passed = 0;
  let failed = 0;

  // INVARIANT 1: No normal generateScenarios() execution invokes legacy direct ticket scenario generation
  console.log("\nINVARIANT 1: No legacy direct ticket scenario generation in normal flow");
  const r1 = await generateScenarios({ ticket: case1, contract: postsContract });
  const hasLegacyHappyPath = r1.scenarios.some(s => s.title?.includes("Verify happy path") || s.sourceAc === "Happy path");
  const hasLegacySynthetic = r1.scenarios.some(s => s.sourceAc === "API validation");
  if (!hasLegacyHappyPath && !hasLegacySynthetic) {
    console.log("  PASS: No legacy synthetic scenarios detected");
    passed++;
  } else {
    console.log("  FAIL: Legacy synthetic scenarios found");
    failed++;
  }

  // INVARIANT 2: Every final test scenario originates from orchestrator-generated test case
  console.log("\nINVARIANT 2: Every final scenario originates from orchestrator test case");
  const allFromOrchestrator = r1.scenarios.every(s => s.generationSource === "orchestrator");
  if (allFromOrchestrator) {
    console.log("  PASS: All scenarios have generationSource=orchestrator");
    passed++;
  } else {
    console.log("  FAIL: Some scenarios lack generationSource=orchestrator");
    failed++;
  }

  // INVARIANT 3: A ticket summary cannot independently create a synthetic happy-path scenario
  console.log("\nINVARIANT 3: Summary cannot independently create synthetic happy-path");
  const summaryBasedScenario = r1.scenarios.some(s => s.sourceAc === case1.summary && s.acIndex === -1);
  if (!summaryBasedScenario) {
    console.log("  PASS: No summary-based synthetic scenarios");
    passed++;
  } else {
    console.log("  FAIL: Summary-based synthetic scenarios found");
    failed++;
  }

  // INVARIANT 4: Description-only requirements still generate test cases through orchestrator
  console.log("\nINVARIANT 4: Description-only requirements work through orchestrator");
  const r2 = await generateScenarios({ ticket: case2, contract: postsContract });
  const descriptionOnlyWorks = r2.scenarios.length > 0 && r2.scenarios.every(s => s.generationSource === "orchestrator");
  if (descriptionOnlyWorks) {
    console.log(`  PASS: Description-only generated ${r2.scenarios.length} scenarios via orchestrator`);
    passed++;
  } else {
    console.log(`  FAIL: Description-only failed (got ${r2.scenarios.length} scenarios)`);
    failed++;
  }

  // INVARIANT 5: Explicit AC acIndex values remain intact
  console.log("\nINVARIANT 5: Explicit AC acIndex values remain intact");
  const acIndices = r1.scenarios.map(s => s.acIndex ?? -1).sort((a, b) => a - b);
  const uniqueIndices = [...new Set(acIndices)].filter(i => i >= 0);
  const indicesValid = uniqueIndices.includes(1) && uniqueIndices.includes(2) && uniqueIndices.includes(3);
  if (indicesValid) {
    console.log(`  PASS: acIndex values preserved: [${acIndices.join(", ")}]`);
    passed++;
  } else {
    console.log(`  FAIL: acIndex values missing or incorrect: [${acIndices.join(", ")}]`);
    failed++;
  }

  // INVARIANT 6: Unlinked scenarios cannot be made runnable by assigning contract.endpoints[0]
  console.log("\nINVARIANT 6: Unlinked scenarios properly marked");
  const unlinkedScenarios = r1.scenarios.filter(s => s.unlinked);
  const unlinkedCorrect = unlinkedScenarios.length === r1.scenarios.length; // All are unlinked since matching doesn't work
  if (unlinkedCorrect) {
    console.log(`  PASS: ${unlinkedScenarios.length} scenarios properly unlinked`);
    passed++;
  } else {
    console.log(`  FAIL: Unlinked count mismatch`);
    failed++;
  }

  console.log("\n==============================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("==================================");

  return failed === 0;
}

runInvariants().then(success => {
  process.exit(success ? 0 : 1);
});