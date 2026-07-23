/**
 * STEP 9L.2C-1 AI Feasibility Spike
 * 
 * This script compares AI-generated test cases against deterministic pipeline output.
 */

const { parseContract } = require("./src/contracts/contractParser");
const { generateTestCasesWithAi, validateAiOutput } = require("./src/engine/aiTester");
const { runPipeline } = require("./src/engine/orchestrator");

// Mock JSONPlaceholder Posts API Contract
const postsContractJson = {
  openapi: "3.0.0",
  info: { title: "JSONPlaceholder Posts API", version: "1.0.0" },
  servers: [{ url: "https://jsonplaceholder.typicode.com" }],
  paths: {
    "/posts": {
      post: {
        operationId: "createPost",
        summary: "Create a new post",
        description: "Creates a new post and returns the created post with an ID",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "body", "userId"],
                properties: {
                  title: { type: "string" },
                  body: { type: "string" },
                  userId: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created - returns the new post with ID" },
          "400": { description: "Bad Request - invalid data" },
        },
      },
      get: {
        operationId: "getPosts",
        summary: "Get all posts",
        description: "Returns a list of all posts",
        responses: {
          "200": { description: "OK - returns array of posts" },
        },
      },
    },
    "/posts/{postId}": {
      get: {
        operationId: "getPost",
        summary: "Get a single post by ID",
        description: "Returns a single post with the specified ID",
        parameters: [
          { name: "postId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "OK - returns the post" },
          "404": { description: "Not Found - post does not exist" },
        },
      },
      delete: {
        operationId: "deletePost",
        summary: "Delete a post",
        description: "Deletes a post and returns success response",
        parameters: [
          { name: "postId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "OK - success response" },
        },
      },
    },
  },
};

// Test Data
const controlRequirement = {
  key: "AI-TEST-001",
  summary: "Validate JSONPlaceholder Posts API operations",
  description: "Users should be able to create posts, retrieve individual posts, list posts, and delete posts.",
  acceptanceCriteria: [
    "Given a valid post payload containing title, body, and userId, When a POST request is sent to /posts, Then the post should be created successfully with HTTP status 201, And the response should contain id, title, body, and userId.",
    "Given an existing postId of 1, When a GET request is sent to /posts/{postId}, Then the requested post should be returned successfully with HTTP status 200, And the response should contain id, title, body, and userId.",
    "When a GET request is sent to /posts, Then the API should return HTTP status 200, And the response should contain a list of posts.",
    "Given an existing postId of 1, When a DELETE request is sent to /posts/{postId}, Then the API should return HTTP status 200.",
  ],
};

const naturalLanguageRequirement = {
  key: "AI-TEST-002",
  summary: "View post details",
  description: "Users should be able to view a specific post using its identifier. If the post exists, its details should be returned successfully. The returned data should include the post identifier, title, content, and owning user.",
  acceptanceCriteria: [],
};

const schemaDrivenRequirement = {
  key: "AI-TEST-003",
  summary: "Create a post with valid information",
  description: "A user should be able to create a post with valid post information.",
  acceptanceCriteria: [
    "Title must be provided and cannot be empty.",
    "Body must contain the post content.",
    "UserId identifies the post owner.",
  ],
};

const ambiguityRequirement = {
  key: "AI-TEST-004",
  summary: "General record creation",
  description: "The system should create a new record successfully.",
  acceptanceCriteria: [],
};

const jiraDescriptionOnlyRequirement = {
  key: "AI-TEST-005",
  summary: "Post review functionality",
  description: "As a content administrator, I need to retrieve post details by identifier so that I can review the post before making changes. The page should show the post title, content and owning user. If the requested post cannot be found, the API should return an appropriate not-found response.",
  acceptanceCriteria: [],
};

// Test Runner
async function runTest(name, requirement) {
  console.log("\n" + "=".repeat(60));
  console.log("TEST: " + name);
  console.log("=".repeat(60) + "\n");

  // 1. Deterministic Pipeline
  console.log("Running deterministic pipeline...");
  const detResult = runPipeline(requirement, "STANDARD");
  console.log("Deterministic: " + detResult.testCases.length + " test cases");
  
  detResult.testCases.forEach((tc, i) => {
    console.log("  [" + (i + 1) + "] " + tc.classification.category + " - " + tc.title.slice(0, 60) + "...");
  });

  // 2. AI Generation
  console.log("\nChecking AI configuration...");
  const contract = parseContract(postsContractJson);
  const aiResult = await generateTestCasesWithAi({ requirement, contract });
  
  if (!aiResult.success) {
    console.log("AI failed: " + aiResult.reason);
    return { deterministic: detResult, ai: aiResult };
  }

  console.log("\nAI generated: " + aiResult.testCases.length + " test cases");
  
  // 3. Validate AI output
  const validated = validateAiOutput(aiResult.testCases, contract);
  
  validated.forEach((tc, i) => {
    console.log("  [" + (i + 1) + "] " + tc.category + " - " + (tc.title || "").slice(0, 50) + "...");
    console.log("       Endpoint: " + (tc.endpointMatch && tc.endpointMatch.endpointId ? tc.endpointMatch.endpointId : "NULL") + " (" + (tc.endpointMatch && tc.endpointMatch.confidence ? tc.endpointMatch.confidence : "LOW") + ")");
    if (tc.validationStatus !== "ACCEPTED") {
      console.log("       REJECTED: " + ((tc.validationIssues || []).join(", ")));
    }
  });

  const acceptedCount = validated.filter((tc) => tc.validationStatus === "ACCEPTED").length;
  const rejectedCount = validated.filter((tc) => tc.validationStatus === "REJECTED").length;
  const nullCount = validated.filter((tc) => !(tc.endpointMatch && tc.endpointMatch.endpointId)).length;

  console.log("\nAI Validation Summary: " + acceptedCount + " accepted, " + rejectedCount + " rejected, " + nullCount + " unlinked");

  return { deterministic: detResult, ai: aiResult, validated };
}

// Main
async function main() {
  console.log("STEP 9L.2C-1 AI Feasibility Spike");
  console.log("===================================\n");

  // Check if AI is configured
  const config = require("./src/config");
  console.log("AI Config Check:");
  console.log("  - API Key: " + (config.ai.apiKey ? "SET" : "NOT SET"));
  console.log("  - Base URL: " + (config.ai.baseUrl || "NOT SET"));
  console.log("  - Model: " + (config.ai.model || "NOT SET"));

  // Run all tests
  const results = {};

  results.control = await runTest("Control - Explicit API ACs", controlRequirement);
  results.naturalLanguage = await runTest("Natural Language", naturalLanguageRequirement);
  results.schemaDriven = await runTest("Schema-Driven", schemaDrivenRequirement);
  results.ambiguity = await runTest("Ambiguity Test", ambiguityRequirement);
  results.jiraDescription = await runTest("Jira Description-Only", jiraDescriptionOnlyRequirement);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  Object.entries(results).forEach(([name, result]) => {
    const detCount = result.deterministic && result.deterministic.testCases ? result.deterministic.testCases.length : 0;
    const aiCount = result.validated ? result.validated.length : 0;
    const accepted = result.validated ? result.validated.filter(function(t) { return t.validationStatus === "ACCEPTED"; }).length : 0;
    const rejected = result.validated ? result.validated.filter(function(t) { return t.validationStatus === "REJECTED"; }).length : 0;
    
    console.log("\n" + name + ":");
    console.log("  Deterministic: " + detCount + " scenarios");
    console.log("  AI: " + aiCount + " scenarios (" + accepted + " valid, " + rejected + " rejected)");
    if (result.ai && result.ai.success === false) {
      console.log("  AI Status: " + result.ai.reason);
    }
  });

  console.log("\n" + "=".repeat(60));
  console.log("Report saved. See STEP_9L_2C_1_AI_FEASIBILITY_REPORT.md for details.");
}

main().catch(console.error);