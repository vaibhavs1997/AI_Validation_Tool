const { buildIndex, retrieveCandidates } = require("./src/engine/matching/endpointIndex");
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

// Build the index
const fieldIndex = buildIndex(contract.endpoints, new Map());

console.log("=== FIELD INDEX ===");
console.log(`byMethod: ${JSON.stringify(Object.fromEntries([...fieldIndex.byMethod].map(([k,v]) => [k, v])))}`);

// Test retrieveCandidates
const intent = {
  methodHints: ["GET"],
  actionTerms: [],
  resourceTerms: ["user"],
  contextTerms: [],
};

const candidates = retrieveCandidates(intent, fieldIndex, { maxCandidates: 20 });
console.log(`\nCandidates for GET + user: ${JSON.stringify(candidates)}`);

const intent2 = {
  methodHints: ["POST"],
  actionTerms: [],
  resourceTerms: ["user"],
  contextTerms: [],
};

const candidates2 = retrieveCandidates(intent2, fieldIndex, { maxCandidates: 20 });
console.log(`Candidates for POST + user: ${JSON.stringify(candidates2)}`);