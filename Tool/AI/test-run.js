// Quick test script for real API testing
// Run: cd Tool\AI && node test-run.js

const { parseContract } = require("./src/contracts/contractParser");
const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { executeRun } = require("./src/execution/executionEngine");

async function main() {
  // Create a simple contract using httpbin.org
  const contract = {
    type: "openapi",
    title: "HttpBin Test API",
    version: "1.0.0",
    baseUrl: "https://httpbin.org",
    endpoints: [
      {
        id: "post-endpoint",
        method: "POST",
        path: "/post",
        operationId: "testPost",
        summary: "Test POST endpoint",
        requestSchema: {
          type: "object",
          properties: {
            amount: { type: "number" },
            reason: { type: "string" }
          }
        }
      },
      {
        id: "get-endpoint",
        method: "GET",
        path: "/get",
        operationId: "testGet",
        summary: "Test GET endpoint"
      }
    ]
  };

  // Create a sample ticket
  const ticket = {
    key: "TEST-001",
    summary: "Test API validation",
    description: "Testing the validation tool with httpbin",
    acceptanceCriteria: [
      "API should accept POST requests with valid data",
      "Amount must be greater than zero",
      "Reason is mandatory for the request"
    ]
  };

  console.log("Generating scenarios...");
  const result = await generateScenarios({ ticket, contract });
  
  console.log(`Generated ${result.scenarios.length} scenarios:`);
  result.scenarios.forEach((s, i) => {
    console.log(`  ${i+1}. [${s.risk}] ${s.title}`);
  });

  console.log("\nExecuting with dry run first...");
  const dryRun = await executeRun({
    ticket,
    contract,
    scenarios: result.scenarios,
    environment: {
      name: "test",
      baseUrl: "https://httpbin.org",
      dryRun: true,
      auth: { type: "none" }
    }
  });

  console.log(`\nDry run complete: ${dryRun.summary.passed} passed, ${dryRun.summary.failed} failed, ${dryRun.summary.dry_run} dry_run`);

  console.log("\nNow testing real API calls (unchecking dry run)...");
  const realRun = await executeRun({
    ticket,
    contract,
    scenarios: result.scenarios.slice(0, 3), // Run first 3 for demo
    environment: {
      name: "httpbin-live",
      baseUrl: "https://httpbin.org",
      dryRun: false,
      auth: { type: "none" }
    }
  });

  console.log("\nReal execution results:");
  realRun.results.forEach(r => {
    console.log(`  ${r.title}: ${r.status} (${r.validation?.responseTimeMs || 'N/A'}ms)`);
  });

  console.log(`\nSummary: ${realRun.summary.passed} passed, ${realRun.summary.failed} failed, ${realRun.summary.blocked} blocked`);
}

main().catch(console.error);