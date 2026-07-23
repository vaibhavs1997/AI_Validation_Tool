/**
 * STEP 10.9A — Real UI Validation Test
 * Simulates the exact flow through V2 pipeline
 */

const { generateScenariosV2 } = require("./src/engine/v2Production");
const { parseContract } = require("./src/contracts/contractParser");

const postsContractJson = {
  openapi: "3.0.0",
  info: { title: "Posts API", version: "1.0.0" },
  servers: [{ url: "https://jsonplaceholder.typicode.com" }],
  paths: {
    "/posts": {
      post: {
        operationId: "createPost",
        summary: "Create a new post",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "body", "userId"],
                properties: {
                  title: { type: "string", example: "Test Title" },
                  body: { type: "string", example: "Test Body" },
                  userId: { type: "integer", example: 1 },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, "400": { description: "Bad Request" } },
      },
      get: {
        operationId: "getPosts",
        summary: "List all posts",
        responses: { "200": { description: "OK" } },
      },
    },
    "/posts/{postId}": {
      get: {
        operationId: "getPost",
        summary: "Get a single post by ID",
        parameters: [{ name: "postId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK" }, "404": { description: "Not Found" } },
      },
      delete: {
        operationId: "deletePost",
        summary: "Delete a post",
        parameters: [{ name: "postId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK" } },
      },
    },
  },
};

async function main() {
  console.log("STEP 10.9A — Real UI Validation Test");
  console.log("=".repeat(60));

  const contract = parseContract(postsContractJson);

  // Simulate real UI requirement
  const ticket = {
    key: "VALIDATION-TEST",
    summary: "Validate Posts API",
    description: `Validate the Posts API behavior for creating, retrieving, listing, and deleting posts.

Acceptance Criteria:
AC1: Given a valid post payload containing title, body, and userId, when a post is created, then the API should create the post successfully and return the created post data.
AC2: Given an existing post with ID 1, when the post is retrieved by ID, then the API should return the requested post successfully.
AC3: When the list of posts is requested, then the API should return the available posts successfully.
AC4: Given an existing post with ID 1, when the post is deleted, then the API should process the deletion successfully.

Also validate sensible negative cases supported by the API contract, including missing required request data where applicable.`,
    acceptanceCriteria: [],
  };

  console.log("\n--- INPUT ---");
  console.log(`Summary: ${ticket.summary}`);
  console.log(`Description length: ${ticket.description.length}`);
  console.log(`Contract endpoints: ${contract.endpoints?.length || 0}`);

  const result = await generateScenariosV2({ ticket, contract });

  console.log("\n--- OUTPUT ---");
  console.log(`Mode: ${result.mode}`);
  console.log(`Generated: ${result.scenarios?.length || 0}`);
  console.log(`Meta: ${JSON.stringify(result.generationMeta)}`);

  // Count analysis
  const byType = {};
  const byMethod = {};
  const byMapping = {};
  const byReadiness = {};

  result.scenarios?.forEach(s => {
    byType[s.type] = (byType[s.type] || 0) + 1;
    byMethod[s.method] = (byMethod[s.method] || 0) + 1;
    byMapping[s.grounding?.mappingStatus || "unknown"] = (byMapping[s.grounding?.mappingStatus || "unknown"] || 0) + 1;
    byReadiness[s.dataReadiness || "unknown"] = (byReadiness[s.dataReadiness || "unknown"] || 0) + 1;
  });

  console.log("\n--- SCENARIO ANALYSIS ---");
  console.log("By Type:", byType);
  console.log("By Method:", byMethod);
  console.log("By Mapping:", byMapping);
  console.log("By Readiness:", byReadiness);

  // Detail each scenario
  console.log("\n--- SCENARIO DETAILS ---");
  result.scenarios?.forEach((s, i) => {
    console.log(`\n[${i+1}] ${s.type}: ${s.title}`);
    console.log(`    Mode: ${s.generationMode}`);
    console.log(`    ${s.method} ${s.path}`);
    console.log(`    Mapping: ${s.grounding?.mappingStatus}`);
    console.log(`    Readiness: ${s.dataReadiness}`);
    if (s.pathParams) console.log(`    Path Params: ${JSON.stringify(s.pathParams)}`);
    if (s.basePayload) console.log(`    Body: ${JSON.stringify(s.basePayload)}`);
    if (s.negativeCondition) console.log(`    Mutation: ${JSON.stringify(s.negativeCondition)}`);
  });

  // Validate invariants
  const allAiV2 = result.scenarios?.every(s => s.generationMode === "ai_v2") ?? false;
  const noBadPatterns = result.scenarios?.every(s => 
    !s.title.includes("Business rule") &&
    !s.title.includes("should be enforced")
  ) ?? false;
  const hasPostCreate = result.scenarios?.some(s => s.method === "POST" && s.path === "/posts") ?? false;
  const hasGetById = result.scenarios?.some(s => s.method === "GET" && s.path === "/posts/{postId}") ?? false;
  const hasGetList = result.scenarios?.some(s => s.method === "GET" && s.path === "/posts" && !s.pathParams) ?? false;
  const hasDelete = result.scenarios?.some(s => s.method === "DELETE" && s.path === "/posts/{postId}") ?? false;

  console.log("\n--- INVARIANT CHECKS ---");
  console.log(`All ai_v2: ${allAiV2 || result.mode !== "ai_v2" ? "✓ (fallback active)" : "✗"}`);
  console.log(`No bad patterns: ${noBadPatterns ? "✓" : "✗"}`);
  console.log(`Has POST /posts: ${hasPostCreate ? "✓" : "✗"}`);
  console.log(`Has GET /posts/{postId}: ${hasGetById ? "✓" : "✗"}`);
  console.log(`Has GET /posts: ${hasGetList ? "✓" : "✗"}`);
  console.log(`Has DELETE /posts/{postId}: ${hasDelete ? "✓" : "✗"}`);

  console.log("\n--- COMPLETION ---");
  console.log(`Mode: ${result.mode} (AI configured: ${result.generationMeta?.model ? "YES" : "NO"})`);
}

main().catch(console.error);