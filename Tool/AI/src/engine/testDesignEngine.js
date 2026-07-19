/**
 * TestDesignEngine
 *
 * Converts test conditions into full TestCase objects with proper
 * classification, traceability, mutations, and expected results.
 *
 * Every test case is tagged with:
 *   - category (POSITIVE/NEGATIVE/BOUNDARY/EDGE/SECURITY)
 *   - technique (BVA/EP/DECISION_TABLE/etc.)
 *   - origin (EXPLICIT/DERIVED/INFERRED/EXPLORATORY)
 *   - confidence (HIGH/MEDIUM/LOW)
 */

function buildTestCases(conditions, requirements, ticketKey, mode) {
  const testCases = [];
  let tcCounter = 0;

  for (const cond of conditions) {
    tcCounter++;
    const req = requirements.find(r => r.requirementId === cond.requirementId);
    const origin = determineOrigin(cond, req);
    const confidence = determineConfidence(cond, req, origin);
    const priority = determinePriority(cond.category, origin);

    testCases.push({
      testCaseId: `TC-${String(tcCounter).padStart(3, "0")}`,
      title: cond.expectedBehaviorDescription.slice(0, 150),
      description: cond.expectedBehaviorDescription,
      classification: {
        category: cond.category,
        technique: cond.technique,
        origin,
        confidence,
      },
      traceability: {
        jiraTicket: ticketKey,
        requirementIds: [cond.requirementId],
        acceptanceCriteria: req && req.sourceType === "AC" ? [req.sourceText] : [],
      },
      preconditions: generatePreconditions(cond, req),
      request: {
        method: null,
        endpoint: null,
        headers: {},
        queryParams: {},
        pathParams: {},
        basePayload: {},
        mutation: cond.mutation || null,
      },
      testData: {},
      expected: {
        behavior: cond.expectedBehaviorDescription,
        statusCode: inferStatusCode(cond),
        bodyAssertions: inferBodyAssertions(cond),
        headerAssertions: [],
        schemaAssertions: [],
        requirementGap: null,
      },
      priority,
      automation: {
        automatable: cond.mutation !== null && cond.category !== "EDGE",
        reason: cond.mutation ? null : "Requires manual validation of business behavior",
      },
    });
  }

  return testCases;
}

function determineOrigin(cond, req) {
  if (req && req.explicit && cond.category === "POSITIVE") return "EXPLICIT";
  if (req && req.explicit) return "DERIVED";
  if (cond.technique === "ERROR_GUESSING") return "EXPLORATORY";
  if (req && req.confidence >= 0.5) return "DERIVED";
  return "INFERRED";
}

function determineConfidence(cond, req, origin) {
  if (origin === "EXPLICIT") return "HIGH";
  if (origin === "DERIVED" && req && req.confidence >= 0.8) return "HIGH";
  if (origin === "DERIVED") return "MEDIUM";
  if (origin === "INFERRED") return "MEDIUM";
  return "LOW";
}

function determinePriority(category, origin) {
  if (category === "SECURITY" || category === "CONTRACT") return "P1";
  if (origin === "EXPLICIT" && category === "POSITIVE") return "P1";
  if (origin === "EXPLICIT" && category === "NEGATIVE") return "P1";
  if (origin === "DERIVED" && category === "POSITIVE") return "P2";
  if (origin === "DERIVED" && (category === "NEGATIVE" || category === "BOUNDARY")) return "P2";
  if (origin === "INFERRED") return "P3";
  return "P3";
}

function generatePreconditions(cond, req) {
  const preconditions = [];
  if (req && req.sourceText) {
    preconditions.push(`Requirement: ${req.sourceText}`);
  }
  if (cond.category === "NEGATIVE") {
    preconditions.push("System is in a valid initial state before the negative test");
  }
  return preconditions;
}

function inferStatusCode(cond) {
  if (cond.category === "POSITIVE" || cond.category === "BOUNDARY") return null; // Should not invent
  if (cond.category === "SECURITY") return null; // Should not invent
  if (cond.category === "NEGATIVE") return null; // Should not invent — gap if missing
  return null;
}

function inferBodyAssertions(cond) {
  if (cond.category === "POSITIVE" || cond.category === "BOUNDARY") {
    return ["Response indicates success"];
  }
  if (cond.category === "NEGATIVE") {
    return ["Response indicates validation failure"];
  }
  if (cond.category === "SECURITY") {
    return ["Response indicates authentication/authorization failure"];
  }
  return [];
}

module.exports = { buildTestCases };
