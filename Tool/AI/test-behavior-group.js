/**
 * Test BehaviorGroup parsing
 */

const { parseClauses, extractBehaviorGroups, isAssertionClause } = require("./src/engine/behaviorGroup");

const testCases = [
  // AC1 - Multi-clause with Gherkin
  "Given a valid post payload containing title, body, and userId, When a POST request is sent to /posts, Then the post should be created successfully with HTTP status 201, And the response should contain id, title, body, and userId.",
  // AC2 - Multi-clause with explicit endpoint
  "Given an existing postId of 1, When a GET request is sent to /posts/{postId}, Then the requested post should be returned successfully with HTTP status 200, And the response should contain id, title, body, and userId.",
  // AC3 - Multi-line style
  `When a GET request is sent to /posts,
Then the API should return HTTP status 200,
And the response should contain a list of posts.`,
  // AC4 - Single-line clean
  "Given an existing postId of 1, When a DELETE request is sent to /posts/{postId}, Then the API should return HTTP status 200.",
  // Plain requirement
  "Email is mandatory when creating an account.",
  // Constraint-only
  "Only administrators may delete posts.",
];

console.log("==============================================\n");
console.log("BEHAVIOR GROUP PARSING TEST\n");

testCases.forEach((text, i) => {
  console.log(`\n--- Test ${i+1} ---`);
  console.log(`Input: ${text.substring(0, 60)}...`);
  
  const result = parseClauses(text);
  console.log(`\nPreconditions (${result.preconditions.length}):`);
  result.preconditions.forEach((p, idx) => {
    console.log(`  [${idx+1}] ${p.text?.substring(0, 40)}`);
  });
  
  console.log(`\nAction:`);
  if (result.action) {
    console.log(`  text: ${result.action.text?.substring(0, 40)}`);
    console.log(`  methodHint: ${result.action.methodHint}`);
    console.log(`  pathHint: ${result.action.pathHint}`);
  }
  
  console.log(`\nExpectations (${result.expectations.length}):`);
  result.expectations.forEach((e, idx) => {
    console.log(`  [${idx+1}] ${e.text?.substring(0, 40)}`);
    console.log(`       isAssertion: ${isAssertionClause(e.text)}`);
  });
});

console.log("\n==============================================");