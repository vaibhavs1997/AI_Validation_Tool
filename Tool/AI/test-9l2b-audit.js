/**
 * STEP 9L.2B — Audit Current AC Decomposition
 * Trace the full pipeline to understand current behavior
 */

const { runPipeline } = require("./src/engine/orchestrator");

const controlTicket = {
  key: "POSTS-001",
  summary: "Posts API CRUD operations",
  description: "Manage posts with create, read, delete operations",
  acceptanceCriteria: [
    // AC1 - Multi-clause with Gherkin
    "Given a valid post payload containing title, body, and userId, When a POST request is sent to /posts, Then the post should be created successfully with HTTP status 201, And the response should contain id, title, body, and userId.",
    // AC2 - Multi-clause with explicit endpoint
    "Given an existing postId of 1, When a GET request is sent to /posts/{postId}, Then the requested post should be returned successfully with HTTP status 200, And the response should contain id, title, body, and userId.",
    // AC3 - Multi-line style
    `When a GET request is sent to /posts,
Then the API should return HTTP status 200,
And the response should contain a list of posts.`,
    // AC4 - Single-line clean
    "Given an existing postId of 1, When a DELETE request is sent to /posts/{postId}, Then the API should return HTTP status 200."
  ]
};

async function main() {
  console.log("==============================================\n");
  console.log("STEP 9L.2B — CURRENT AC DECOMPOSITION AUDIT");
  console.log("==============================================\n");

  // Full pipeline
  const pipeline = runPipeline(controlTicket, "STANDARD");
  
  console.log("====== REQUIREMENTS ======");
  console.log(`Total: ${pipeline.requirements.length}\n`);
  
  const reqByAc = {};
  pipeline.requirements.forEach((r, i) => {
    const acIdx = r.acIndex;
    if (!reqByAc[acIdx]) reqByAc[acIdx] = [];
    reqByAc[acIdx].push(r);
    console.log(`[${i+1}] ${r.requirementId}: ${r.requirementType}, acIndex=${acIdx}`);
    console.log(`    methodHint: ${r.methodHint}`);
    console.log(`    pathHint: ${r.pathHint}`);
    console.log(`    Text: ${r.description?.substring(0, 70)}...`);
  });

  console.log("\n\n====== TEST CASES ======");
  console.log(`Total: ${pipeline.testCases.length}\n`);
  
  pipeline.testCases.forEach((tc, i) => {
    console.log(`[${i+1}] ${tc.testCaseId}: ${tc.classification?.category}`);
    console.log(`    acIndex: ${tc.traceability?.acIndex}`);
    console.log(`    methodHint: ${tc.request?.method}`);
    console.log(`    pathHint: ${tc.request?.endpoint}`);
    console.log(`    title: ${tc.title?.substring(0, 60)}...`);
  });

  // acIndex audit
  console.log("\n\n====== acIndex AUDIT ======");
  const acIndices = [...new Set(pipeline.requirements.map(r => r.acIndex))].sort((a, b) => (a ?? -1) - (b ?? -1));
  console.log(`Unique acIndex values: [${acIndices.map(i => i === -1 ? '-1' : i).join(", ")}]`);
  
  const ac0Reqs = pipeline.requirements.filter(r => r.acIndex === 0);
  console.log(`\nRequirements with acIndex=0: ${ac0Reqs.length}`);
  if (ac0Reqs.length > 0) {
    ac0Reqs.forEach(r => {
      console.log(`  - ${r.requirementType}: ${r.description?.substring(0, 60)}...`);
    });
  }

  // Problems identified
  console.log("\n\n====== PROBLEMS IDENTIFIED ======");
  const status201Reqs = pipeline.requirements.filter(r => r.description?.includes("201"));
  console.log(`Requirements about status 201: ${status201Reqs.length}`);
  status201Reqs.forEach(r => {
    console.log(`  acIndex=${r.acIndex}: ${r.description?.substring(0, 60)}...`);
  });
}

main();