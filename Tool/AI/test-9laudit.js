/**
 * STEP 9L — Audit Test Script
 * 
 * Tests all 5 input format cases and traces the complete requirement pipeline.
 */

const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { parseContract } = require("./src/contracts/contractParser");
const { extractRequirements, extractOperationContext, classifyRequirement, splitCompound, detectField } = require("./src/engine/requirementExtractor");
const { runPipeline } = require("./src/engine/orchestrator");
const { generateConditions } = require("./src/engine/testConditionEngine");
const { buildTestCases } = require("./src/engine/testDesignEngine");
const { deduplicate } = require("./src/engine/deduplicationEngine");

// Posts API contract
const postsContract = {
  openapi: "3.0.3",
  info: { title: "Posts API", version: "1.0.0" },
  paths: {
    "/posts": {
      post: {
        operationId: "createPost",
        summary: "Create a new post",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { title: { type: "string" }, body: { type: "string" }, userId: { type: "integer" } } } } }
        },
        responses: { "201": { description: "Created" } }
      },
      get: {
        operationId: "listPosts",
        summary: "List all posts",
        responses: { "200": { description: "Success" } }
      }
    },
    "/posts/{postId}": {
      get: {
        operationId: "getPost",
        summary: "Get post by ID",
        parameters: [{ name: "postId", in: "path" }],
        responses: { "200": { description: "Success" } }
      },
      delete: {
        operationId: "deletePost",
        summary: "Delete post",
        parameters: [{ name: "postId", in: "path" }],
        responses: { "204": { description: "No Content" } }
      }
    }
  }
};

const parsedContract = parseContract(postsContract);

// ============================================================================
// CASE DEFINITIONS
// ============================================================================

const cases = {
  CASE_1: {
    name: "CASE 1 — Explicit structured HTTP ACs",
    ticket: {
      key: "POSTS-001",
      summary: "Posts API CRUD operations",
      description: "Manage posts with create, read, delete operations",
      acceptanceCriteria: [
        "Given a valid post payload, when a POST request is sent to /posts, then the API should return 201 and the created post.",
        "Given postId 1, when a GET request is sent to /posts/{postId}, then the API should return the requested post.",
        "When a GET request is sent to /posts, then the API should return all posts.",
        "Given postId 1, when a DELETE request is sent to /posts/{postId}, then the API should delete the post."
      ]
    }
  },
  CASE_2: {
    name: "CASE 2 — Numbered natural-language requirements",
    ticket: {
      key: "POSTS-002",
      summary: "Posts API requirements",
      description: "Posts management feature",
      acceptanceCriteria: [
        "Users should be able to create a post with title, body and userId.",
        "Existing posts should be retrievable using their identifier.",
        "Users should be able to retrieve all posts.",
        "Existing posts should be deletable."
      ]
    }
  },
  CASE_3: {
    name: "CASE 3 — Plain prose, no AC formatting",
    ticket: {
      key: "POSTS-003",
      summary: "Posts API",
      description: "Users can create posts containing a title, body and user identifier. A newly created post should receive an identifier. Existing posts can be viewed individually. Users can also view all available posts. Existing posts can be removed when no longer needed."
    }
  },
  CASE_4: {
    name: "CASE 4 — Jira-style mixed description",
    ticket: {
      key: "POSTS-004",
      summary: "Posts API management",
      description: `As an API consumer,
I want to manage posts
so that application content can be maintained.

The service must support creating posts with title, body and userId.
Created posts should return an identifier.
Consumers need to retrieve a single existing post as well as all posts.
Posts that are no longer required should be removable.`
    }
  },
  CASE_5: {
    name: "CASE 5 — Business validation without HTTP terminology",
    ticket: {
      key: "USER-005",
      summary: "User account validation",
      description: "User account creation requirements",
      acceptanceCriteria: [
        "Email is mandatory when creating a user account.",
        "The email must use a valid format.",
        "Duplicate email addresses must not be accepted.",
        "Passwords must meet the configured security policy."
      ]
    }
  }
};

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function analyzeRequirementExtraction(ticket) {
  console.log("\n[=== REQUIREMENT EXTRACTION ANALYSIS ===]\n");
  
  const requirements = extractRequirements(ticket);
  
  console.log(`Total requirements extracted: ${requirements.length}\n`);
  
  requirements.forEach((req, i) => {
    console.log(`[${i + 1}] ${req.requirementType} (confidence: ${req.confidence})`);
    console.log(`    sourceType: ${req.sourceType}`);
    console.log(`    sourceText: "${req.sourceText}"`);
    console.log(`    subject: ${req.subject}`);
    console.log(`    methodHint: ${req.methodHint || 'none'}`);
    console.log(`    pathHint: ${req.pathHint || 'none'}`);
    console.log(`    constraint: ${JSON.stringify(req.constraint)}`);
    if (req.originalAc) {
      console.log(`    originalAc: "${req.originalAc.substring(0, 60)}..."`);
    }
    console.log();
  });
  
  return requirements;
}

function analyzePipeline(ticket, requirements) {
  console.log("[=== PIPELINE ANALYSIS ===]\n");
  
  const conditions = generateConditions(requirements, "STANDARD");
  console.log(`Conditions generated: ${conditions.length}\n`);
  
  conditions.forEach((cond, i) => {
    console.log(`[${i + 1}] ${cond.category} | ${cond.technique}`);
    console.log(`    requirementId: ${cond.requirementId}`);
    console.log(`    field: ${cond.field}`);
    console.log(`    methodHint: ${cond.methodHint || 'none'}`);
    console.log(`    pathHint: ${cond.pathHint || 'none'}`);
    console.log(`    description: "${cond.expectedBehaviorDescription.substring(0, 60)}..."`);
    console.log();
  });
  
  const testCases = buildTestCases(conditions, requirements, ticket.key, "STANDARD");
  console.log(`Test cases built: ${testCases.length}\n`);
  
  testCases.forEach((tc, i) => {
    console.log(`[${i + 1}] ${tc.classification.category} | ${tc.classification.origin}`);
    console.log(`    title: "${tc.title.substring(0, 60)}..."`);
    console.log(`    expectedMethod: ${tc.expectedMethod || 'none'}`);
    console.log(`    methodHint: ${tc.methodHint || 'none'}`);
    console.log(`    pathHint: ${tc.pathHint || 'none'}`);
    console.log(`    requirementIds: ${tc.traceability.requirementIds.join(", ")}`);
    console.log();
  });
  
  const { testCases: deduped, stats } = deduplicate(testCases);
  console.log(`After deduplication: ${deduped.length} (removed ${stats.duplicatesRemoved})\n`);
  
  return { conditions, testCases: deduped };
}

async function runCase(caseName, ticket) {
  console.log("\n" + "=".repeat(80));
  console.log(`\n${caseName}\n`);
  console.log("=".repeat(80));
  
  // Analyze extraction
  const requirements = analyzeRequirementExtraction(ticket);
  
  // Analyze pipeline stages
  const { conditions, testCases } = analyzePipeline(ticket, requirements);
  
  // Generate scenarios
  const result = await generateScenarios({ ticket, contract: parsedContract, useAi: false });
  
  console.log(`[=== SCENARIOS GENERATED ===]\n`);
  console.log(`Total scenarios: ${result.scenarios.length}\n`);
  
  result.scenarios.forEach((s, i) => {
    console.log(`[${i + 1}] ${s.type?.toUpperCase() || s.category?.toUpperCase()}`);
    console.log(`    title: "${s.title?.substring(0, 60)}..."`);
    console.log(`    endpoint: ${s.endpointId ? `${s.method} ${s.path}` : 'UNLINKED'}`);
    console.log(`    matchScore: ${s.matchScore || 'N/A'}`);
    console.log(`    matchConfidence: ${s.matchConfidence || 'N/A'}`);
    console.log(`    sourceAc: "${s.sourceAc?.substring(0, 40) || 'N/A'}..."`);
    console.log();
  });
  
  console.log(`[=== COVERAGE ===]\n`);
  console.log(`Linked: ${result.scenarios.filter(s => s.endpointId).length}`);
  console.log(`Unlinked: ${result.scenarios.filter(s => !s.endpointId).length}`);
  
  return { requirements, conditions, testCases, scenarios: result.scenarios };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("STEP 9L — REQUIREMENT INTELLIGENCE AUDIT");
  console.log("=".repeat(80));
  
  const results = {};
  
  for (const [key, caseDef] of Object.entries(cases)) {
    results[key] = await runCase(caseDef.name, caseDef.ticket);
  }
  
  // Summarise findings
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  
  for (const [key, result] of Object.entries(results)) {
    console.log(`\n${key}:`);
    console.log(`  Requirements: ${result.requirements.length}`);
    console.log(`  Conditions: ${result.conditions.length}`);
    console.log(`  Scenarios: ${result.scenarios.length}`);
    console.log(`  Linked/Unlinked: ${result.scenarios.filter(s => s.endpointId).length}/${result.scenarios.filter(s => !s.endpointId).length}`);
  }
  
  // Trace the 9th scenario specifically
  console.log("\n" + "=".repeat(80));
  console.log("NINTH SCENARIO ORIGINATION TRACE");
  console.log("=".repeat(80));
  
  const case1Scenarios = results.CASE_1.scenarios;
  if (case1Scenarios.length >= 9) {
    const ninthScenario = case1Scenarios[8];
    console.log(`\nScenario #9 exists in CASE_1 with ${case1Scenarios.length} total scenarios`);
    console.log("This would be an investigation point for the 9-scenario question.");
  } else {
    console.log(`\nCASE_1 has only ${case1Scenarios.length} scenarios - need to find where 9th scenario originates`);
  }
}

main().catch(console.error);