/**
 * STEP 9L.2A — After Change Validation Test
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

// Same test cases from STEP_9L_AUDIT_REPORT.md (CASE 1)
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

async function main() {
  console.log("==============================================\n");
  console.log("STEP 9L.2A — AFTER CHANGE VALIDATION");
  console.log("==============================================\n");

  // Test direct pipeline
  console.log("====== ORCHESTRATOR PIPELINE DIRECT ======");
  const pipeline = runPipeline(case1, "STANDARD");
  console.log(`Requirements: ${pipeline.requirements.length}`);
  console.log(`Test cases: ${pipeline.testCases.length}`);
  
  console.log("\nRequirements with acIndex:");
  pipeline.requirements.forEach((r, i) => {
    console.log(`  [${i+1}] ${r.requirementId}: ${r.requirementType}, acIndex=${r.acIndex}`);
  });

  // Check if orchestrator test cases have acIndex
  console.log("\nOrchestrator test cases traceability:");
  pipeline.testCases.forEach((tc, i) => {
    console.log(`  [${i+1}] ${tc.testCaseId}: acIndex=${tc.traceability?.acIndex}, reqIds=${tc.traceability?.requirementIds}`);
  });

  // Test full generateScenarios
  console.log("\n\n====== FULL generateScenarios OUTPUT ======");
  const result = await generateScenarios({ ticket: case1, contract: postsContract });
  console.log(`Scenarios generated: ${result.scenarios.length}`);
  
  const linked = result.scenarios.filter(s => s.endpointId);
  const unlinked = result.scenarios.filter(s => !s.endpointId);
  console.log(`Linked: ${linked.length}, Unlinked: ${unlinked.length}`);

  console.log("\nAll scenarios:");
  result.scenarios.forEach((s, i) => {
    console.log(`  [${i+1}] ${s.id}`);
    console.log(`      acIndex: ${s.acIndex}`);
    console.log(`      generationSource: ${s.generationSource || 'undefined'}`);
    console.log(`      endpoint: ${s.endpointId || 'UNLINKED'}`);
    console.log(`      title: ${s.title?.substring(0, 50)}...`);
  });

  // Invariant checks
  console.log("\n==============================================");
  console.log("INVARIANT CHECKS (AFTER)");
  console.log("==================================");

  // INVARIANT 1: All scenarios have generationSource = orchestrator
  const allOrchestrator = result.scenarios.every(s => s.generationSource === "orchestrator");
  console.log(`\nINVARIANT 1: All scenarios from orchestrator: ${allOrchestrator}`);

  // INVARIANT 2: No synthetic happy path
  const hasLegacyHappyPath = result.scenarios.some(s => 
    s.title?.includes("Verify happy path") || 
    s.sourceAc === "Happy path"
  );
  console.log(`INVARIANT 3: No synthetic happy-path: ${!hasLegacyHappyPath}`);

  // INVARIANT 3: acIndex preservation
  const acIndices = result.scenarios.map(s => s.acIndex ?? -1).sort((a, b) => a - b);
  console.log(`INVARIANT 5: acIndex values: [${acIndices.map(i => i === -1 ? '-1' : i).join(", ")}]`);
}

main();