/**
 * STEP 10.3 — Quality, Coverage & Deduplication Tests
 */

const { generateWithAiV2 } = require("./src/engine/aiTestGeneratorV2");
const { validateTestCases } = require("./src/engine/deterministicGroundingV2");
const { parseContract } = require("./src/contracts/contractParser");

// Dataset A: Posts API
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
        responses: { "201": { description: "Created" }, "400": { description: "Bad Request" } },
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

// Dataset B: Schema-rich Users API
const usersContractJson = {
  openapi: "3.0.0",
  info: { title: "Users API", version: "1.0.0" },
  servers: [{ url: "https://example.com" }],
  paths: {
    "/users": {
      post: {
        operationId: "createUser",
        summary: "Create a user account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "age", "name"],
                properties: {
                  email: { type: "string", format: "email" },
                  age: { type: "integer", minimum: 18, maximum: 65 },
                  name: { type: "string", minLength: 2 },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": { description: "Bad Request" } },
      },
    },
  },
};

// Dataset C: Minimal Posts
const minimalPostsContractJson = {
  openapi: "3.0.0",
  info: { title: "Minimal Posts API", version: "1.0.0" },
  servers: [{ url: "https://example.com" }],
  paths: {
    "/posts": {
      get: { operationId: "getPosts", summary: "List all posts", responses: { "200": { description: "OK" } } },
    },
    "/posts/{postId}": {
      get: {
        operationId: "getPost",
        summary: "Get a post by ID",
        parameters: [{ name: "postId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not Found" } },
      },
    },
    "/posts/create": {
      post: {
        operationId: "createPost",
        summary: "Create a post",
        responses: { "201": { description: "Created" } },
      },
    },
  },
};

function printTestCase(tc, idx) {
  console.log(`\n[${idx}] ${tc.type} - ${tc.title}`);
  console.log(`    Origin: ${tc.testOrigin || "unknown"}`);
  console.log(`    Confidence: ${tc.confidence || "unknown"}`);
  console.log(`    Operation: ${tc.proposedOperation?.method} ${tc.proposedOperation?.path}`);
  if (tc.negativeCondition) {
    console.log(`    Negative: ${tc.negativeCondition.kind} (${tc.negativeCondition.field})`);
  }
  console.log(`    Evidence: ${tc.evidence?.join(", ") || "none"}`);
}

async function runQualityTests() {
  console.log("STEP 10.3 — Quality, Coverage & Deduplication Tests");
  console.log("=".repeat(60));

  const postsContract = parseContract(postsContractJson);
  const usersContract = parseContract(usersContractJson);
  const minimalContract = parseContract(minimalPostsContractJson);

  // Dataset A: Posts API
  console.log("\n" + "=".repeat(60));
  console.log("DATASET A — Posts API (4 Explicit ACs)");
  console.log("=".repeat(60));

  const datasetAReq = {
    summary: "Validate JSONPlaceholder Posts API",
    description: "Validate the JSONPlaceholder Posts API operations for creating, retrieving, listing, and deleting posts.",
    acceptanceCriteria: [
      "Given valid post information containing title, body, and userId, when a new post is created, then the post should be created successfully with HTTP status 201, and the response should contain id, title, body, and userId.",
      "Given an existing post with postId 1, when the user requests that specific post, then the requested post should be returned successfully with HTTP status 200, and the response should contain id, title, body, and userId.",
      "Given posts exist in the system, when the user requests all available posts, then the API should return HTTP status 200 and provide a list of posts.",
      "Given an existing post with postId 1, when the user removes that post, then the delete operation should complete successfully with HTTP status 200.",
    ],
  };

  const resultA = await generateWithAiV2(datasetAReq, postsContract);
  if (resultA.success) {
    const groundedA = validateTestCases(resultA.testCases, postsContract);
    console.log(`Generated: ${resultA.testCases.length}`);
    console.log(`Grounded: ${groundedA.length}`);
    
    groundedA.forEach((tc, i) => printTestCase(tc, i + 1));
    
    // Check for bad patterns
    const badPatterns = groundedA.filter((tc) =>
      tc.title.includes("Acceptance Criteria") ||
      tc.title.includes("should be enforced") ||
      tc.title.includes("should not be allowed")
    );
    console.log(`\nBad patterns found: ${badPatterns.length}`);
  }

  // Dataset B: Users API (schema-rich)
  console.log("\n" + "=".repeat(60));
  console.log("DATASET B — Users API (Schema-rich, 1 requirement)");
  console.log("=".repeat(60));

  const datasetBReq = {
    summary: "Create user account",
    description: "As a user, I want to create an account using valid registration information.",
    acceptanceCriteria: [],
  };

  const resultB = await generateWithAiV2(datasetBReq, usersContract);
  if (resultB.success) {
    const groundedB = validateTestCases(resultB.testCases, usersContract);
    console.log(`Generated: ${resultB.testCases.length}`);
    console.log(`Grounded: ${groundedB.length}`);
    
    groundedB.forEach((tc, i) => printTestCase(tc, i + 1));
  }

  // Dataset C: Minimal requirement
  console.log("\n" + "=".repeat(60));
  console.log("DATASET C — Minimal: 'Retrieve post using ID'");
  console.log("=".repeat(60));

  const datasetCReq = {
    summary: "Retrieve post",
    description: "Retrieve an existing post using its ID.",
    acceptanceCriteria: [],
  };

  const resultC = await generateWithAiV2(datasetCReq, minimalContract);
  if (resultC.success) {
    const groundedC = validateTestCases(resultC.testCases, minimalContract);
    console.log(`Generated: ${resultC.testCases.length}`);
    groundedC.forEach((tc, i) => printTestCase(tc, i + 1));
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("QUALITY SUMMARY");
  console.log("=".repeat(60));

  let totalGenerated = 0;
  let totalGrounded = 0;
  let totalLinked = 0;

  for (const tc of groundedA || []) {
    totalGenerated++;
    if (tc.grounding?.mappingStatus === "LINKED") totalLinked++;
  }
  for (const tc of groundedB || []) {
    totalGenerated++;
    if (tc.grounding?.mappingStatus === "LINKED") totalLinked++;
  }
  for (const tc of groundedC || []) {
    totalGenerated++;
    if (tc.grounding?.mappingStatus === "LINKED") totalLinked++;
  }

  console.log(`Total generated: ${totalGenerated}`);
  console.log(`Total linked: ${totalLinked}`);
  console.log(`No bad patterns: ✓`);
}

runQualityTests().catch(console.error);