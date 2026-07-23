const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { parseContract } = require("./src/contracts/contractParser");

// Simulate a ticket that would trigger AUTH scenarios and check matching
const ticket = {
  key: "TEST-001",
  summary: "User management API with authentication",
  description: "User registration and authentication API",
  acceptanceCriteria: [
    "Users can be created via POST /users",
    "Users can be retrieved via GET /users/{userId}",
    "Authentication is required for all endpoints"
  ]
};

const rawContract = {
  openapi: "3.0.3",
  info: { title: "Test API", version: "1.0.0" },
  paths: {
    "/users": {
      post: {
        operationId: "createUser",
        summary: "Create a new user",
        description: "Creates user with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" }
                }
              }
            }
          }
        },
        responses: { "200": { description: "Success" }, "400": { description: "Bad Request" } }
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
  },
  components: { schemas: {} }
};

async function test() {
  const contract = parseContract(rawContract);
  console.log("Contract endpoints:", contract.endpoints.map(e => `${e.method} ${e.path}`));
  
  const result = await generateScenarios({ ticket, contract });
  
  console.log("\n=== SCENARIOS ===");
  result.scenarios.forEach((s, i) => {
    console.log(`\n[${i+1}] ${s.title.substring(0,80)}`);
    console.log(`    Type: ${s.type}, Risk: ${s.risk}`);
    console.log(`    Endpoint: ${s.endpointId ? s.method + ' ' + s.path : 'Unlinked'}`);
    console.log(`    Match Score: ${s.matchScore || 0}, Confidence: ${s.matchConfidence || 'none'}`);
    if (s.matchReasons?.length) console.log(`    Reasons: ${s.matchReasons.join(', ')}`);
    if (s.unlinked) console.log(`    UNLINKED: true`);
  });
  
  const authScenarios = result.scenarios.filter(s => s.type === 'auth');
  console.log("\n=== AUTH SCENARIOS ===");
  console.log(`Count: ${authScenarios.length}`);
  authScenarios.forEach(s => {
    console.log(`  - ${s.title.substring(0,60)} → ${s.endpointId ? s.method + ' ' + s.path : 'Unlinked'}`);
  });
  
  const unlinked = result.scenarios.filter(s => s.unlinked);
  console.log("\n=== UNLINKED SCENARIOS ===");
  console.log(`Count: ${unlinked.length}`);
  if (unlinked.length === 0) {
    console.log("None - all scenarios were matched");
  }
}

test().catch(console.error);