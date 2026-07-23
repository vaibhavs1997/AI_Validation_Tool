/**
 * STEP 11.2 — TEST CASE DEPTH AND QUALITY
 * 
 * Audits the V2 AI generation pipeline with a 10-AC Order Management dataset.
 * Classifies every generated test and reports BEFORE vs AFTER.
 * 
 * Usage: node step-11-2-test-depth.js
 */

const { generateWithAiV2 } = require("./src/engine/aiTestGeneratorV2");
const { validateTestCases } = require("./src/engine/deterministicGroundingV2");
const { parseContract } = require("./src/contracts/contractParser");

// ============================================================
// 10-AC ORDER MANAGEMENT DATASET
// ============================================================

const orderContractJson = {
  openapi: "3.0.0",
  info: { title: "Order Management API", version: "1.0.0" },
  servers: [{ url: "https://api.orders.example.com/v1" }],
  paths: {
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
                required: ["productId", "quantity", "customerEmail"],
                properties: {
                  productId: { type: "integer", minimum: 1, example: 42 },
                  quantity: { type: "integer", minimum: 1, maximum: 10, example: 2 },
                  customerEmail: { type: "string", format: "email", example: "customer@example.com" },
                  shippingAddress: { type: "string", maxLength: 200 },
                  notes: { type: "string", maxLength: 500 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Order created" },
          "400": { description: "Bad Request / Validation Error" },
          "401": { description: "Unauthorized" },
        },
      },
      get: {
        operationId: "listOrders",
        summary: "List all orders for the authenticated customer",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } },
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "shipped", "delivered", "cancelled"] } },
        ],
        responses: {
          "200": { description: "List of orders" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/orders/{orderId}": {
      get: {
        operationId: "getOrder",
        summary: "Get a single order by ID",
        parameters: [
          { name: "orderId", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
        ],
        responses: {
          "200": { description: "Order details" },
          "401": { description: "Unauthorized" },
          "404": { description: "Order not found" },
        },
      },
      delete: {
        operationId: "cancelOrder",
        summary: "Cancel an order",
        parameters: [
          { name: "orderId", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
        ],
        responses: {
          "200": { description: "Order cancelled" },
          "401": { description: "Unauthorized" },
          "404": { description: "Order not found" },
        },
      },
    },
    "/products/{productId}": {
      get: {
        operationId: "getProduct",
        summary: "Get product details",
        parameters: [
          { name: "productId", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
        ],
        responses: {
          "200": { description: "Product details" },
          "404": { description: "Product not found" },
        },
      },
    },
  },
};

const orderManagementTicket = {
  summary: "Order Management System",
  description: `As a customer, I need to place orders, view my order history, and manage existing orders.

Acceptance Criteria:
AC1: Given a valid order with productId, quantity, and customerEmail, when the order is created, then the API should return 201 and the created order details.
AC2: Given quantity must be greater than 0, when quantity is 0 or negative, then the API should reject the order.
AC3: Given quantity is limited to 10 per order, when quantity exceeds 10, then the API should reject the order.
AC4: Given customerEmail must be a valid email address, when an invalid email format is provided, then the API should reject the order.
AC5: Given a required field productId, when productId is missing, then the API should reject the order.
AC6: Given a required field quantity, when quantity is missing, then the API should reject the order.
AC7: Given a required field customerEmail, when customerEmail is missing, then the API should reject the order.
AC8: Given an existing order, when the order is retrieved by orderId, then the API should return the order with status 200.
AC9: Given an order that does not exist, when the order is retrieved by orderId, then the API should return 404.
AC10: Given a user is not authenticated, when any order API is called, then the API should return 401.`,
  acceptanceCriteria: [
    "AC1: Given a valid order with productId, quantity, and customerEmail, when the order is created, then the API should return 201 and the created order details.",
    "AC2: Given quantity must be greater than 0, when quantity is 0 or negative, then the API should reject the order.",
    "AC3: Given quantity is limited to 10 per order, when quantity exceeds 10, then the API should reject the order.",
    "AC4: Given customerEmail must be a valid email address, when an invalid email format is provided, then the API should reject the order.",
    "AC5: Given a required field productId, when productId is missing, then the API should reject the order.",
    "AC6: Given a required field quantity, when quantity is missing, then the API should reject the order.",
    "AC7: Given a required field customerEmail, when customerEmail is missing, then the API should reject the order.",
    "AC8: Given an existing order, when the order is retrieved by orderId, then the API should return the order with status 200.",
    "AC9: Given an order that does not exist, when the order is retrieved by orderId, then the API should return 404.",
    "AC10: Given a user is not authenticated, when any order API is called, then the API should return 401.",
  ],
};

// ============================================================
// CLASSIFICATION HELPER
// ============================================================

const CLASSIFICATION_TYPES = [
  "DIRECT_REQUIREMENT",
  "BOUNDARY",
  "SCHEMA_VALIDATION",
  "NEGATIVE",
  "SECURITY",
  "USEFUL_CONTRACT_INFERENCE",
];

function classifyTest(tc, acIndex) {
  const type = tc.type || "";
  const title = (tc.title || "").toLowerCase();
  const desc = (tc.description || "").toLowerCase();
  const evidence = (tc.evidence || []).join(" ").toLowerCase();
  const negKind = tc.negativeCondition?.kind || "";
  const negField = tc.negativeCondition?.field || "";

  // SECURITY: auth/unauthorized
  if (type === "AUTHORIZATION" || title.includes("unauthorized") || title.includes("unauthenticated") || title.includes("401") || title.includes("auth")) {
    return "SECURITY";
  }

  // NOT_FOUND: testing non-existent resource
  if (type === "NOT_FOUND" || title.includes("not found") || title.includes("does not exist") || title.includes("nonexistent")) {
    return "DIRECT_REQUIREMENT";
  }

  // BOUNDARY: min/max boundary values
  if (type === "BOUNDARY" || negKind === "OUT_OF_RANGE" || title.includes("boundary") || title.includes("minimum") || title.includes("maximum")) {
    return "BOUNDARY";
  }

  // SCHEMA_VALIDATION: format/type constraints from contract
  if (negKind === "INVALID_FORMAT" || title.includes("invalid email") || title.includes("format") || title.includes("schema") || title.includes("type") || evidence.includes("format") || evidence.includes("schema")) {
    return "SCHEMA_VALIDATION";
  }

  // NEGATIVE: missing required fields, contract violations
  if (type === "NEGATIVE" || negKind === "MISSING_REQUIRED_FIELD" || title.includes("missing") || title.includes("required") || title.includes("reject") || title.includes("invalid")) {
    return "NEGATIVE";
  }

  // USEFUL_CONTRACT_INFERENCE: derived from contract but not explicitly stated in AC
  if (evidence.includes("contract") || evidence.includes("schema") || evidence.includes("inference") || evidence.includes("parameter")) {
    return "USEFUL_CONTRACT_INFERENCE";
  }

  // DIRECT_REQUIREMENT: maps directly to an AC
  return "DIRECT_REQUIREMENT";
}

function printTestCase(tc, idx) {
  const classification = classifyTest(tc, tc.sourceAcIndex);
  console.log(`\n[${idx}] ${tc.type} | ${classification}`);
  console.log(`    Title: ${tc.title}`);
  console.log(`    AC Index: ${tc.sourceAcIndex !== undefined ? tc.sourceAcIndex : "N/A"}`);
  console.log(`    Origin: ${tc.testOrigin || "unknown"}`);
  console.log(`    Confidence: ${tc.confidence || "unknown"}`);
  console.log(`    Operation: ${tc.proposedOperation?.method || "?"} ${tc.proposedOperation?.path || "?"}`);
  if (tc.negativeCondition) {
    console.log(`    Negative: ${tc.negativeCondition.kind} (${tc.negativeCondition.field})`);
  }
  console.log(`    Evidence: ${tc.evidence?.join(", ") || "none"}`);
}

function buildReport(name, groundedTests, contract) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(` REPORT: ${name}`);
  console.log(`${"=".repeat(70)}`);

  const total = groundedTests.length;
  
  // Classify all tests
  const classified = groundedTests.map(tc => ({
    tc,
    classification: classifyTest(tc, tc.sourceAcIndex),
  }));

  // Stats by classification
  const byClassification = {};
  for (const { classification } of classified) {
    byClassification[classification] = (byClassification[classification] || 0) + 1;
  }

  // Stats by AC index
  const byAcIndex = {};
  for (const { tc } of classified) {
    const idx = tc.sourceAcIndex !== undefined ? tc.sourceAcIndex : -1;
    if (!byAcIndex[idx]) byAcIndex[idx] = [];
    byAcIndex[idx].push(tc);
  }

  // Stats by endpoint mapping
  const linked = groundedTests.filter(tc => tc.grounding?.mappingStatus === "LINKED").length;
  const unlinked = groundedTests.filter(tc => tc.grounding?.mappingStatus !== "LINKED").length;

  // Stats by type
  const byType = {};
  for (const tc of groundedTests) {
    byType[tc.type] = (byType[tc.type] || 0) + 1;
  }

  // Endpoints used
  const endpointsUsed = new Set();
  for (const tc of groundedTests) {
    if (tc.proposedOperation?.endpointId) {
      endpointsUsed.add(tc.proposedOperation.endpointId);
    }
    if (tc.grounding?.contractEndpointId) {
      endpointsUsed.add(tc.grounding.contractEndpointId);
    }
  }

  const contractEndpointIds = new Set((contract.endpoints || []).map(e => e.id));
  const unusedEndpoints = [...contractEndpointIds].filter(id => !endpointsUsed.has(id));

  // Check duplicates
  const signatures = new Set();
  const duplicates = [];
  for (const tc of groundedTests) {
    const sig = `${tc.proposedOperation?.method}|${tc.proposedOperation?.path}|${tc.type}|${tc.negativeCondition?.kind}|${tc.negativeCondition?.field}`;
    if (signatures.has(sig)) {
      duplicates.push(tc);
    }
    signatures.add(sig);
  }

  // Check for unrelated endpoint expansion
  const supportedEndpointIds = ["createOrder", "listOrders", "getOrder", "cancelOrder", "getProduct"];
  const unrelatedTests = groundedTests.filter(tc => {
    const eid = tc.proposedOperation?.endpointId || tc.grounding?.contractEndpointId;
    return eid && !supportedEndpointIds.includes(eid);
  });

  console.log(`\nTotal generated: ${total}`);
  console.log(`Linked: ${linked}`);
  console.log(`Unlinked: ${unlinked}`);
  console.log(`Duplicates: ${duplicates.length}`);
  console.log(`Unrelated endpoint tests: ${unrelatedTests.length}`);
  console.log(`\nBy Classification:`);
  for (const [cls, count] of Object.entries(byClassification).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cls}: ${count}`);
  }
  console.log(`\nBy Type:`);
  for (const [t, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${count}`);
  }
  console.log(`\nTests per AC:`);
  for (let i = 0; i < 10; i++) {
    const count = (byAcIndex[i] || []).length;
    const tests = (byAcIndex[i] || []).map(tc => `    [${tc.type}] ${tc.title}`).join("\n");
    console.log(`  AC${i+1}: ${count} test(s)`);
    if (tests) console.log(tests);
  }

  console.log(`\nUnassigned (no AC index): ${(byAcIndex[-1] || []).length}`);

  if (duplicates.length > 0) {
    console.log(`\nDuplicate tests:`);
    for (const d of duplicates) {
      console.log(`  [${d.type}] ${d.title} → ${d.proposedOperation?.method} ${d.proposedOperation?.path}`);
    }
  }

  if (unrelatedTests.length > 0) {
    console.log(`\nUnrelated endpoint tests:`);
    for (const u of unrelatedTests) {
      console.log(`  [${u.type}] ${u.title} → ${u.proposedOperation?.method} ${u.proposedOperation?.path}`);
    }
  }

  if (unusedEndpoints.length > 0) {
    console.log(`\nUnused endpoints in contract: ${unusedEndpoints.join(", ")}`);
  }

  console.log(`\nEndpoint mapping accuracy: ${linked}/${total} (${((linked/total)*100).toFixed(1)}%)`);
  
  return {
    total,
    linked,
    unlinked,
    duplicates: duplicates.length,
    unrelated: unrelatedTests.length,
    byClassification,
    byType,
    byAcIndex: Object.fromEntries(
      Object.entries(byAcIndex).map(([k, v]) => [k, v.length])
    ),
    unusedEndpoints,
    endpointAccuracy: linked / total,
  };
}

async function runTest(name, label) {
  console.log(`\n${"#".repeat(70)}`);
  console.log(`# ${label}`);
  console.log(`# ${name}`);
  console.log(`${"#".repeat(70)}`);

  const contract = parseContract(orderContractJson);
  
  const result = await generateWithAiV2(orderManagementTicket, contract);
  
  if (!result.success) {
    console.log(`\nAI generation failed: ${result.reason}`);
    return null;
  }

  const grounded = validateTestCases(result.testCases, contract);
  
  // Print each test case
  console.log(`\n--- GENERATED TEST CASES (${grounded.length}) ---`);
  grounded.forEach((tc, i) => printTestCase(tc, i + 1));

  // Build report
  return buildReport(name, grounded, contract);
}

async function main() {
  console.log("=".repeat(70));
  console.log("STEP 11.2 — TEST CASE DEPTH AND QUALITY");
  console.log("10-AC ORDER MANAGEMENT DATASET");
  console.log("=".repeat(70));

  console.log(`\nContract parsed: ${parseContract(orderContractJson).endpoints.length} endpoints`);
  console.log(`Acceptance Criteria: ${orderManagementTicket.acceptanceCriteria.length}`);

  const beforeReport = await runTest(
    "BEFORE — Current V2 Prompt",
    "BEFORE: Current aiTestGeneratorV2.js prompt"
  );

  if (!beforeReport) {
    console.log("\nBEFORE test failed. Is the AI/API key configured?");
    console.log("Check .env file for OPENAI_API_KEY configuration.");
    return;
  }

  console.log(`\n${"#".repeat(70)}`);
  console.log(`# BEFORE REPORT SUMMARY`);
  console.log(`${"#".repeat(70)}`);
  console.log(`Total tests: ${beforeReport.total}`);
  console.log(`Linked: ${beforeReport.linked}`);
  console.log(`Unlinked: ${beforeReport.unlinked}`);
  console.log(`Duplicates: ${beforeReport.duplicates}`);
  console.log(`Unrelated endpoint tests: ${beforeReport.unrelated}`);
  console.log(`\nBy Classification: ${JSON.stringify(beforeReport.byClassification)}`);
  console.log(`By Type: ${JSON.stringify(beforeReport.byType)}`);
  console.log(`Tests per AC: ${JSON.stringify(beforeReport.byAcIndex)}`);
  
  // Detect issues
  const issues = [];
  
  // Check if some ACs produce 0 tests
  for (let i = 0; i < 10; i++) {
    const count = beforeReport.byAcIndex[i] || 0;
    if (count === 0) issues.push(`AC${i+1} produced 0 tests`);
    if (count === 1) issues.push(`AC${i+1} produced only 1 test (may collapse multiple conditions)`);
  }

  // Check if boundary/type tests are collapsed
  if (beforeReport.byClassification["BOUNDARY"] === undefined || beforeReport.byClassification["BOUNDARY"] < 2) {
    issues.push("Boundary tests may be collapsed instead of separate (quantity=0, quantity=-1)");
  }
  
  // Check AC2 (quantity > 0) should produce at least 2 tests (quantity=0 boundary, quantity=-1 below-boundary)
  const ac2Count = beforeReport.byAcIndex[1] || 0;
  if (ac2Count < 2) {
    issues.push(`AC2 (quantity > 0) produced only ${ac2Count} tests, expected ≥2 (quantity=0, quantity=-1)`);
  }

  // AC3 (quantity max 10) should have boundary test
  const ac3Count = beforeReport.byAcIndex[2] || 0;
  if (ac3Count < 1) issues.push(`AC3 (quantity max 10) produced 0 tests`);

  // AC4 (invalid email) should have schema validation test
  const ac4Count = beforeReport.byAcIndex[3] || 0;
  if (ac4Count < 1) issues.push(`AC4 (invalid email format) produced 0 tests`);

  // AC10 (auth) should have security test
  const ac10Count = beforeReport.byAcIndex[9] || 0;
  if (ac10Count < 1) issues.push(`AC10 (auth/401) produced 0 tests`);

  if (issues.length > 0) {
    console.log(`\n--- ISSUES DETECTED ---`);
    for (const issue of issues) {
      console.log(`  ✗ ${issue}`);
    }
  } else {
    console.log(`\n--- NO ISSUES DETECTED ---`);
  }

  // Save for comparison
  global.__beforeReport = beforeReport;
  global.__issues = issues;
  console.log(`\n${"=".repeat(70)}`);
  console.log("BEFORE phase complete. If prompt change is needed, edit the AI_V2_PROMPT in aiTestGeneratorV2.js and re-run.");
  console.log(`${"=".repeat(70)}`);
}

main().catch(console.error);