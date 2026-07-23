/**
 * STEP 10.7 — Production Regression Tests
 */

const { generateScenariosV2 } = require("./src/engine/v2Production");
const { parseContract } = require("./src/contracts/contractParser");

const postsContractJson = {
  openapi: "3.0.0",
  info: { title: "Posts API", version: "1.0.0" },
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
        responses: { "201": { description: "Created" } },
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

function checkNoBadPatterns(scenarios) {
  const bad = scenarios.filter(s =>
    s.title.includes("Business rule") ||
    s.title.includes("Acceptance Criteria") ||
    s.title.includes("should be enforced")
  );
  return bad.length === 0;
}

function checkNoDuplicates(scenarios) {
  const keys = scenarios.map(s => 
    `${s.method} ${s.path} ${s.type} ${s.negativeCondition?.kind || ""}`
  );
  return new Set(keys).size === keys.length;
}

function checkEndpointValidity(scenarios, contract) {
  const validEndpoints = new Set(
    (contract.endpoints || []).map(e => `${e.method} ${e.path}`)
  );
  return scenarios.every(s => validEndpoints.has(`${s.method} ${s.path}`));
}

function checkGenerationMode(scenarios) {
  return scenarios.every(s => s.generationMode === "ai_v2");
}

async function runTests() {
  console.log("STEP 10.7 — Production Regression Tests");
  console.log("=".repeat(60));

  const contract = parseContract(postsContractJson);

  let allPassed = true;

  // Test A: Multiple explicit ACs
  console.log("\nA. Multiple Explicit ACs");
  const ticketA = {
    key: "REGRESSION-A",
    summary: "Posts API",
    description: "Validate posts operations.",
    acceptanceCriteria: [
      "Given valid post info, when a new post is created, then HTTP 201.",
      "Given postId 1, when the user requests that post, then HTTP 200.",
      "When the user requests all posts, then HTTP 200.",
      "Given postId 1, when the user removes that post, then HTTP 200.",
    ],
  };

  const resultA = await generateScenariosV2({ ticket: ticketA, contract });
  console.log(`  Mode: ${resultA.mode}`);
  console.log(`  Count: ${resultA.scenarios?.length || 0}`);
  console.log(`  ✓ Mode is ai_v2: ${resultA.mode === "ai_v2"}`);
  console.log(`  ✓ No bad patterns: ${resultA.scenarios ? checkNoBadPatterns(resultA.scenarios) : false}`);
  console.log(`  ✓ No duplicates: ${resultA.scenarios ? checkNoDuplicates(resultA.scenarios) : false}`);
  console.log(`  ✓ Valid endpoints: ${resultA.scenarios ? checkEndpointValidity(resultA.scenarios, contract) : false}`);
  allPassed = allPassed && resultA.mode === "ai_v2";

  // Test B: Description-only
  console.log("\nB. Description-only Requirement");
  const ticketB = {
    key: "REGRESSION-B",
    summary: "Retrieve post",
    description: "As a user, I want to retrieve an existing post using its ID so that I can view its details.",
    acceptanceCriteria: [],
  };

  const resultB = await generateScenariosV2({ ticket: ticketB, contract });
  const getById = resultB.scenarios?.filter(s => 
    s.method === "GET" && s.path === "/posts/{postId}"
  ).length || 0;
  console.log(`  Mode: ${resultB.mode}`);
  console.log(`  GET /posts/{postId} scenarios: ${getById}`);
  console.log(`  ✓ Focuses on GET /posts/{postId}: ${getById > 0}`);
  allPassed = allPassed && getById > 0;

  // Test C: Schema-driven negatives
  console.log("\nC. Schema-driven Negatives");
  const negCount = resultA.scenarios?.filter(s => s.type === "validation" || s.type === "negative").length || 0;
  console.log(`  Negative/validation scenarios: ${negCount}`);
  console.log(`  ✓ Schema-driven tests generated: ${negCount > 0}`);
  allPassed = allPassed && negCount > 0;

  // Test D: Ambiguous requirement
  console.log("\nD. Ambiguous Requirement");
  const ticketD = {
    key: "REGRESSION-D",
    summary: "User login",
    description: "Users can login.",
    acceptanceCriteria: [],
  };

  const resultD = await generateScenariosV2({ ticket: ticketD, contract });
  const unlinked = resultD.scenarios?.filter(s => s.grounding?.mappingStatus !== "LINKED").length || 0;
  console.log(`  Mode: ${resultD.mode}`);
  console.log(`  Unlinked/ambiguous: ${unlinked}`);
  console.log(`  ✓ Cannot force unsupported endpoints: ${unlinked > 0 || resultD.scenarios?.length === 0}`);
  allPassed = allPassed && (unlinked > 0 || resultD.scenarios?.length === 0);

  // Test E: Hallucinated endpoint protection
  console.log("\nE. Hallucinated Endpoint Protection");
  const hasInvalidEndpoint = resultD.scenarios?.some(s => 
    s.validationStatus === "VALID" && !s.endpointId
  );
  console.log(`  Invalid executable endpoints: ${hasInvalidEndpoint ? "YES (BUG!)" : "NO"}`);
  allPassed = allPassed && !hasInvalidEndpoint;

  // Invariant summary
  console.log("\n" + "=".repeat(60));
  console.log("INVARIANT SUMMARY");
  console.log("=".repeat(60));
  const allScenarios = [...(resultA.scenarios || []), ...(resultB.scenarios || [])];
  console.log(`generationMode === "ai_v2": ${checkGenerationMode(allScenarios)}`);
  console.log(`No generic titles: ${checkNoBadPatterns(allScenarios)}`);
  console.log(`No duplicates: ${checkNoDuplicates(allScenarios)}`);
  console.log(`All endpoints valid: ${checkEndpointValidity(allScenarios, contract)}`);

  console.log("\n" + "=".repeat(60));
  console.log(`OVERALL: ${allPassed ? "PASS" : "FAIL"}`);
}