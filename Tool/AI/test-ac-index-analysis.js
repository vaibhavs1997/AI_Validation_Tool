/**
 * Analyze why acIndex=0 scenarios are not appearing
 */

const { normalizeRequirementDocument } = require("./src/engine/requirementDocumentNormalizer");
const { extractRequirementsFromStatements } = require("./src/engine/requirementExtractor");
const { generateConditions } = require("./src/engine/testConditionEngine");
const { buildTestCases } = require("./src/engine/testDesignEngine");
const { deduplicate } = require("./src/engine/deduplicationEngine");

const ticket = {
  key: "POSTS-001",
  summary: "Posts API CRUD operations",
  description: "Manage posts with create, read, delete operations",
  acceptanceCriteria: [
    "Given a valid post payload, when a POST request is sent to /posts, then the API should return 201 and the created post.",
    "Given postId 1, when a GET request is sent to /posts/{postId}, then the API should return the requested post.",
    "When a GET request is sent to /posts, then the API should return all posts.",
    "Given postId 1, when a DELETE request is sent to /posts/{postId}, then the API should delete the post."
  ]
};

console.log("=== STEP-BY-STEP ANALYSIS ===\n");

// Step 1: Normalize
const document = normalizeRequirementDocument(ticket);
console.log("Statements:");
document.statements.forEach((s, i) => {
  console.log(`  [${i}] ${s.sourceType} acIndex=${s.sourceIndex} text="${s.text.substring(0, 50)}..."`);
});

// Step 2: Extract requirements
const requirements = extractRequirementsFromStatements(document.statements, ticket);
console.log("\nRequirements:");
requirements.forEach((r, i) => {
  console.log(`  [${i}] ${r.requirementId}: ${r.requirementType}, acIndex=${r.acIndex}, subject=${r.subject}`);
});

// Step 3: Generate conditions
const conditions = generateConditions(requirements, "STANDARD");
console.log("\nConditions:");
conditions.forEach((c, i) => {
  console.log(`  [${i}] ${c.conditionId}: ${c.category}, reqId=${c.requirementId}, acIndex=${c.acIndex}`);
});

// Step 4: Build test cases
const testCases = buildTestCases(conditions, requirements, ticket.key, "STANDARD");
console.log("\nTest cases before dedup:");
testCases.forEach((tc, i) => {
  console.log(`  [${i}] ${tc.testCaseId}: ${tc.classification.category}, acIndex=${tc.traceability.acIndex}, reqIds=${tc.traceability.requirementIds}`);
});

// Step 5: Dedup
const { testCases: deduped } = deduplicate(testCases);
console.log("\nTest cases after dedup:");
deduped.forEach((tc, i) => {
  console.log(`  [${i}] ${tc.testCaseId}: ${tc.classification.category}, acIndex=${tc.traceability.acIndex}`);
});

// Check what happened to acIndex=0
console.log("\n=== AC INDEX 0 ANALYSIS ===");
const tc0 = testCases.find(tc => tc.traceability.acIndex === 0);
const tc0After = deduped.find(tc => tc.traceability.acIndex === 0);
console.log(`Test case with acIndex=0 before dedup: ${tc0 ? tc0.testCaseId : 'NOT FOUND'}`);
console.log(`Test case with acIndex=0 after dedup: ${tc0After ? tc0After.testCaseId : 'NOT FOUND'}`);

if (tc0 && !tc0After) {
  console.log("AC INDEX 0 WAS DEDUPED!");
  console.log("Checking for duplicates...");
  testCases.forEach((tc, i) => {
    console.log(`  ${tc.testCaseId}: ${tc.classification.category}, ${tc.classification.technique}, acIndex=${tc.traceability.acIndex}`);
  });
}