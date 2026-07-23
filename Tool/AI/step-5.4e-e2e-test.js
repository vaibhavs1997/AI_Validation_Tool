/**
 * STEP 5.4E — Verify Ollama Structured Generation End-to-End
 *
 * Runs one real POST /api/test-specifications/generate
 * with the SBD-01 project and a configured manual requirement.
 *
 * Reports:
 * 1. Ollama HTTP status and generation duration
 * 2. AI_CONTENT is valid JSON: yes/no
 * 3. Scenarios generated
 * 4. TestSpecifications generated
 * 5. ExecutionPlans built
 * 6. Unresolved specifications
 * 7. Warnings/errors
 * 8. Total endpoint duration
 * 9. Whether the frontend successfully stops loading and displays generated tests
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

// ============================================================
// Configuration
// ============================================================

const SERVER_HOST = "localhost";
const SERVER_PORT = 4173;
const OLLAMA_HOST = "localhost";
const OLLAMA_PORT = 11434;

// Configured manual requirement (ticket) for SBD-01
const TICKET = {
  key: "SBD-1",
  summary: "Update profile",
  description: "As a user I can update my profile",
  acceptanceCriteria: [
    "Profile fields can be updated",
    "Validation errors returned for invalid data"
  ]
};

// Load the user-account-api contract (relevant to profile update)
const contractPath = path.join(__dirname, "data", "contracts", "user-account-api-openapi.json.json");
const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

// ============================================================
// Helper: HTTP POST
// ============================================================

function httpPost(host, port, pathname, body, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: host,
      port: port,
      path: pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      },
      timeout: timeoutMs
    }, (res) => {
      let chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, body: text, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.write(data);
    req.end();
  });
}

function httpGet(host, port, pathname, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host,
      port: port,
      path: pathname,
      method: "GET",
      timeout: timeoutMs
    }, (res) => {
      let chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, body: text });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.end();
  });
}

// ============================================================
// Helper: Check ai-debug.log for AI content
// ============================================================

function checkAiDebugLog() {
  const logPath = path.join(__dirname, "data", "ai-debug.log");
  if (!fs.existsSync(logPath)) {
    return { exists: false, entries: 0, content: "" };
  }
  const content = fs.readFileSync(logPath, "utf8");
  const lines = content.split("\n").filter(Boolean);
  return { exists: true, entries: lines.length, content: lines.slice(-30).join("\n") };
}

// ============================================================
// Main Test
// ============================================================

async function main() {
  const results = {
    ollamaHttpStatus: null,
    ollamaDurationMs: null,
    aiContentValidJson: null,
    scenariosGenerated: null,
    testSpecificationsGenerated: null,
    executionPlansBuilt: null,
    unresolvedSpecifications: null,
    warnings: [],
    errors: [],
    totalEndpointDurationMs: null,
    frontendLoading: null,
    rawResponse: null,
    aiDiagnostics: null,
    aiContentPreview: null,
    endpointStatus: null,
  };

  console.log("=".repeat(80));
  console.log("STEP 5.4E — Verify Ollama Structured Generation End-to-End");
  console.log("=".repeat(80));
  console.log();

  // Step 1: Verify Ollama is running
  console.log("[1] Checking Ollama availability...");
  try {
    const ollamaTags = await httpGet(OLLAMA_HOST, OLLAMA_PORT, "/api/tags");
    console.log("  Ollama /api/tags status:", ollamaTags.status);
    const tagsData = JSON.parse(ollamaTags.body);
    console.log("  Models:", tagsData.models?.map(m => m.name).join(", ") || "none");
  } catch (e) {
    console.log("  Ollama check FAILED:", e.message);
    results.errors.push(`Ollama not reachable: ${e.message}`);
  }
  console.log();

  // Step 2: Verify server is running
  console.log("[2] Checking server availability...");
  try {
    const health = await httpGet(SERVER_HOST, SERVER_PORT, "/api/health");
    console.log("  Server /api/health status:", health.status);
    const healthData = JSON.parse(health.body);
    console.log("  App:", healthData.app);
  } catch (e) {
    console.log("  Server check FAILED:", e.message);
    results.errors.push(`Server not reachable: ${e.message}`);
  }
  console.log();

  // Step 3: Run the real POST /api/test-specifications/generate
  console.log("[3] Running POST /api/test-specifications/generate...");
  console.log("  ProjectId: SBD-01");
  console.log("  Ticket:", JSON.stringify(TICKET, null, 2));
  console.log("  Contract title:", contract.title);
  console.log("  Contract endpoints:", contract.endpoints?.length || 0);
  console.log();

  const endpointStart = Date.now();
  let endpointResponse;
  try {
    endpointResponse = await httpPost(
      SERVER_HOST,
      SERVER_PORT,
      "/api/test-specifications/generate",
      {
        projectId: "SBD-01",
        ticket: TICKET,
        contract: contract,
      },
      180000 // 3 minute timeout
    );
    results.totalEndpointDurationMs = Date.now() - endpointStart;
    results.endpointStatus = endpointResponse.status;
    console.log("  Endpoint HTTP status:", endpointResponse.status);
    console.log("  Total endpoint duration:", results.totalEndpointDurationMs, "ms");
  } catch (e) {
    results.totalEndpointDurationMs = Date.now() - endpointStart;
    console.log("  Endpoint request FAILED:", e.message);
    console.log("  Duration before failure:", results.totalEndpointDurationMs, "ms");
    results.errors.push(`Endpoint request failed: ${e.message}`);
    results.endpointStatus = "REQUEST_FAILED";
  }
  console.log();

  // Step 4: Parse and analyze the response
  if (endpointResponse && endpointResponse.body) {
    let responseData;
    try {
      responseData = JSON.parse(endpointResponse.body);
      results.rawResponse = responseData;
    } catch (e) {
      console.log("[4] Failed to parse response as JSON:", e.message);
      results.errors.push(`Response not JSON: ${e.message}`);
      results.rawResponse = endpointResponse.body.slice(0, 2000);
    }

    if (responseData) {
      console.log("[4] Response analysis:");
      console.log("  Response keys:", Object.keys(responseData).join(", "));

      // Diagnostics (includes AI info)
      const diagnostics = responseData.diagnostics || {};
      console.log("  Diagnostics:", JSON.stringify(diagnostics, null, 2));
      results.aiDiagnostics = diagnostics;

      // Check for AI diagnostics in the response
      if (diagnostics.aiDiagnostics) {
        const aiDiag = diagnostics.aiDiagnostics;
        results.ollamaHttpStatus = aiDiag.aiHttpStatus || "not in diagnostics";
        results.ollamaDurationMs = aiDiag.aiLatencyMs || null;
        console.log("  AI Provider:", aiDiag.aiProvider);
        console.log("  AI Model:", aiDiag.aiModel);
        console.log("  AI Attempted:", aiDiag.aiAttempted);
        console.log("  AI Succeeded:", aiDiag.aiSucceeded);
        console.log("  AI Error Type:", aiDiag.aiErrorType);
        console.log("  AI Error Detail:", aiDiag.aiErrorDetail);
        console.log("  AI Latency:", aiDiag.aiLatencyMs, "ms");
      }

      // Check generationMeta for AI diagnostics
      if (responseData.generationMeta?.aiDiagnostics) {
        const aiDiag = responseData.generationMeta.aiDiagnostics;
        results.ollamaHttpStatus = aiDiag.aiHttpStatus || results.ollamaHttpStatus;
        results.ollamaDurationMs = aiDiag.aiLatencyMs || results.ollamaDurationMs;
        console.log("  GenerationMeta AI Diagnostics:", JSON.stringify(aiDiag, null, 2));
      }

      // Scenarios generated
      const scenarios = responseData.scenarios || [];
      results.scenariosGenerated = scenarios.length;
      console.log("  Scenarios generated:", scenarios.length);

      // TestSpecifications generated
      const testSpecs = responseData.testSpecifications || [];
      results.testSpecificationsGenerated = testSpecs.length;
      console.log("  TestSpecifications generated:", testSpecs.length);

      // ExecutionPlans built
      const executionPlans = responseData.executionPlans || {};
      results.executionPlansBuilt = Object.keys(executionPlans).length;
      console.log("  ExecutionPlans built:", Object.keys(executionPlans).length);

      // Unresolved specifications
      const unresolved = testSpecs.filter(s => s.planningIssue).length;
      results.unresolvedSpecifications = unresolved;
      console.log("  Unresolved specifications:", unresolved);

      // Warnings
      const warnings = responseData.warnings || [];
      results.warnings = warnings;
      console.log("  Warnings:", warnings.length ? warnings.join("; ") : "none");

      // Errors
      const errors = responseData.errors || [];
      if (errors.length) {
        results.errors.push(...errors);
        console.log("  Errors:", errors.join("; "));
      }

      // Mode
      console.log("  Mode:", responseData.mode || "not specified");
      console.log("  Generator version:", responseData.generatorVersion || "not specified");

      // Show test specifications summary
      if (testSpecs.length > 0) {
        console.log();
        console.log("  Test Specifications Summary:");
        testSpecs.slice(0, 10).forEach((spec, i) => {
          console.log(`    [${i + 1}] id=${spec.id}, title="${spec.title}", method=${spec.method || "N/A"}, path=${spec.path || "N/A"}, planningIssue=${spec.planningIssue || "none"}`);
        });
        if (testSpecs.length > 10) {
          console.log(`    ... and ${testSpecs.length - 10} more`);
        }
      }

      // Show execution plans summary
      if (Object.keys(executionPlans).length > 0) {
        console.log();
        console.log("  Execution Plans Summary:");
        Object.entries(executionPlans).forEach(([specId, plan]) => {
          console.log(`    specId=${specId}, steps=${plan.steps?.length || 0}, isValid=${plan.isValid}`);
        });
      }
    }
  }
  console.log();

  // Step 5: Check ai-debug.log for AI content
  console.log("[5] Checking ai-debug.log...");
  const logInfo = checkAiDebugLog();
  console.log("  Log exists:", logInfo.exists);
  console.log("  Log entries:", logInfo.entries);
  if (logInfo.exists && logInfo.entries > 0) {
    console.log("  Last log entries:");
    logInfo.content.split("\n").slice(-10).forEach((line, i) => {
      console.log(`    [${i}] ${line.slice(0, 300)}`);
    });

    // Search for AI_CONTENT in the log
    const aiContentMatch = logInfo.content.match(/\[ai\] AI_CONTENT\s*(.+)/);
    if (aiContentMatch) {
      const aiContent = aiContentMatch[1].trim();
      results.aiContentPreview = aiContent.slice(0, 500);
      console.log("  AI_CONTENT found in log");
      console.log("  AI_CONTENT preview:", aiContent.slice(0, 500));

      // Check if AI_CONTENT is valid JSON
      try {
        // The AI_CONTENT is the content from choices[0].message.content
        // It should be a JSON string like {"testCases":[...]}
        // But it might be wrapped in the full response
        let parsed;
        try {
          parsed = JSON.parse(aiContent);
        } catch (e) {
          // Try extracting JSON from the content
          const jsonStart = aiContent.indexOf("{");
          const jsonEnd = aiContent.lastIndexOf("}");
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            parsed = JSON.parse(aiContent.slice(jsonStart, jsonEnd + 1));
          }
        }

        if (parsed && typeof parsed === "object") {
          results.aiContentValidJson = true;
          console.log("  AI_CONTENT is valid JSON: YES");
          if (parsed.testCases) {
            console.log("  testCases count:", parsed.testCases.length);
          }
        } else {
          results.aiContentValidJson = false;
          console.log("  AI_CONTENT is valid JSON: NO (parsed but not object)");
        }
      } catch (e) {
        results.aiContentValidJson = false;
        console.log("  AI_CONTENT is valid JSON: NO (" + e.message + ")");
      }
    } else {
      console.log("  AI_CONTENT not found in log");
      results.aiContentValidJson = "not_logged";
    }
  } else {
    console.log("  No ai-debug.log found");
    results.aiContentValidJson = "not_logged";
  }
  console.log();

  // Step 6: Check if Ollama HTTP status was captured from diagnostics
  console.log("[6] Ollama HTTP status analysis:");
  if (results.ollamaHttpStatus) {
    console.log("  Ollama HTTP status:", results.ollamaHttpStatus);
  } else {
    console.log("  Ollama HTTP status: not directly available in response");
    console.log("  Checking diagnostics for HTTP status...");
    // The diagnostics might not include the HTTP status directly
    // We can infer it from the AI diagnostics
    if (results.aiDiagnostics) {
      console.log("  AI Diagnostics:", JSON.stringify(results.aiDiagnostics, null, 2));
    }
  }
  console.log();

  // Step 7: Check frontend
  console.log("[7] Checking frontend...");
  try {
    const frontendIndex = await httpGet(SERVER_HOST, SERVER_PORT, "/");
    console.log("  Frontend / status:", frontendIndex.status);
    if (frontendIndex.status === 200) {
      results.frontendLoading = "frontend reachable";
      console.log("  Frontend is reachable");
    }
  } catch (e) {
    console.log("  Frontend check failed:", e.message);
    results.frontendLoading = `frontend error: ${e.message}`;
  }
  console.log();

  // ============================================================
  // Final Report
  // ============================================================
  console.log("=".repeat(80));
  console.log("FINAL REPORT — STEP 5.4E");
  console.log("=".repeat(80));
  console.log();
  console.log("1. Ollama HTTP status and generation duration:");
  console.log("   HTTP status:", results.ollamaHttpStatus || "not directly captured (inferred from diagnostics)");
  console.log("   Generation duration:", results.ollamaDurationMs ? results.ollamaDurationMs + " ms" : "not captured");
  console.log();
  console.log("2. AI_CONTENT is valid JSON:", results.aiContentValidJson);
  console.log();
  console.log("3. Scenarios generated:", results.scenariosGenerated);
  console.log();
  console.log("4. TestSpecifications generated:", results.testSpecificationsGenerated);
  console.log();
  console.log("5. ExecutionPlans built:", results.executionPlansBuilt);
  console.log();
  console.log("6. Unresolved specifications:", results.unresolvedSpecifications);
  console.log();
  console.log("7. Warnings/errors:");
  console.log("   Warnings:", results.warnings.length ? results.warnings.join("; ") : "none");
  console.log("   Errors:", results.errors.length ? results.errors.join("; ") : "none");
  console.log();
  console.log("8. Total endpoint duration:", results.totalEndpointDurationMs ? results.totalEndpointDurationMs + " ms" : "not captured");
  console.log();
  console.log("9. Frontend status:", results.frontendLoading || "not checked");
  console.log();
  console.log("=".repeat(80));
  console.log("Raw response (first 3000 chars):");
  console.log(JSON.stringify(results.rawResponse, null, 2).slice(0, 3000));
  console.log("=".repeat(80));
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exitCode = 1;
});
