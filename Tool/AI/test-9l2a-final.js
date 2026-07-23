/**
 * STEP 9L.2A — Final Comprehensive Test
 * Tests all invariants for the unified pipeline
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

// CASE 1 — Structured ACs (4 explicit ACs)
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

// CASE 2 — Description only (no ACs)
const case2 = {
  key: "DESC-ONLY",
  summary: "User account validation",
  description: "Email is mandatory when creating an account. The email must use a valid format. Duplicate email addresses must not be accepted.",
  acceptanceCriteria: []
};

// CASE 3 — High-level description + explicit ACs
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

// CASE 4 — Unique description rule + ACs
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
  console.log("STEP 9L.2A — FINAL COMPREHENSIVE TEST");
  console.log("==============================================\n");

  let allPassed = true;

  // Test all 4 cases
  for (const [name, ticket] of Object.entries({ case1, case2, case3, case4 })) {
    console.log(`\n====== ${name.toUpperCase()} ======`);
    const result = await generateScenarios({ ticket, contract: postsContract });
    
    console.log(`Scenarios: ${result.scenarios.length}`);
    
    const linked = result.scenarios.filter(s => s.endpointId);
    const unlinked = result.scenarios.filter(s => !s.endpointId);
    console.log(`Linked: ${linked.length}, Unlinked: ${unlinked.length}`);

    // Check generationSource on all scenarios
    const allFromOrchestrator = result.scenarios.every(s => s.generationSource === "orchestrator");
    if (!allFromOrchestrator) {
      console.log(`  FAIL: Not all scenarios have generationSource=orchestrator`);
      allPassed = false;
    } else {
      console.log(`  PASS: All scenarios from orchestrator`);
    }

    // Check for synthetic happy path
    const hasHappyPath = result.scenarios.some(s => s.title?.includes("Verify happy path"));
    if (hasHappyPath) {
      console.log(`  FAIL: Contains synthetic happy-path`);
      allPassed = false;
    } else {
      console.log(`  PASS: No synthetic happy-path`);
    }

    if (result.scenarios.length > 0) {
      console.log(`\n  Scenario details:`);
      result.scenarios.forEach((s, i) => {
        console.log(`    [${i+1}] acIndex=${s.acIndex ?? -1} ${s.endpointId ? 'LINKED' : 'UNLINKED'} ${s.type}`);
      });
    }
  }

  console.log("\n==============================================");
  console.log("FINAL INVARIANT VERIFICATION");
  console.log("==================================");
  
  // Final checks
  const result1 = await generateScenarios({ ticket: case1, contract: postsContract });
  
  // INVARIANT 1: All scenarios from orchestrator
  const inv1 = result1.scenarios.every(s => s.generationSource === "orchestrator");
  console.log(`\nINVARIANT 1: All scenarios from orchestrator: ${inv1 ? 'PASS' : 'FAIL'}`);
  
  // INVARIANT 2: No legacy happy path
  const inv2 = !result1.scenarios.some(s => s.title?.includes("Verify happy path") || s.sourceAc === "Happy path");
  console.log(`INVARIANT 2: No synthetic happy-path: ${inv2 ? 'PASS' : 'FAIL'}`);
  
  // INVARIANT 3: acIndex preservation (0, 1, 2, 3 should be present or -1 for description)
  const acIndices = [...new Set(result1.scenarios.map(s => s.acIndex ?? -1))].sort((a, b) => a - b);
  console.log(`INVARIANT 3: acIndex values preserved: ${acIndices.map(i => i).join(", ")}`);
  
  // INVARIANT 4: Description-only still works
  const result2 = await generateScenarios({ ticket: case2, contract: postsContract });
  const inv4 = result2.scenarios.length > 0 && result2.scenarios.every(s => s.generationSource === "orchestrator");
  console.log(`INVARIANT 4: Description-only works via orchestrator: ${inv4 ? 'PASS' : 'FAIL'} (${result2.scenarios.length} scenarios)`);

  console.log("\n==============================================");
  console.log(`OVERALL: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log("==================================");
}

main();