const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { parseContract } = require("./src/contracts/contractParser");
const { groupByOperationContext } = require("./src/engine/matching/operationContextGrouper");

// Test 1: AUTH scenarios without auth endpoint - should remain unlinked
const ticket1 = {
  key: "TEST-001",
  summary: "User management API with authentication",
  description: "Authentication required",
  acceptanceCriteria: [
    "Users can be created via POST /users",
    "Users can be retrieved via GET /users/{userId}",
    "Authentication is required for all endpoints"
  ]
};

const rawContract1 = {
  openapi: "3.0.3",
  info: { title: "Test API", version: "1.0.0" },
  paths: {
    "/users": {
      post: {
        operationId: "createUser",
        summary: "Create user",
        description: "Creates user with email and password",
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
        description: "Retrieves user details",
        parameters: [{ name: "userId", in: "path" }],
        responses: { "200": { description: "Success" }, "401": { description: "Unauthorized" } }
      }
    }
  }
};

async function test() {
  console.log("=== SCENARIOS ===");
  const contract = parseContract(rawContract1);
  const result = await generateScenarios({ ticket: ticket1, contract });
  
  console.log("Endpoints:", contract.endpoints.map(e => `${e.method} ${e.path}`));
  
  // Debug: Check how scenarios are grouped
  const contexts = groupByOperationContext(result.scenarios || []);
  console.log("\n=== CONTEXTS ===");
  for (const ctx of contexts.values()) {
    console.log(`Context ${ctx.contextId}: ${ctx.testCaseIds.length} test cases`);
    console.log(`  Method hints: ${ctx.intent?.methodHints?.join(", ") || "none"}`);
    console.log(`  Auth intent: ${ctx.intent?.authIntent?.isAuthTest || false}`);
  }
  
  console.log("\n=== SCENARIOS WITH MATCHING ===");
  result.scenarios.forEach((s, i) => {
    console.log(`\n[${i+1}] ${s.type.toUpperCase()}: ${s.title.substring(0,50)}...`);
    console.log(`       expectedMethod: ${s.expectedMethod || "none"}`);
    console.log(`       mutations: ${JSON.stringify(s.mutations || [])}`);
    console.log(`       → ${s.endpointId ? s.method + ' ' + s.path : 'Unlinked'}`);
    console.log(`       Score: ${s.matchScore}, Confidence: ${s.matchConfidence}`);
    if (s.matchAmbiguous) console.log(`       Ambiguous: ${s.matchAmbiguous}`);
    if (s.unlinked) console.log(`       UNLINKED: true`);
  });
}