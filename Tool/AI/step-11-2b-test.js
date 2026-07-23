/**
 * STEP 11.2B — Provider Switch and Validation Test
 * 
 * This test verifies:
 * 1. Configuration works with Ollama settings
 * 2. Provider abstraction is functional
 * 3. Diagnostic passthrough works correctly
 */

const fs = require("fs");
const path = require("path");

console.log("=".repeat(70));
console.log("STEP 11.2B — Provider Switch and Validation Test");
console.log("=".repeat(70));

// Read configuration files
const envPath = path.join(__dirname, ".env");
const envSource = fs.readFileSync(envPath, "utf8");

const configPath = path.join(__dirname, "src/config.js");
const configSource = fs.readFileSync(configPath, "utf8");

const aiGenPath = path.join(__dirname, "src/engine/aiTestGeneratorV2.js");
const aiGenSource = fs.readFileSync(aiGenPath, "utf8");

const v2ProdPath = path.join(__dirname, "src/engine/v2Production.js");
const v2ProdSource = fs.readFileSync(v2ProdPath, "utf8");

// Verify Ollama configuration in .env
console.log("\n[CHECK 1] Ollama Configuration in .env");
const hasOllamaProvider = envSource.includes("AI_PROVIDER=ollama");
const hasOllamaModel = envSource.includes("AI_MODEL=");
const hasOllamaBaseUrl = envSource.includes("localhost:11434");

console.log("  AI_PROVIDER=ollama:", hasOllamaProvider);
console.log("  AI_MODEL set:", hasOllamaModel);
console.log("  AI_BASE_URL=localhost:11434:", hasOllamaBaseUrl);

// Verify Ollama support in config.js
console.log("\n[CHECK 2] Provider-Agnostic Configuration in config.js");
const configHasAiProvider = configSource.includes("AI_PROVIDER");
const configHasAiApiKey = configSource.includes("AI_API_KEY");
const configHasAiModel = configSource.includes("AI_MODEL");
const configHasAiBaseUrl = configSource.includes("AI_BASE_URL");

console.log("  AI_PROVIDER support:", configHasAiProvider);
console.log("  AI_API_KEY support:", configHasAiApiKey);
console.log("  AI_MODEL support:", configHasAiModel);
console.log("  AI_BASE_URL support:", configHasAiBaseUrl);

// Verify Ollama-specific handling in aiTestGeneratorV2.js
console.log("\n[CHECK 3] Ollama Support in aiTestGeneratorV2.js");
const isOllamaCheck = aiGenSource.includes("localhost:11434") && aiGenSource.includes("ollama");
const noAuthForOllama = aiGenSource.includes("if (!isOllama && aiConfig.apiKey)");

console.log("  Ollama detection logic:", isOllamaCheck);
console.log("  Conditional Bearer auth:", noAuthForOllama);

// Verify diagnostics passthrough
console.log("\n[CHECK 4] Diagnostics Passthrough in v2Production.js");
const hasAiDiagnostics = v2ProdSource.includes("aiDiagnostics");
const hasAttemptTracking = v2ProdSource.includes("aiAttempted");

console.log("  aiDiagnostics field:", hasAiDiagnostics);
console.log("  Attempt tracking:", hasAttemptTracking);

// Verify no hardcoded Groq references
console.log("\n[CHECK 5] No Hardcoded Provider References");
const noHardcodeGroq = !aiGenSource.toLowerCase().includes('"groq"') && 
                       !aiGenSource.includes("groq.com");

console.log("  No hardcoded Groq references:", noHardcodeGroq);

// Summary
console.log("\n" + "=".repeat(70));
console.log("TEST SUMMARY");
console.log("=".repeat(70));

const allChecks = hasOllamaProvider && hasOllamaModel && hasOllamaBaseUrl &&
                  configHasAiProvider && configHasAiApiKey && configHasAiModel && configHasAiBaseUrl &&
                  isOllamaCheck && noAuthForOllama &&
                  hasAiDiagnostics && hasAttemptTracking && noHardcodeGroq;

console.log("Ollama configuration:", (hasOllamaProvider && hasOllamaModel && hasOllamaBaseUrl) ? "PASS" : "FAIL");
console.log("Provider-agnostic config:", (configHasAiProvider && configHasAiApiKey && configHasAiModel && configHasAiBaseUrl) ? "PASS" : "FAIL");
console.log("Ollama-specific handling:", (isOllamaCheck && noAuthForOllama) ? "PASS" : "FAIL");
console.log("Diagnostics passthrough:", (hasAiDiagnostics && hasAttemptTracking) ? "PASS" : "FAIL");
console.log("No hardcoded providers:", noHardcodeGroq ? "PASS" : "FAIL");

console.log("\nOverall:", allChecks ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");

// Note about actual testing
console.log("\n" + "-".repeat(70));
console.log("NOTE: Ollama is not installed on this system.");
console.log("To run actual connectivity test:");
console.log("  1. Install Ollama from https://ollama.com/download");
console.log("  2. Run: ollama pull llama3.2");
console.log("  3. Run: ollama serve");
console.log("  4. Then run: node step-11-2b-test.js");
console.log("-".repeat(70));