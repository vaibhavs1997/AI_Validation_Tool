/**
 * STEP 10.1 Test - AI Test Generator V2
 */

const { generateWithAiV2, buildCompactContractContext } = require("./src/engine/aiTestGeneratorV2");
const { parseContract } = require("./src/contracts/contractParser");

// Control Contract: JSONPlaceholder Posts API
const postsContractJson = {
  openapi: "3.0.0",
  info: { title: "JSONPlaceholder Posts API", version: "1.0.0" },
  servers: [{ url: "https://jsonplaceholder.typicode.com" }],
  paths: {
    "/posts": {
      post: {
        operationId: "createPost",
        summary: "Create a new post",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "body", "userId"],
                properties: {
                  title: { type: "string" },
                  body: { type: "string" },
                  userId: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "400": { description: "Bad Request" },
        },
      },
      get: {
        operationId: "getPosts",
        summary: "List all posts",
        responses: { "200": { description: "OK" } },
      },
    },
    "/posts/{postId}": {
      get: {
        operationId: "getPost",
        summary: "Get a single post by ID",
        parameters: [
          { name: "postId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "OK" },
          "404": { description: "Not Found" },
        },
      },
      delete: {
        operationId: "deletePost",
        summary: "Delete a post",
        parameters: [
          { name: "postId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
  },
};

const controlRequirement = {
  key: "V2-TEST-001",
  summary: "Validate JSONPlaceholder Posts API",
  description: "Validate the JSONPlaceholder Posts API operations for creating, retrieving, listing, and deleting posts.",
  acceptanceCriteria: [
    "Given valid post information containing title, body, and userId, when a new post is created, then the post should be created successfully with HTTP status 201, and the response should contain id, title, body, and userId.",
    "Given an existing post with postId 1, when the user requests that specific post, then the requested post should be returned successfully with HTTP status 200, and the response should contain id, title, body, and userId.",
    "Given posts exist in the system, when the user requests all available posts, then the API should return HTTP status 200 and provide a list of posts.",
    "Given an existing post with postId 1, when the user removes that post, then the delete operation should complete successfully with HTTP status 200.",
  ],
};

const descriptionOnlyRequirement = {
  key: "V2-TEST-002",
  summary: "Retrieve post details",
  description: "As a user, I want to retrieve an existing post using its ID so that I can view its details.",
  acceptanceCriteria: [],
};

async function main() {
  console.log("STEP 10.1 — AI Test Generator V2 Test");
  console.log("=".repeat(60));

  const contract = parseContract(postsContractJson);
  
  console.log("\nContract Context:");
  console.log(JSON.stringify(buildCompactContractContext(contract), null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("Test 1: Control Requirement (Explicit ACs)");

  const result1 = await generateWithAiV2(controlRequirement, contract);
  
  if (!result1.success) {
    console.log(`AI FAILED: ${result1.reason}`);
    return;
  }

  console.log(`\nAI Generated: ${result1.testCases.length} test cases`);
  console.log(`Model: ${result1.model}`);

  result1.testCases.forEach((tc, i) => {
    console.log(`\n[${i+1}] ${tc.type} - ${tc.title}`);
    console.log(`    Method: ${tc.proposedOperation?.method}`);
    console.log(`    Path: ${tc.proposedOperation?.path}`);
    console.log(`    Status: ${tc.expected?.status}`);
    console.log(`    Evidence: ${tc.evidence?.join(", ") || "none"}`);
  });

  console.log("\n" + "=".repeat(60));
  console.log("Test 2: Description-Only Requirement");

  const result2 = await generateWithAiV2(descriptionOnlyRequirement, contract);
  
  if (!result2.success) {
    console.log(`AI FAILED: ${result2.reason}`);
    return;
  }

  console.log(`\nAI Generated: ${result2.testCases.length} test cases`);
  
  result2.testCases.forEach((tc, i) => {
    console.log(`\n[${i+1}] ${tc.type} - ${tc.title}`);
    console.log(`    Method: ${tc.proposedOperation?.method}`);
    console.log(`    Path: ${tc.proposedOperation?.path}`);
    console.log(`    Evidence: ${tc.evidence?.join(", ") || "none"}`);
  });

  // Verification
  console.log("\n" + "=".repeat(60));
  console.log("VERIFICATION");
  console.log("=".repeat(60));

  const postMappings = result1.testCases.filter((tc) => 
    tc.proposedOperation?.path?.includes("/posts") && !tc.proposedOperation?.path?.includes("{postId}")
  ).length;
  const getPostMappings = result1.testCases.filter((tc) => 
    tc.proposedOperation?.method === "GET" && tc.proposedOperation?.path?.includes("{postId}")
  ).length;

  console.log(`POST /posts mappings: ${postMappings}`);
  console.log(`GET /posts/{postId} mappings: ${getPostMappings}`);

  // Check for bad patterns
  const badPatterns = result1.testCases.filter((tc) => 
    tc.title.includes("Acceptance Criteria") || 
    tc.title.includes("should be enforced") ||
    tc.title.includes("should not be allowed")
  );

  console.log(`Bad patterns found: ${badPatterns.length}`);

  if (badPatterns.length === 0 && postMappings >= 1 && getPostMappings >= 1) {
    console.log("\nV2 IMPLEMENTATION: PASS");
  } else {
    console.log("\nV2 IMPLEMENTATION: NEEDS REVIEW");
  }
}

main().catch(console.error);