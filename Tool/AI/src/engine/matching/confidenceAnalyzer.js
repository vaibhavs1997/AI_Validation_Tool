/**
 * ConfidenceAnalyzer
 *
 * Takes scored candidates and produces:
 *   - Normalized confidence score (0-1)
 *   - Confidence level (HIGH/MEDIUM/LOW/NONE)
 *   - Ambiguity detection (top 2 too close)
 *   - Human-review flagging
 *   - Review reasons
 */

const {
  AMBIGUITY_THRESHOLD,
  HIGH_CONFIDENCE_THRESHOLD,
  MEDIUM_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
} = require("./types");

/**
 * Analyze confidence and ambiguity for a set of scored candidates.
 *
 * @param {string} contextId
 * @param {string[]} testCaseIds
 * @param {Array} candidates — CandidateScore[], already sorted descending by totalScore
 * @param {Object} [intent] — optional OperationIntent for summary
 * @returns {Object} MatchingResult
 */
function analyzeConfidence(contextId, testCaseIds, candidates, intent) {
  if (!candidates || candidates.length === 0) {
    return {
      contextId,
      testCaseIds,
      intentSummary: intent?.actionTerms?.join(", ") || "unknown",
      candidates: [],
      confidence: 0,
      confidenceLevel: "NONE",
      ambiguous: false,
      needsHumanReview: true,
      resolvedEndpointId: null,
      resolvedEndpointMethod: null,
      resolvedEndpointPath: null,
      reviewReasons: ["No candidate endpoints found in the API catalog"],
    };
  }

  const topScore = candidates[0].totalScore;
  const topCand = candidates[0];
  const secondScore = candidates.length > 1 ? candidates[1].totalScore : 0;
  const gap = Math.abs(topScore - secondScore);
  const ambiguous = gap < AMBIGUITY_THRESHOLD && candidates.length > 1;

  // Determine confidence level
  let confidenceLevel;
  if (topScore >= HIGH_CONFIDENCE_THRESHOLD) confidenceLevel = "HIGH";
  else if (topScore >= MEDIUM_CONFIDENCE_THRESHOLD) confidenceLevel = "MEDIUM";
  else if (topScore >= LOW_CONFIDENCE_THRESHOLD) confidenceLevel = "LOW";
  else confidenceLevel = "NONE";

  // Check if best candidate has hard conflicts
  const hasHardConflict = topCand.hasHardConflict;
  
  // Check for explicit method match as a strong signal
  // If method signal is 1.0 and no hard conflicts, consider this a valid match
  const methodSignal = topCand.signals?.find(s => s.name === "method");
  const hasExplicitMethodMatch = methodSignal && methodSignal.score === 1.0;
  
  // If we have an explicit method match with no hard conflicts, resolve even with low confidence
  // This enables domain-agnostic matching where method is the strongest signal
  const canResolveWithMethodMatch = hasExplicitMethodMatch && !hasHardConflict;
  
  const needsHumanReview = hasHardConflict || ambiguous || (!canResolveWithMethodMatch && (confidenceLevel === "LOW" || confidenceLevel === "NONE"));

  const reviewReasons = [];
  if (hasHardConflict) reviewReasons.push(`Top candidate has hard conflicts: ${topCand.conflictReasons.join("; ")}`);
  if (ambiguous && candidates.length > 1) {
    reviewReasons.push(`Ambiguous: top two candidates are close (${candidates[0].endpointId}: ${(topScore * 100).toFixed(0)}% vs ${candidates[1].endpointId}: ${(secondScore * 100).toFixed(0)}%)`);
  }
  // Only add low confidence reason if we can't resolve via method match
  if (!canResolveWithMethodMatch && (confidenceLevel === "LOW" || confidenceLevel === "NONE")) {
    reviewReasons.push(`Low confidence (${(topScore * 100).toFixed(0)}%)`);
  }

  // Resolve endpoint
  let resolvedEndpointId = null;
  let resolvedEndpointMethod = null;
  let resolvedEndpointPath = null;

  if (!needsHumanReview && !hasHardConflict) {
    resolvedEndpointId = topCand.endpointId;
  } else if (canResolveWithMethodMatch && !hasHardConflict) {
    // Even with low confidence, if we have an explicit method match, use the top candidate
    // This provides reasonable endpoint linking for domain-agnostic scenarios
    resolvedEndpointId = topCand.endpointId;
  }

  return {
    contextId,
    testCaseIds,
    intentSummary: intent?.actionTerms?.join(", ") || (testCaseIds || []).join(", "),
    candidates,
    confidence: topScore,
    confidenceLevel,
    ambiguous,
    needsHumanReview,
    resolvedEndpointId,
    resolvedEndpointMethod: null,
    resolvedEndpointPath: null,
    reviewReasons,
  };
}

/**
 * Compute weighted total score from signals.
 *
 * @param {MatchingSignal[]} signals
 * @returns {Object} { totalScore: number, hasHardConflict: boolean, conflictReasons: string[] }
 */
function computeWeightedScore(signals) {
  let weightedSum = 0;
  let totalWeight = 0;
  const conflictReasons = [];

  for (const sig of signals) {
    if (sig.isConflict) {
      conflictReasons.push(sig.explanation || sig.name);
    }
    weightedSum += sig.score * sig.weight;
    totalWeight += sig.weight;
  }

  const totalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const hasHardConflict = conflictReasons.length > 0;

  return { totalScore, hasHardConflict, conflictReasons };
}

module.exports = {
  analyzeConfidence,
  computeWeightedScore,
};
