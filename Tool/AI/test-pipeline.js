const { runPipeline } = require("./src/engine/orchestrator");

// Test with User Account AC sample
const ticket = {
  key: "TEST-001",
  summary: "User management API",
  description: "Manage user accounts with create, read, delete operations",
  acceptanceCriteria: [
    "Given an existing user ID, When a GET request is sent to /users/{userId}, Then the API should return the requested user",
    "POST /users creates a new user",
    "DELETE /users/{userId} removes a user"
  ]
};

console.log("=== ORCHESTRATOR OUTPUT ===\n");

const result = runPipeline(ticket, "STANDARD");

console.log("Keys in result:", Object.keys(result));
console.log("\nSummary:", JSON.stringify(result.summary, null, 2));

console.log("\n\n=== REQUIREMENTS ===");
result.requirements.forEach((req, i) => {
  console.log(`\n[${i+1}] ${req.requirementId}`);
  console.log(`    Type: ${req.requirementType}`);
  console.log(`    Subject: ${req.subject}`);
  console.log(`    Source: ${req.sourceType}`);
  console.log(`    Text: ${(req.sourceText || "").substring(0, 60)}...`);
});

console.log("\n\n=== TEST CASES ===");
result.testCases.forEach((tc, i) => {
  console.log(`\n[${i+1}] ${tc.testCaseId}`);
  console.log(`    Title: ${tc.title?.substring(0, 60)}`);
  console.log(`    Category: ${tc.classification?.category}`);
  console.log(`    Origin: ${tc.classification?.origin}`);
  console.log(`    Priority: ${tc.priority}`);
  console.log(`    Mutation: ${tc.request?.mutation?.operation || 'none'}`);
});

console.log("\n\n=== GAPS ===");
(result.requirementGaps || []).forEach((gap, i) => {
  console.log(`\n[${i+1}] ${gap.gapId}`);
  console.log(`    Type: ${gap.gapType}`);
  console.log(`    Suggestion: ${gap.suggestion}`);
});