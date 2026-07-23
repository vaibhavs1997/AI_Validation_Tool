/**
 * STEP 9L.2C-3 Ambiguity and Quality Tests
 */

const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { parseContract } = require("./src/contracts/contractParser");

// Ambiguity contract: two POST endpoints with no distinguishing features
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

const ambiguityRequirement = {
  key: "AMB-TEST-001",
  summary: "Create a record",
  description: "The system should create a new record successfully.",
  acceptanceCriteria: [],
};

// Schema-resolved contract
const schemaResolvedContractJson = {
  openapi: "3.0.0",
  info: { title: "Posts API", version: "1.0.0" },
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
                  email: { type: "string", format: "email" },
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

const schemaResolvedRequirement = {
  key: "SCHEMA-TEST-001",
  summary: "Create a user",
  description: "A new user should be created using their name and email.",
  acceptanceCriteria: [],
};

async function runAmbiguityTest() {
  console.log("\n" + "=".repeat(60));
  console.log("EXPECTED: AMBIGUOUS (no distinguishing evidence)");
  console.log("REQUIREMENT: 'The system should create a new record successfully.'");
  console.log("CONTRACT: POST /users, POST /orders (no schema)");
  console.log("=".repeat(60));

  const contract = parseContract(ambiguityContractJson);
  const result = await generateScenarios({ ticket: ambiguityRequirement, contract });

  console.log(`\nMode: ${result.mode}`);
  console.log(`Scenarios: ${result.scenarios.length}`);

  // Check if any scenario has an endpoint linked
  const linked = result.scenarios.filter((s) => s.endpointId);
  const unlinked = result.scenarios.filter((s) => !s.endpointId);

  console.log(`Linked: ${linked.length}`);
  console.log(`Unlinked: ${unlinked.length}`);

  if (unlinked.length > 0) {
    console.log("\nAMBIGUITY HANDLED CORRECTLY - scenarios unlinked");
    unlinked.forEach((s) => {
      console.log(`  [UNLINKED] ${s.title}`);
      console.log(`  Candidates: ${s.endpointCandidates?.length || 0}`);
      if (s.endpointCandidates) {
        s.endpointCandidates.forEach((c) => {
          console.log(`    - ${c.method} ${c.path}`);
        });
      }
    });
  } else {
    console.log("\nISSUE: AI arbitrarily linked to an endpoint without evidence");
  }
}

async function runSchemaResolvedTest() {
  console.log("\n" + "=".repeat(60));
  console.log("EXPECTED: LINKED (schema distinguishes 'name' and 'email')");
  console.log("REQUIREMENT: 'A new user should be created using their name and email.'");
  console.log("=".repeat(60));

  const contract = parseContract(schemaResolvedContractJson);
  const result = await generateScenarios({ ticket: schemaResolvedRequirement, contract });

  console.log(`\nMode: ${result.mode}`);
  console.log(`Scenarios: ${result.scenarios.length}`);

  const linked = result.scenarios.filter((s) => s.endpointId);
  console.log(`Linked: ${linked.length}`);

  linked.forEach((s) => {
    console.log(`  [LINKED] ${s.endpointId} (${s.method} ${s.path})`);
    console.log(`  Title: ${s.title}`);
    console.log(`  Evidence: ${s.endpointMatchEvidence?.join(", ") || "none"}`);
  });
}

async function main() {
  console.log("STEP 9L.2C-3 Ambiguity & Quality Tests");
  console.log("======================================\n");

  await runAmbiguityTest();
  await runSchemaResolvedTest();
}

main().catch(console.error);