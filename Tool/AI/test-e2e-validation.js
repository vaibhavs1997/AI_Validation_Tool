/**
 * STEP 9M — CONTROLLED END-TO-END VALIDATION
 * 
 * Programmatic validation of the complete flow.
 */

const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { parseContract } = require("./src/contracts/contractParser");

// JSONPlaceholder Posts API Contract
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
        summary: "Get all posts",
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

// Test Input A: Explicit ACs
const explicitAcInput = {
  key: "VALIDATION-001",
  summary: "Validate JSONPlaceholder Posts API",
  description: "Validate the JSONPlaceholder Posts API operations for creating, retrieving, listing, and deleting posts.",
  acceptanceCriteria: [
    "Given a valid post payload containing title, body, and userId, When a POST request is sent to /posts, Then the post should be created successfully with HTTP status 201, And the response should contain id, title, body, and userId.",
    "Given an existing postId of 1, When a GET request is sent to /posts/{postId}, Then the requested post should be returned successfully with HTTP status 200, And the response should contain id, title, body, and userId.",
    "When a GET request is sent to /posts, Then the API should return HTTP status 200, And the response should contain a list of posts.",
    "Given an existing postId of 1, When a DELETE request is sent to /posts/{postId}, Then the API should return HTTP status 200.",
  ],
};

// Test Input B: Natural Jira-style Description
const naturalLanguageInput = {
  key: "VALIDATION-002",
  summary: "Post review functionality",
  description: "As a content administrator, I need to retrieve post details using the post identifier so that I can review a post before making changes. When an existing post is requested, the API should return the post successfully. The returned data should include the post identifier, title, content, and owning user. If the requested post does not exist, the API should return an appropriate not-found response.",
  acceptanceCriteria: [],
};

// Test Input C: Ambiguity
const ambiguityContractJson = {
  openapi: "3.0.0",
  info: { title: "Ambiguous API", version: "1.0.0" },
  servers: [{ url: "https://example.com" }],
  paths: {
    "/users": {
      post: {
        operationId: "createUser",
        summary: "Create a new user",
        responses: { "201": { description: "Created" } },
      },
    },
    "/orders": {
      post: {
        operationId: "createOrder",
        summary: "Create a new order",
        responses: { "201": { description: "Created" } },
      },
    },
  },
};

const ambiguityInput = {
  key: "VALIDATION-003",
  summary: "Create a record",
  description: "The system should create a new record successfully.",
  acceptanceCriteria: [],
};

// Test Input D: Schema-Resolved
const schemaResolvedContractJson = {
  openapi: "3.0.0",
  info: { title: "User/Order API", version: "1.0.0" },
  servers: [{ url: "https://example.com" }],
  paths: {
    "/users": {
      post: {
        operationId: "createUser",
        summary: "Create a new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" } },
      },
    },
    "/orders": {
      post: {
        operationId: "createOrder",
        summary: "Create a new order",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["productId", "quantity"],
                properties: {
                  productId: { type: "integer" },
                  quantity: { type: "integer" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" } },
      },
    },
  },
};

const schemaResolvedInput = {
  key: "VALIDATION-004",
  summary: "Create a user",
  description: "A new user should be created using their name and email.",
  acceptanceCriteria: [],
};

function printScenarioTable(scenarios, title) {
  console.log(`\n${title}`);
  console.log("-".repeat(80));
  console.log("ID | Type | Endpoint | Path | Status | Origin | Validation");
  console.log("-".repeat(80));

  for (const s of scenarios) {
    const id = s.id.slice(0, 15);
    const type = s.type;
    const ep = s.endpointId ? s.endpointId.slice(0, 8) : "UNLINKED";
    const path = s.path || "/";
    const status = s.expectedStatus || "?";
    const origin = s.testOrigin || "?";
    const val = s.validationStatus || "VALID";

    console.log(`${id} | ${type} | ${ep} | ${path} | ${status} | ${origin} | ${val}`);
  }
}

function printGenerationMeta(result) {
  const meta = result.generationMeta || {};
  console.log(`\nGeneration Metadata:`);
  console.log(`  Mode: ${meta.mode || "unknown"}`);
  console.log(`  Model: ${meta.model || "unknown"}`);
  console.log(`  Fallback Reason: ${meta.fallbackReason || "none"}`);
  console.log(`  Warnings: ${meta.warnings?.length || 0}`);
}

async function runTest(name, input, contractJson) {
  const contract = parseContract(contractJson);
  const result = await generateScenarios({ ticket: input, contract });

  console.log(`\n${"=".repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log(`${"=".repeat(60)}`);

  printGenerationMeta(result);
  
  const total = result.scenarios.length;
  const linked = result.scenarios.filter((s) => s.endpointId).length;
  const unlinked = total - linked;
  const valid = result.scenarios.filter((s) => s.validationStatus === "VALID").length;
  const withWarnings = result.scenarios.filter((s) => s.validationStatus === "VALID_WITH_WARNINGS").length;

  printScenarioTable(result.scenarios, "Generated Scenarios");

  console.log(`\nSummary: ${total} scenarios (${linked} linked, ${unlinked} unlinked, ${valid} valid, ${withWarnings} warnings)`);

  return result;
}

async function main() {
  console.log("STEP 9M — CONTROLLED E2E VALIDATION");
  console.log("===================================");

  // Test A: Explicit ACs
  const resultA = await runTest("Input A - Explicit ACs", explicitAcInput, postsContractJson);

  // Test B: Natural Language
  const resultB = await runTest("Input B - Natural Language", naturalLanguageInput, postsContractJson);

  // Test C: Ambiguity
  const resultC = await runTest("Input C - Ambiguity Safety", ambiguityInput, ambiguityContractJson);

  // Test D: Schema-Resolved
  const resultD = await runTest("Input D - Schema Resolved", schemaResolvedInput, schemaResolvedContractJson);

  // Final Verification
  console.log(`\n${"=".repeat(60)}`);
  console.log("VERIFICATION RESULTS");
  console.log(`${"=".repeat(60)}`);

  // Check AI Primary
  const aiPrimary = resultA.generationMeta?.mode === "ai_primary";
  console.log(`\n1. AI Primary Mode: ${aiPrimary ? "PASS" : "FAIL"}`);

  // Check Endpoint Distribution
  const postEndpoints = resultA.scenarios.filter((s) => s.endpointId === "5ab6c9135c").length;
  const getOneEndpoints = resultA.scenarios.filter((s) => s.endpointId === "699bfd6db0").length;
  const getListEndpoints = resultA.scenarios.filter((s) => s.endpointId === "3e18a397c0").length;
  const deleteEndpoints = resultA.scenarios.filter((s) => s.endpointId === "00c524cd6e").length;
  console.log(`2. Correct Endpoint Mapping: POST=${postEndpoints}, GET_ID=${getOneEndpoints}, GET_LIST=${getListEndpoints}, DELETE=${deleteEndpoints}`);

  // Check Ambiguity
  const ambiguityUnlinked = resultC.scenarios.filter((s) => !s.endpointId).length;
  console.log(`3. Ambiguity Safety: ${ambiguityUnlinked > 0 ? "PASS" : "FAIL"} (${ambiguityUnlinked} unlinked)`);

  // Check Natural Language
  const nlLinked = resultB.scenarios.filter((s) => s.endpointId === "699bfd6db0").length;
  console.log(`4. Natural Language Mapping: ${nlLinked > 0 ? "PASS" : "FAIL"}`);

  // Check Schema Resolved
  const srLinked = resultD.scenarios.filter((s) => s.endpointId && s.endpointId.includes("createUser")).length;
  console.log(`5. Schema Resolution: ${srLinked > 0 ? "PASS" : "FAIL"}`);
}