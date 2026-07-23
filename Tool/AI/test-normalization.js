/**
 * STEP 9L.1 — Test Requirement Document Normalization
 */

const { normalizeRequirementDocument, logNormalizationDiagnostics } = require("./src/engine/requirementDocumentNormalizer");
const { extractRequirementsFromStatements } = require("./src/engine/requirementExtractor");
const { generateConditions } = require("./src/engine/testConditionEngine");

// Test Case: Posts API control (the 9th scenario issue)
const postsTicket = {
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

console.log("=== POSTS CONTROL TEST (9th SCENARIO FIX) ===\n");

// Step 1: Normalize the document
const document = normalizeRequirementDocument(postsTicket);
logNormalizationDiagnostics(postsTicket, document);

console.log("\n=== NORMALIZED STATEMENTS ===");
document.statements.forEach((s, i) => {
  console.log(`[${i+1}] ${s.sourceType} (index: ${s.sourceIndex})`);
  console.log(`    text: "${s.text.substring(0, 60)}..."`);
  if (s.duplicateOf) {
    console.log(`    DUPLICATE OF: ${s.duplicateOf}`);
  }
});

// Step 2: Extract requirements
const requirements = extractRequirementsFromStatements(document.statements, postsTicket);

console.log("\n=== REQUIREMENTS AFTER EXTRACTION ===");
console.log(`Total: ${requirements.length}`);
requirements.forEach((r, i) => {
  console.log(`[${i+1}] ${r.requirementType} (source: ${r.sourceType})`);
  console.log(`    subject: ${r.subject}`);
  console.log(`    acIndex: ${r.acIndex}`);
});

// Step 3: Generate conditions
const conditions = generateConditions(requirements, "STANDARD");

console.log("\n=== CONDITIONS AFTER GENERATION ===");
console.log(`Total: ${conditions.length}`);
conditions.forEach((c, i) => {
  console.log(`[${i+1}] ${c.category} | ${c.technique}`);
  console.log(`    requirementId: ${c.requirementId}`);
});

// Step 4: Count expected scenarios (1 condition = 1 test case in standard mode)
const scenarioCount = conditions.length;
console.log("\n=== SCENARIO COUNT ===");
console.log(`Generated conditions: ${scenarioCount}`);

// Before fix: would be 9 (description added extra)
// After fix: should be based on actual requirements
// Expected: 7 (4 ACs + 1 description, but description overlaps with ACs)

// Test Case 2: Description with unique business rule
const uniqueRuleTicket = {
  key: "UNIQUE-001",
  summary: "Posts API",
  description: "Validate creating, retrieving, listing and deleting posts. Only administrators may delete posts.",
  acceptanceCriteria: [
    "POST /posts creates a post.",
    "GET /posts/{postId} retrieves a post.",
    "GET /posts lists posts.",
    "DELETE /posts/{postId} deletes a post."
  ]
};

console.log("\n\n=== UNIQUE DESCRIPTION RULE TEST ===");

const uniqueDocument = normalizeRequirementDocument(uniqueRuleTicket);
logNormalizationDiagnostics(uniqueRuleTicket, uniqueDocument);

console.log("\n=== NORMALIZED STATEMENTS ===");
uniqueDocument.statements.forEach((s, i) => {
  console.log(`[${i+1}] ${s.sourceType} (index: ${s.sourceIndex})`);
  console.log(`    text: "${s.text.substring(0, 60)}..."`);
  if (s.duplicateOf) {
    console.log(`    DUPLICATE OF: ${s.duplicateOf}`);
  }
});

const uniqueRequirements = extractRequirementsFromStatements(uniqueDocument.statements, uniqueRuleTicket);

console.log("\n=== REQUIREMENTS ===");
console.log(`Total: ${uniqueRequirements.length}`);
uniqueRequirements.forEach((r, i) => {
  console.log(`[${i+1}] ${r.requirementType} (source: ${r.sourceType})`);
  console.log(`    subject: ${r.subject}`);
});

// Test Case 3: Description-only (no ACs)
const descriptionOnlyTicket = {
  key: "DESC-ONLY",
  summary: "User account validation",
  description: "Email is mandatory when creating an account. The email must use a valid format. Duplicate email addresses must not be accepted.",
  acceptanceCriteria: []
};

console.log("\n\n=== DESCRIPTION-ONLY TEST ===");

const descOnlyDocument = normalizeRequirementDocument(descriptionOnlyTicket);
logNormalizationDiagnostics(descriptionOnlyTicket, descOnlyDocument);

console.log("\n=== NORMALIZED STATEMENTS ===");
descOnlyDocument.statements.forEach((s, i) => {
  console.log(`[${i+1}] ${s.sourceType}`);
  console.log(`    text: "${s.text.substring(0, 60)}..."`);
});

const descOnlyRequirements = extractRequirementsFromStatements(descOnlyDocument.statements, descriptionOnlyTicket);

console.log("\n=== REQUIREMENTS ===");
console.log(`Total: ${descOnlyRequirements.length}`);
descOnlyRequirements.forEach((r, i) => {
  console.log(`[${i+1}] ${r.requirementType} (source: ${r.sourceType})`);
  console.log(`    subject: ${r.subject}`);
});