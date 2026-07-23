/**
 * STEP 9L.2C — Detailed Matching Pipeline Audit
 */

const { runPipeline } = require("./src/engine/orchestrator");
const { generateScenarios } = require("./src/scenarios/scenarioGenerator");

const postsContract = {
  title: "Posts API",
  endpoints: [
    { id: "post-POST", method: "POST", path: "/posts", operationId: "createPost", summary: "Create a new post" },
    { id: "get-posts", method: "GET", path: "/posts", operationId: "listPosts", summary: "Get all posts" },
    { id: "get-post", method: "GET", path: "/posts/{postId}", operationId: "getPost", summary: "Get a post by ID" },
    { id: "del-post", method: "DELETE", path: "/posts/{postId}", operationId: "deletePost", summary: "Delete a post" },
  ]
};

const controlTicket = {
  key: "POSTS-001",
  summary: "Posts API CRUD operations",
  description: "Manage posts with create, read, delete operations",
  acceptanceCriteria: [
    "Given a valid post payload containing title, body, and userId, When a POST request is sent to /posts, Then the post should be created successfully with HTTP status 201, And the response should contain id, title, body, and userId.",
    "Given an existing postId of 1, When a GET request is sent to /posts/{postId}, Then the requested post should be returned successfully with HTTP status 200, And the response should contain id, title, body, and userId.",
    "When a GET request is sent to /posts, Then the API should return HTTP status 200, And the response should contain a list of posts.",
    "Given an existing postId of 1, When a DELETE request is sent to /posts/{postId}, Then the API should return HTTP status 200."
  ]
};

async function main() {
  console.log("==============================================\n");
  console.log("STEP 9L.2C — MATCHING PIPELINE AUDIT\n");

  // Step 1: Full pipeline
  const pipeline = runPipeline(controlTicket, "STANDARD");
  console.log("====== TEST CASES FROM PIPELINE ======");
  
  pipeline.testCases.forEach((tc, i) => {
    console.log(`\n[${i+1}] ${tc.testCaseId}`);
    console.log(`    acIndex: ${tc.traceability?.acIndex}`);
    console.log(`    request.method: ${tc.request?.method || 'null'}`);
    console.log(`    request.endpoint: ${tc.request?.endpoint || 'null'}`);
    console.log(`    methodHint: ${tc.methodHint || 'null'}`);
    console.log(`    pathHint: ${tc.pathHint || 'null'}`);
    console.log(`    category: ${tc.classification?.category}`);
  });

  // Step 2: Test the full generateScenarios path
  console.log("\n\n====== FULL generateScenarios OUTPUT ======");
  const scenarios = await generateScenarios({ ticket: controlTicket, contract: postsContract });
  console.log(`Total scenarios: ${scenarios.scenarios.length}`);
  
  const linked = scenarios.scenarios.filter(s => s.endpointId);
  const unlinked = scenarios.scenarios.filter(s => !s.endpointId);
  console.log(`Linked: ${linked.length}, Unlinked: ${unlinked.length}`);

  console.log("\n====== SCENARIOS BREAKDOWN ======");
  scenarios.scenarios.forEach((s, i) => {
    console.log(`\n[${i+1}] ${s.id}`);
    console.log(`    acIndex: ${s.acIndex}`);
    console.log(`    endpointId: ${s.endpointId || 'UNLINKED'}`);
    console.log(`    method: ${s.method}`);
    console.log(`    path: ${s.path}`);
    console.log(`    type: ${s.type}`);
    console.log(`    generationSource: ${s.generationSource}`);
  });
}

main();