/**
 * CoverageEngine
 *
 * Builds a traceability matrix: requirement → test cases.
 * Calculates coverage percentages by requirement type and source.
 */

function calculateCoverage(requirements, testCases) {
  const reqMap = new Map();
  for (const req of requirements) {
    reqMap.set(req.requirementId, req);
  }

  // Build traceability: for each requirement, find which TCs cover it
  const traceabilityMatrix = [];
  let coveredReqCount = 0;
  let acCoveredCount = 0;
  const acTotal = requirements.filter(r => r.sourceType === "AC").length;

  const byType = {};

  for (const req of requirements) {
    const coveringTCs = testCases.filter(tc =>
      tc.traceability.requirementIds.includes(req.requirementId)
    );
    const tcIds = coveringTCs.map(tc => tc.testCaseId);
    const hasTests = tcIds.length > 0;
    const hasMultiple = tcIds.length > 1;

    let status = "NO_TEST";
    if (hasTests) status = hasMultiple ? "FULL_COVERAGE" : "LOW_COVERAGE";

    traceabilityMatrix.push({
      requirementId: req.requirementId,
      requirementType: req.requirementType,
      sourceText: req.sourceText.slice(0, 80),
      testCaseIds: tcIds,
      status,
    });

    if (hasTests) coveredReqCount++;
    if (hasTests && req.sourceType === "AC") acCoveredCount++;

    // By-type stats
    if (!byType[req.requirementType]) {
      byType[req.requirementType] = { total: 0, covered: 0 };
    }
    byType[req.requirementType].total++;
    if (hasTests) byType[req.requirementType].covered++;
  }

  const reqCoverage = requirements.length > 0
    ? Math.round((coveredReqCount / requirements.length) * 100) : 0;
  const acCoverage = acTotal > 0
    ? Math.round((acCoveredCount / acTotal) * 100) : 0;

  const byTypeCoverage = {};
  for (const [type, stats] of Object.entries(byType)) {
    byTypeCoverage[type] = {
      total: stats.total,
      covered: stats.covered,
      coverage: stats.total > 0 ? Math.round((stats.covered / stats.total) * 100) : 0,
    };
  }

  return {
    requirementCoverage: reqCoverage,
    acceptanceCriteriaCoverage: acCoverage,
    byType: byTypeCoverage,
    traceabilityMatrix,
  };
}

module.exports = { calculateCoverage };
