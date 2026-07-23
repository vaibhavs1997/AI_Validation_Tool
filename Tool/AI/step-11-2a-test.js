/**
 * STEP 11.2A — Provider Isolation and Rate-Limit Diagnostics Test
 * 
 * Static analysis test that checks source code for proper implementation.
 */

console.log("=".repeat(60));
console.log("STEP 11.2A — Provider Isolation Diagnostics Test");
console.log("=".repeat(60));

const fs = require("fs");
const path = require("path");

const aiTestGeneratorPath = path.join(__dirname, "src/engine/aiTestGeneratorV2.js");
const aiTestGeneratorSource = fs.readFileSync(aiTestGeneratorPath, "utf8");

const configPath = path.join(__dirname, "src/config.js");
const configSource = fs.readFileSync(configPath, "utf8");

const envExamplePath = path.join(__dirname, ".env.example");
const envExampleSource = fs.readFileSync(envExamplePath, "utf8");

// Check for provider-agnostic configuration in aiTestGeneratorV2.js
console.log("\n[CHECK 1] Provider-agnostic configuration in aiTestGeneratorV2.js");
const usesConfigProvider = aiTestGeneratorSource.includes("config.ai.provider");
const usesConfigApiKey = aiTestGeneratorSource.includes("config.ai.apiKey");
const usesConfigModel = aiTestGeneratorSource.includes("config.ai.model");
const usesConfigBaseUrl = aiTestGeneratorSource.includes("config.ai.baseUrl");

console.log("  Uses config.ai.provider:", usesConfigProvider);
console.log("  Uses config.ai.apiKey:", usesConfigApiKey);
console.log("  Uses config.ai.model:", usesConfigModel);
console.log("  Uses config.ai.baseUrl:", usesConfigBaseUrl);

// Check for no hardcoded Groq references
const hasGroqString = aiTestGeneratorSource.toLowerCase().includes('groq');
const hasGroqComUrl = aiTestGeneratorSource.includes("groq.com");
const noGroqHardcode = !hasGroqString && !hasGroqComUrl;

console.log("  No hardcoded Groq references:", noGroqHardcode);

// Check for diagnostics fields (unquoted property names in JS objects)
console.log("\n[CHECK 2] Diagnostic fields in generateWithAiV2");
const hasAiProvider = aiTestGeneratorSource.includes("aiProvider:");
const hasAiModel = aiTestGeneratorSource.includes("aiModel:");
const hasAiAttempted = aiTestGeneratorSource.includes("aiAttempted:");
const hasAiSucceeded = aiTestGeneratorSource.includes("aiSucceeded:");
const hasAiErrorType = aiTestGeneratorSource.includes("aiErrorType:");
const hasAiLatencyMs = aiTestGeneratorSource.includes("aiLatencyMs:");

console.log("  aiProvider field:", hasAiProvider);
console.log("  aiModel field:", hasAiModel);
console.log("  aiAttempted field:", hasAiAttempted);
console.log("  aiSucceeded field:", hasAiSucceeded);
console.log("  aiErrorType field:", hasAiErrorType);
console.log("  aiLatencyMs field:", hasAiLatencyMs);

// Check for error classification
console.log("\n[CHECK 3] Error Classification Types");
const hasRateLimit = aiTestGeneratorSource.includes('RATE_LIMIT');
const hasAuthError = aiTestGeneratorSource.includes('AUTH_ERROR');
const hasTimeout = aiTestGeneratorSource.includes('TIMEOUT');
const hasProviderError = aiTestGeneratorSource.includes('PROVIDER_ERROR');
const hasInvalidAiResponse = aiTestGeneratorSource.includes('INVALID_AI_RESPONSE');

console.log("  RATE_LIMIT classification:", hasRateLimit);
console.log("  AUTH_ERROR classification:", hasAuthError);
console.log("  TIMEOUT classification:", hasTimeout);
console.log("  PROVIDER_ERROR classification:", hasProviderError);
console.log("  INVALID_AI_RESPONSE classification:", hasInvalidAiResponse);

// Check config.js
console.log("\n[CHECK 4] Provider-agnostic config in config.js");
const configHasAiProvider = configSource.includes("AI_PROVIDER");
const configHasAiApiKey = configSource.includes("AI_API_KEY");
const configHasAiModel = configSource.includes("AI_MODEL");
const configHasAiBaseUrl = configSource.includes("AI_BASE_URL");
const hasOpenaiFallback = configSource.includes("OPENAI_API_KEY") || configSource.includes("OPENAI_BASE_URL");

console.log("  AI_PROVIDER env var:", configHasAiProvider);
console.log("  AI_API_KEY env var:", configHasAiApiKey);
console.log("  AI_MODEL env var:", configHasAiModel);
console.log("  AI_BASE_URL env var:", configHasAiBaseUrl);
console.log("  OPENAI_* fallback support:", hasOpenaiFallback);

// Check .env.example
console.log("\n[CHECK 5] .env.example has AI_PROVIDER documentation");
const envHasAiProvider = envExampleSource.includes("AI_PROVIDER");
const envHasAiConfig = envExampleSource.includes("AI_API_KEY") && envExampleSource.includes("AI_BASE_URL");
const envHasLegacyVars = envExampleSource.includes("OPENAI_API_KEY") && envExampleSource.includes("OPENAI_BASE_URL");

console.log("  AI_PROVIDER documented:", envHasAiProvider);
console.log("  AI_* config present:", envHasAiConfig);
console.log("  Legacy OPENAI_* variables present:", envHasLegacyVars);

// Check v2Production.js diagnostics passthrough
const v2ProdPath = path.join(__dirname, "src/engine/v2Production.js");
const v2ProdSource = fs.readFileSync(v2ProdPath, "utf8");
const hasDiagPassthrough = v2ProdSource.includes("aiDiagnostics");

console.log("\n[CHECK 6] v2Production.js diagnostics passthrough");
console.log("  aiDiagnostics field:", hasDiagPassthrough);

// Summary
console.log("\n" + "=".repeat(60));
console.log("TEST SUMMARY");
console.log("=".repeat(60));

const diagnosticsComplete = hasAiProvider && hasAiModel && hasAiAttempted && hasAiSucceeded && hasAiErrorType && hasAiLatencyMs;
const errorClassificationComplete = hasRateLimit && hasAuthError && hasTimeout && hasProviderError && hasInvalidAiResponse;

console.log("Provider isolation (no Groq hardcode):", noGroqHardcode ? "PASS" : "FAIL");
console.log("Diagnostic fields present:", diagnosticsComplete ? "PASS" : "FAIL");
console.log("Error classification complete:", errorClassificationComplete ? "PASS" : "FAIL");
console.log("Config AI_* env vars:", configHasAiProvider && configHasAiApiKey && configHasAiModel && configHasAiBaseUrl ? "PASS" : "FAIL");
console.log("Backward compatibility:", hasOpenaiFallback ? "PASS" : "FAIL");
console.log("Diagnostics passthrough in v2Production:", hasDiagPassthrough ? "PASS" : "FAIL");

const allPassed = noGroqHardcode && diagnosticsComplete && errorClassificationComplete && 
                  configHasAiProvider && configHasAiApiKey && configHasAiModel && configHasAiBaseUrl &&
                  hasOpenaiFallback && hasDiagPassthrough;

console.log("\nOverall:", allPassed ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED");