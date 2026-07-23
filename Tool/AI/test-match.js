const { matchTestCases } = require("./src/engine/matching/matchingEngine");
const { parseContract } = require("./src/contracts/contractParser");

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

const contract = parseContract(rawContract);

// Create test cases manually
const testCases = [
  {
    id: "TC-001",
    title: "Verify: Users can be created via POST /users — should succeed",
    type: "positive",
    expectedMethod: "POST",
    traceability: {
      requirementIds: ["TEST-001"],
      sourceText: "Users can be created via POST /users",
    }
  },
  {
    id: "TC-002",
    title: "Verify: Users can be retrieved via GET /users/{userId} — should succeed",
    type: "positive",
    expectedMethod: "GET",
    traceability: {
      requirementIds: ["TEST-001"],
      sourceText: "Users can be retrieved via GET /users/{userId}",
    }
  }
];

console.log("Endpoints:", contract.endpoints.map(e => `${e.id}: ${e.method} ${e.path}`));

const { results, scenarioAssignments } = matchTestCases(testCases, contract.endpoints);

console.log("\n=== RESULTS ===");
results.forEach(r => {
  console.log(`Context: ${r.contextId}`);
  console.log(`  Confidence: ${r.confidence}`);
  console.log(`  Needs review: ${r.needsHumanReview}`);
  console.log(`  Resolved endpoint: ${r.resolvedEndpointId || 'unlinked'}`);
  console.log(`  Review reasons: ${r.reviewReasons?.join(", ") || 'none'}`);
});

console.log("\n=== SCENARIO ASSIGNMENTS ===");
for (const [tcId, assignment] of scenarioAssignments) {
  console.log(`${tcId}: ${assignment.endpointId || 'unlinked'} (${assignment.confidenceLevel})`);
}