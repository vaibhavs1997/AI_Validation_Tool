/**
 * Orchestrator
 *
 * Coordinates the full test generation pipeline:
 *
 * 1. RequirementExtraction → 2. GapDetection → 3. TestConditionGeneration
 * 4. TestDesign → 5. Deduplication → 6. CoverageAnalysis → 7. Prioritization
 *
 * Returns a complete GenerationSummary with test cases, requirements, gaps, and metadata.
 */

const crypto = require("crypto");
const { GenerationModes } = require("./types");
const { extractRequirements } = require("./requirementExtractor");
const { detectGaps } = require("./gapDetector");
const { generateConditions } = require("./testConditionEngine");
const { buildTestCases } = require("./testDesignEngine");
const { deduplicate } = require("./deduplicationEngine");
const { calculateCoverage } = require("./coverageEngine");

/**
 * Run the full test generation pipeline.
 *
 * @param {Object} ticket - Normalized Jira ticket (JiraRequirementInput)
 * @param {'SMOKE'|'STANDARD'|'COMPREHENSIVE'} mode - Generation mode
 * @param {Object} [contract] - Optional API contract for enrichment
 * @returns {Object} GenerationSummary
 */
function runPipeline(ticket, mode = GenerationModes.STANDARD, contract = null) {
  const startTime = Date.now();
  const inputHash = crypto.createHash("md5").update(JSON.stringify(ticket)).digest("hex").slice(0, 12);

  // ─── Stage 1: Requirement Extraction ──────────────────────────
  const requirements = extractRequirements(ticket);

  // ─── Stage 2: Gap Detection ───────────────────────────────────
  const requirementGaps = detectGaps(requirements);

  // ─── Stage 3: Test Condition Generation ──────────────────────
  const conditions = generateConditions(requirements, mode);

  // ─── Stage 4: Test Case Assembly ──────────────────────────────
  let testCases = buildTestCases(conditions, requirements, ticket.key || "unknown", mode);

  // ─── Stage 5: Deduplication ───────────────────────────────────
  const { testCases: deduped, stats: dedupStats } = deduplicate(testCases);

  // ─── Stage 6: Coverage ────────────────────────────────────────
  const coverage = calculateCoverage(requirements, deduped);

  // ─── Stage 7: Prioritization (sort by priority order) ─────────
  const prioritized = prioritizeTestCases(deduped);

  // ─── Compile summary ──────────────────────────────────────────
  const byCategory = {};
  let highConf = 0, medConf = 0, lowConf = 0;
  for (const tc of prioritized) {
    byCategory[tc.classification.category] = (byCategory[tc.classification.category] || 0) + 1;
    if (tc.classification.confidence === "HIGH") highConf++;
    else if (tc.classification.confidence === "MEDIUM") medConf++;
    else lowConf++;
  }

  return {
    ticket: ticket.key || "unknown",
    mode,
    summary: {
      requirementsDetected: requirements.length,
      testCasesGenerated: prioritized.length,
      byCategory,
      coverage: {
        requirementCoverage: coverage.requirementCoverage,
        acceptanceCriteriaCoverage: coverage.acceptanceCriteriaCoverage,
      },
      quality: {
        highConfidence: highConf,
        mediumConfidence: medConf,
        lowConfidence: lowConf,
        duplicatesRemoved: dedupStats.duplicatesRemoved,
      },
      requirementGaps: requirementGaps.length,
    },
    metadata: {
      model: "deterministic-v1",
      generationTimestamp: new Date().toISOString(),
      inputHash,
      latencyMs: Date.now() - startTime,
    },
    requirements,
    requirementGaps,
    testCases: prioritized,
    traceabilityMatrix: coverage.traceabilityMatrix,
  };
}

function prioritizeTestCases(testCases) {
  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return [...testCases].sort((a, b) => {
    const pa = priorityOrder[a.priority] || 3;
    const pb = priorityOrder[b.priority] || 3;
    if (pa !== pb) return pa - pb;
    // Within same priority: SECURITY first, then by confidence
    const catOrder = { SECURITY: 0, CONTRACT: 1, NEGATIVE: 2, BOUNDARY: 3, POSITIVE: 4, EDGE: 5 };
    const ca = catOrder[a.classification.category] || 6;
    const cb = catOrder[b.classification.category] || 6;
    return ca - cb;
  });
}

module.exports = { runPipeline };
