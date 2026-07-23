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
console.log("Endpoints:");
contract.endpoints.forEach(ep => {
  console.log(`  ${ep.id}: ${ep.method} ${ep.path}`);
  console.log(`    operationId: ${ep.operationId}`);
  console.log(`    summary: ${ep.summary}`);
  console.log(`    requestSchema: ${ep.requestSchema ? 'exists' : 'null'}`);
});