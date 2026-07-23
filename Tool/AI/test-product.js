const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { parseContract } = require("./src/contracts/contractParser");

// Test with Product Catalog AC sample (different from User Account)
const ticket = {
  key: "TEST-002",
  summary: "Product Catalog API",
  description: "Manage product inventory with pricing and stock levels",
  acceptanceCriteria: [
    "Products with price greater than zero should be accepted",
    "Stock quantity must be a positive integer between 0 and 100",
    "GET /products returns list of available products"
  ]
};

const rawContract = {
  openapi: "3.0.3",
  info: { title: "Product API", version: "1.0.0" },
  paths: {
    "/products": {
      get: {
        operationId: "listProducts",
        summary: "List all products",
        responses: { "200": { description: "Success" } }
      },
      post: {
        operationId: "createProduct",
        summary: "Create product",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, price: { type: "number" }, stock: { type: "integer" } } } } }
        },
        responses: { "200": { description: "Success" }, "201": { description: "Created" } }
      }
    },
    "/products/{productId}": {
      get: {
        operationId: "getProduct",
        summary: "Get product by ID",
        parameters: [{ name: "productId", in: "path" }],
        responses: { "200": { description: "Success" } }
      }
    }
  }
};

async function test() {
  const contract = parseContract(rawContract);
  
  console.log("=== PRODUCT CATALOG SCENARIOS (Different Requirement) ===\n");
  
  const result = await generateScenarios({ ticket, contract, useAi: false });
  
  console.log(`Mode: ${result.mode}`);
  console.log(`Scenarios: ${result.scenarios.length}\n`);
  
  result.scenarios.forEach((s, i) => {
    console.log(`[${i+1}] ${s.type.toUpperCase()}: ${s.title?.substring(0, 60)}...`);
    console.log(`    Endpoint: ${s.endpointId ? `${s.method} ${s.path}` : 'Unlinked'}`);
    console.log(`    Match Score: ${s.matchScore || 'N/A'}, Confidence: ${s.matchConfidence}`);
    console.log(`    Source AC: ${s.sourceAc?.substring(0, 40) || 'N/A'}...`);
    if (s.mutations?.length > 0) {
      console.log(`    Mutations: ${s.mutations.map(m => m.operation).join(", ")}`);
    }
    console.log();
  });
  
  console.log(`=== UNUSED ENDPOINTS: ${result.unusedEndpoints?.length || 0} ===`);
}

test().catch(console.error);