/**
 * STEP 9L.2A — BEFORE CHANGE ANALYSIS
 * 
 * This test documents the BEFORE state of the architecture.
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
  console.log("STEP 9L.2A — BEFORE ARCHITECTURE ANALYSIS");
  console.log("==============================================");

  // Test 1: Orchestrator pipeline directly
  console.log("\n====== ORCHESTRATOR PIPELINE DIRECT ======");
  const pipeline = runPipeline(case1, "STANDARD");
  console.log(`Requirements: ${pipeline.requirements.length}`);
  console.log(`Test cases: ${pipeline.testCases.length}`);
  console.log(`Requirement gaps: ${pipeline.requirementGaps.length}`);
  
  console.log("\nRequirements with acIndex:");
  pipeline.requirements.forEach((r, i) => {
    console.log(`  [${i+1}] ${r.requirementId}: ${r.requirementType}, acIndex=${r.acIndex}, source=${r.sourceType}`);
  });

  // Test 2: Full generateScenarios
  console.log("\n====== FULL generateScenarios OUTPUT ======");
  const result = await generateScenarios({ ticket: case1, contract: postsContract });
  console.log(`Scenarios generated: ${result.scenarios.length}`);
  
  const linked = result.scenarios.filter(s => s.endpointId);
  const unlinked = result.scenarios.filter(s => !s.endpointId);
  
  console.log(`\nLinked: ${linked.length}`);
  console.log(`Unlinked: ${unlinked.length}`);
  
  console.log("\nAll scenarios:");
  result.scenarios.forEach((s, i) => {
    console.log(`  [${i+1}] ${s.id}`);
    console.log(`      acIndex: ${s.acIndex}`);
    console.log(`      endpoint: ${s.endpointId || 'UNLINKED'}`);
    console.log(`      title: ${s.title?.substring(0, 60)}...`);
  });

  // Check for legacy patterns
  console.log("\n====== LEGACY CONTAMINATION CHECK ======");
  
  const hasHappyPathSynthetic = result.scenarios.some(s => 
    s.sourceAc === "Happy path" || 
    s.title?.includes("Verify happy path")
  );
  console.log(`Legacy synthetic happy-path: ${hasHappyPathSynthetic}`);
  
  const acIndices = result.scenarios.map(s => s.acIndex).sort((a, b) => {
    const va = a ?? -1;
    const vb = b ?? -1;
    return va - vb;
  });
  console.log(`acIndex values: [${acIndices.join(", ")}]`);
  
  // Check if summary is used as independent source for happy path
  const summaryBasedScenario = result.scenarios.some(s => 
    s.sourceAc === case1.summary && 
    s.acIndex === -1
  );
  console.log(`Summary-based scenario (acIndex=-1): ${summaryBasedScenario}`);

  // Summary
  console.log("\n==============================================");
  console.log("BEFORE STATE SUMMARY");
  console.log("==================================");
  console.log("Pipeline: generateScenarios → orchestratorGenerate → runPipeline");
  console.log("         → adaptOrchestratorToMatchingFormat");
  console.log("         → assignEndpointsToTestCases");
  console.log(" ");
  console.log(`Total scenarios: ${result.scenarios.length}`);
  console.log(`  - From explicit ACs (acIndex 0-3): ${result.scenarios.filter(s => s.acIndex >= 0).length}`);
  console.log(`  - From description (acIndex -1): ${result.scenarios.filter(s => s.acIndex === -1).length}`);
  console.log(`  - Linked: ${linked.length}`);
  console.log(`  - Unlinked: ${unlinked.length}`);
}

main();