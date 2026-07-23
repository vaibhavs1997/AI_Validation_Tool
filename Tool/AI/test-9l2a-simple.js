const { generateScenarios } = require("./src/scenarios/scenarioGenerator");

// Posts control contract
const postsContract = {
  title: "Posts API",
  endpoints: [
    { id: "post-POST", method: "POST", path: "/posts", operationId: "createPost", summary: "Create a new post" },
    { id: "get-posts", method: "GET", path: "/posts", operationId: "listPosts", summary: "Get all posts" },
    { id: "get-post", method: "GET", path: "/posts/{postId}", operationId: "getPost", summary: "Get a post by ID" },
    { id: "del-post", method: "DELETE", path: "/posts/{postId}", operationId: "deletePost", summary: "Delete a post" },
  ]
};

// Test case: 4 explicit ACs
const case1 = {
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

console.log("====== Testing generateScenarios ======");
const result = generateScenarios({ ticket: case1, contract: postsContract });
console.log("Result:", typeof result, result === null ? "null" : result === undefined ? "undefined" : "object");
console.log("Keys:", result ? Object.keys(result) : "N/A");
console.log("Scenarios:", result && result.scenarios ? result.scenarios.length : "N/A");
if (result && result.scenarios) {
  console.log("\nScenario details:");
  result.scenarios.forEach((s, i) => {
    console.log(`[${i+1}] id=${s.id}, type=${s.type}, acIndex=${s.acIndex}, endpoint=${s.endpointId || 'UNLINKED'}`);
  });
} else {
  console.log("FULL RESULT:", JSON.stringify(result, null, 2));
}