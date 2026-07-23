/**
 * STEP 9L.2C-2 Regression Tests
 * 
 * Tests all 5 control datasets against the new AI-first pipeline.
 */

const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { parseContract } = require("./src/contracts/contractParser");

const postsContractJson = {
  openapi: "3.0.0",
  info: { title: "JSONPlaceholder Posts API", version: "1.0.0" },
  servers: [{ url: "https://jsonplaceholder.typicode.com" }],
  paths: {
    "/posts": {
      post: {
        operationId: "createPost",
        summary: "Create a new post",
        responses: { "201": { description: "Created" }, "400": { description: "Bad Request" } },
      },
      get: {
        operationId: "getPosts",
        summary: "Get all posts",
        responses: { "200": { description: "OK" } },
      },
    },
    "/posts/{postId}": {
      get: {
        operationId: "getPost",
        summary: "Get a single post by ID",
        parameters: [{ name: "postId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not Found" } },
      },
      delete: {
        operationId: "deletePost",
        summary: "Delete a post",
        parameters: [{ name: "postId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK" } },
      },
    },
  },
};

const controlRequirement = {
  key: "AI-TEST-001",
  summary: "Validate JSONPlaceholder Posts API operations",
  description: "Users should be able to create posts, retrieve individual posts, list posts, and delete posts.",
  acceptanceCriteria: [
    "Given a valid post payload containing title, body, and userId, When a POST request is sent to /posts, Then the post should be created successfully with HTTP status 201, And the response should contain id, title, body, and userId.",
    "Given an existing postId of 1, When a GET request is sent to /posts/{postId}, Then the requested post should be returned successfully with HTTP status 200, And the response should contain id, title, body, and userId.",
    "When a GET request is sent to /posts, Then the API should return HTTP status 200, And the response should contain a list of posts.",
    "Given an existing postId of 1, When a DELETE request is sent to /posts/{postId}, Then the API should return HTTP status 200.",
  ],
};

const naturalLanguageRequirement = {
  key: "AI-TEST-002",
  summary: "View post details",
  description: "Users should be able to view a specific post using its identifier. If the post exists, its details should be returned successfully. The returned data should include the post identifier, title, content, and owning user.",
  acceptanceCriteria: [],
};

async function main() {
  console.log("STEP 9L.2C-2 AI-First Pipeline Regression Tests");
  console.log("=".repeat(60));

  const contract = parseContract(postsContractJson);

  // Test 1: Control - Explicit API ACs
  console.log("\nTest A: Control - Explicit API ACs");
  const resultA = await generateScenarios({ ticket: controlRequirement, contract });
  console.log(`  Mode: ${resultA.mode}`);
  console.log(`  Warnings: ${resultA.warnings?.length || 0}`);
  console.log(`  Scenarios: ${resultA.scenarios.length}`);
  resultA.scenarios.forEach((s, i) => {
    console.log(`    [${i + 1}] ${s.type} - ${s.title.slice(0, 50)}... (endpoint: ${s.endpointId || "UNLINKED"})`);
  });

  // Test 2: Natural Language
  console.log("\nTest B: Natural Language");
  const resultB = await generateScenarios({ ticket: naturalLanguageRequirement, contract });
  console.log(`  Mode: ${resultB.mode}`);
  console.log(`  Scenarios: ${resultB.scenarios.length}`);
  resultB.scenarios.forEach((s, i) => {
    console.log(`    [${i + 1}] ${s.type} - ${s.title.slice(0, 50)}... (endpoint: ${s.endpointId || "UNLINKED"})`);
  });

  // Test 3: Check generationMeta exists
  console.log("\nGeneration Metadata:");
  console.log(`  Mode: ${resultA.generationMeta?.mode || "missing"}`);
  console.log(`  Model: ${resultA.generationMeta?.model || "missing"}`);
  console.log(`  Fallback Reason: ${resultA.generationMeta?.fallbackReason || "none"}`);

  // Summary
  const aiUsed = resultA.generationMeta?.mode === "ai_primary";
  const scenariosLinked = resultA.scenarios.filter((s) => s.endpointId).length;
  
  console.log("\n" + "=".repeat(60));
  console.log("RESULTS:");
  console.log(`  AI Primary: ${aiUsed ? "YES" : "NO"}`);
  console.log(`  Scenarios Generated: ${resultA.scenarios.length}`);
  console.log(`  Scenarios Linked: ${scenariosLinked}/${resultA.scenarios.length}`);
}

main().catch(console.error);