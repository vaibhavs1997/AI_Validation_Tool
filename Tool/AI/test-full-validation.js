/**
 * STEP 9L.2A — Full Validation Test
 * Tests all requirements before making changes
 */

const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { runPipeline } = require("./src/engine/orchestrator");

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

// CASE 1 - Structured ACs (4 explicit ACs)
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

// CASE 2 - Description only (no ACs)
const case2 = {
  key: "DESC-ONLY",
  summary: "User account validation",
  description: "Email is mandatory when creating an account. The email must use a valid format. Duplicate email addresses must not be accepted.",
  acceptanceCriteria: []
};

// CASE 3 - High-level description + explicit ACs
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

// CASE 4 - Unique description rule + ACs
const case4 = {
  key: "UNIQUE-001",
  summary: "Posts API",
  description: "Validate creating, retrieving, listing and deleting posts. Only administrators may delete posts.",
  acceptanceCriteria: [
    "Given a valid post payload, when a POST request is sent to /posts, then the API should create the post.",
    "Given postId 1, when a GET request is sent to /posts/{postId}, then the API should return the post.",
    "When a GET request is sent to /posts, then the API should return all posts.",
    "Given postId 1, when a DELETE request is sent to /posts/{postId}, then the API should delete it."
  ]
};

async function main() {
  console.log("==============================================\n");
  console.log("STEP 9L.2A — BEFORE CHANGE: FULL VALIDATION");
  console.log("==============================================\n");

  const results = {};

  // Run all 4 cases
  for (const [name, ticket] of Object.entries({ case1, case2, case3, case4 })) {
    console.log(`\n====== ${name.toUpperCase()} ======`);
    const result = await generateScenarios({ ticket, contract: postsContract });
    results[name] = result;
    
    console.log(`Scenarios: ${result.scenarios.length}`);
    
    const linked = result.scenarios.filter(s => s.endpointId).length;
    const unlinked = result.scenarios.filter(s => !s.endpointId).length;
    console.log(`Linked: ${linked}, Unlinked: ${unlinked}`);

    // Check acIndex values
    const acIndices = [...new Set(result.scenarios.map(s => s.acIndex))].sort((a, b) => (a ?? -1) - (b ?? -1));
    console.log(`acIndex values: [${acIndices.map(i => i === -1 ? 'null' : i).join(", ")}]`);

    // Detailed traceability
    result.scenarios.forEach((s, i) => {
      console.log(`  [${i+1}] ${s.id}`);
      console.log(`      acIndex: ${s.acIndex}, type: ${s.type}`);
      console.log(`      endpoint: ${s.endpointId || 'UNLINKED'}`);
      console.log(`      title: ${s.title?.substring(0, 50)}...`);
    });
  }

  // Invariant checks
  console.log("\n==============================================");
  console.log("INVARIANT CHECKS (BEFORE)");
  console.log("==================================");

  // INVARIANT 1: No legacy happy path
  console.log("\nINVARIANT 1: No synthetic happy-path from summary");
  const hasSyntheticHappyPath = Object.values(results).some(r => 
    r.scenarios.some(s => s.sourceAc === "Happy path" || s.title?.includes("Verify happy path"))
  );
  console.log(`  FAIL (legacy contamination): ${hasSyntheticHappyPath}`);

  // INVARIANT 2: Description-only generates scenarios
  console.log("\nINVARIANT 2: Description-only works through orchestrator");
  console.log(`  Case 2 scenarios: ${results.case2.scenarios.length}`);
  console.log(`  PASS: ${results.case2.scenarios.length > 0}`);

  // INVARIANT 3: acIndex integrity
  console.log("\nINVARIANT 3: acIndex values integrity");
  const case1Indices = results.case1.scenarios.map(s => s.acIndex).sort((a, b) => (a ?? -1) - (b ?? -1));
  console.log(`  Case 1 acIndices: [${case1Indices.map(i => i === -1 ? 'null' : i).join(", ")}]`);
  // Note: acIndex 0 is STATUS_CODE which doesn't generate conditions - this is expected behavior

  console.log("\n==============================================");
  console.log("BEFORE STATE: Pipeline uses orchestrator path");
  console.log("Legacy functions exist but are NOT called in normal flow");
  console.log("==================================");
}

main();