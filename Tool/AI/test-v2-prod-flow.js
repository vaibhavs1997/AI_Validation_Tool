/**
 * STEP 10.4 — V2 Production Flow Test
 */

const { generateScenariosV2 } = require("./src/engine/v2Production");
const { parseContract } = require("./src/contracts/contractParser");

const contractJson = {
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
                  title: { type: "string" },
                  body: { type: "string" },
                  userId: { type: "integer" },
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
  console.log("STEP 10.4 — V2 Production Flow Test");
  console.log("=".repeat(60));

  const ticket = {
    key: "PROD-TEST",
    summary: "Validate Posts API",
    description: "Validate JSONPlaceholder Posts API operations.",
    acceptanceCriteria: [
      "Given valid post info, when a new post is created, then HTTP 201.",
      "Given postId 1, when the user requests that post, then HTTP 200.",
    ],
  };

  const contract = parseContract(contractJson);
  const result = await generateScenariosV2({ ticket, contract });

  console.log(`\nMode: ${result.mode}`);
  console.log(`Scenarios: ${result.scenarios.length}`);
  console.log(`Model: ${result.generationMeta?.model}`);

  const aiV2Scenarios = result.scenarios.filter(s => s.generationMode === "ai_v2");
  const runnable = result.scenarios.filter(s => s.validationStatus === "VALID");

  console.log(`AI V2: ${aiV2Scenarios.length}`);
  console.log(`Runnable: ${runnable.length}`);

  result.scenarios.forEach((s, i) => {
    console.log(`\n[${i+1}] ${s.type}: ${s.title}`);
    console.log(`    Mode: ${s.generationMode}`);
    console.log(`    ${s.method} ${s.path}`);
    console.log(`    Status: ${s.validationStatus}`);
  });
}

main().catch(console.error);