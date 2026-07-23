const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { parseContract } = require("./src/contracts/contractParser");

// Test 1: AUTH scenarios without auth endpoint - should remain unlinked
const ticket1 = {
  key: "AUTH-TEST",
  summary: "API with authentication tests",
  description: "Authentication required",
  acceptanceCriteria: [
    "Users can be created via POST /users",
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

// Test 2: Empty JSON body rejected - should match POST endpoint with body
const ticket2 = {
  key: "BODY-TEST",
  summary: "API with body validation tests",
  description: "Validate request body",
  acceptanceCriteria: [
    "Empty JSON body should be rejected",
    "Missing required fields should be rejected"
  ]
};

async function test() {
  console.log("=== TEST 1: AUTH SCENARIOS ===");
  const contract1 = parseContract(rawContract1);
  const result1 = await generateScenarios({ ticket: ticket1, contract: contract1 });
  
  console.log("Endpoints:", contract1.endpoints.map(e => `${e.method} ${e.path}`));
  console.log("\nScenarios:");
  result1.scenarios.forEach((s, i) => {
    console.log(`  [${i+1}] ${s.type.toUpperCase()}: ${s.title.substring(0,50)}...`);
    console.log(`       → ${s.endpointId ? s.method + ' ' + s.path : 'Unlinked'}`);
    console.log(`       Score: ${s.matchScore}, Confidence: ${s.matchConfidence}`);
    if (s.matchAmbiguous) console.log(`       Ambiguous: ${s.matchAmbiguous}`);
  });
  
  console.log("\n=== TEST 2: BODY VALIDATION SCENARIOS ===");
  const contract2 = parseContract(rawContract1);
  const result2 = await generateScenarios({ ticket: ticket2, contract: contract2 });
  
  result2.scenarios.forEach((s, i) => {
    console.log(`  [${i+1}] ${s.type.toUpperCase()}: ${s.title.substring(0,50)}...`);
    console.log(`       → ${s.endpointId ? s.method + ' ' + s.path : 'Unlinked'}`);
    console.log(`       Score: ${s.matchScore}, Confidence: ${s.matchConfidence}`);
    if (s.matchAmbiguous) console.log(`       Ambiguous: ${s.matchAmbiguous}`);
  });
  
  // Verify AUTH scenarios are correctly unlinked
  const authScenarios = result1.scenarios.filter(s => s.type === 'auth');
  console.log("\n=== VERIFICATION ===");
  console.log(`AUTH scenarios count: ${authScenarios.length}`);
  const authUnlinked = authScenarios.filter(s => s.unlinked);
  console.log(`AUTH unlinked (correct): ${authUnlinked.length}/${authScenarios.length}`);
}