const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { parseContract } = require("./src/contracts/contractParser");
const { groupByOperationContext } = require("./src/engine/matching/operationContextGrouper");

// Simple test case to understand the structure
const ticket = {
  key: "TEST-001",
  summary: "User management API",
  description: "User API",
  acceptanceCriteria: [
    "Users can be created via POST /users",
    "Users can be retrieved via GET /users/{userId}"
  ]
};

const rawContract = {
  openapi: "3.0.3",
  info: { title: "Test API", version: "1.0.0" },
  paths: {
    "/users": {
      post: {
        operationId: "createUser",
        summary: "Create user",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" } } } } }
        },
        responses: { "200": { description: "Success" } }
      }
    },
    "/users/{userId}": {
      get: {
        operationId: "getUser",
        summary: "Get user by ID",
        parameters: [{ name: "userId", in: "path" }],
        responses: { "200": { description: "Success" } }
      }
    }
  }
};

async function test() {
  const contract = parseContract(rawContract);
  const result = await generateScenarios({ ticket, contract });
  
  // Debug: Check test case structure
  console.log("=== TEST CASES ===");
  for (const tc of result.scenarios || []) {
    console.log(`TC ID: ${tc.id}`);
    console.log(`  type: ${tc.type}`);
    console.log(`  matchScore: ${tc.matchScore}`);
    console.log(`  unlinked: ${tc.unlinked}`);
  }
}

test().catch(console.error);