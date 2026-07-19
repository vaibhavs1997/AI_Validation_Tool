/**
 * GapDetector
 *
 * Identifies missing specification details that could affect test quality.
 * Does NOT block generation — it flags issues for human review.
 *
 * Gap types detected:
 *   - MISSING_BOUNDARY: Range without min/max, length without bounds
 *   - MISSING_ERROR: No error behavior specified
 *   - MISSING_AUTH: Auth mentioned but no mechanism specified
 *   - MISSING_FORMAT: Format constraint without a specific pattern
 *   - MISSING_TYPE: Field mentioned without a type constraint
 *   - AMBIGUOUS: Unclear or contradictory text
 */

const { RequirementTypes } = require("./types");

function detectGaps(requirements) {
  const gaps = [];
  let gapCounter = 0;

  for (const req of requirements) {
    const { requirementType, constraint, sourceText } = req;

    switch (requirementType) {
      case RequirementTypes.RANGE_CONSTRAINT: {
        // Check if range has at least one explicit boundary
        const hasMin = constraint && (constraint.minimum !== undefined || constraint.comparisonValue !== undefined);
        const hasMax = constraint && (constraint.maximum !== undefined);
        if (constraint && constraint.minimum === undefined && constraint.maximum === undefined && !constraint.comparator) {
          gaps.push(makeGap(req, ++gapCounter, "MISSING_BOUNDARY",
            `Range constraint detected but no minimum or maximum values are specified: "${sourceText.slice(0, 80)}". The expected numeric range is unknown.`,
            "MEDIUM"));
        }
        if (hasMin && !hasMax) {
          gaps.push(makeGap(req, ++gapCounter, "MISSING_BOUNDARY",
            `Only minimum boundary specified: "${sourceText.slice(0, 80)}". Maximum is not defined — upper limit behavior is unknown.`,
            "LOW"));
        }
        break;
      }

      case RequirementTypes.LENGTH_CONSTRAINT: {
        const hasMinLength = constraint && constraint.minLength !== undefined;
        const hasMaxLength = constraint && constraint.maxLength !== undefined;
        if (!hasMinLength && !hasMaxLength) {
          gaps.push(makeGap(req, ++gapCounter, "MISSING_LENGTH",
            `Length constraint detected but no exact min/max length values specified: "${sourceText.slice(0, 80)}".`,
            "MEDIUM"));
        }
        break;
      }

      case RequirementTypes.FORMAT_CONSTRAINT: {
        if (!constraint || !constraint.format) {
          gaps.push(makeGap(req, ++gapCounter, "MISSING_FORMAT",
            `Format constraint detected but the specific format/pattern is not defined: "${sourceText.slice(0, 80)}". Expected pattern or regex is unknown.`,
            "MEDIUM"));
        }
        break;
      }

      case RequirementTypes.AUTHENTICATION: {
        if (!/(bearer|token|basic|oauth|api.?key|session)/i.test(sourceText)) {
          gaps.push(makeGap(req, ++gapCounter, "MISSING_AUTH",
            `Authentication requirement detected but the authentication mechanism is not specified: "${sourceText.slice(0, 80)}". Expected method (Bearer, Basic, OAuth, API Key) is unknown.`,
            "HIGH"));
        }
        break;
      }

      case RequirementTypes.ERROR_HANDLING: {
        if (!/\b(status|code|message|response)\b/i.test(sourceText)) {
          gaps.push(makeGap(req, ++gapCounter, "MISSING_ERROR",
            `Error handling requirement detected but expected error status code or error message format is not specified: "${sourceText.slice(0, 80)}".`,
            "MEDIUM"));
        }
        break;
      }

      case RequirementTypes.STATUS_CODE: {
        if (!/\b\d{3}\b/.test(sourceText)) {
          gaps.push(makeGap(req, ++gapCounter, "MISSING_ERROR",
            `Status code referenced but no specific HTTP status code value is mentioned: "${sourceText.slice(0, 80)}".`,
            "HIGH"));
        }
        break;
      }

      case RequirementTypes.WORKFLOW: {
        if (!/(state|status|transition|step|phase|from|to)/i.test(sourceText)) {
          gaps.push(makeGap(req, ++gapCounter, "AMBIGUOUS",
            `Workflow requirement detected but state names or transitions are not defined: "${sourceText.slice(0, 80)}".`,
            "MEDIUM"));
        }
        break;
      }
    }
  }

  // Cross-requirement gap: FIELD_VALIDATION without DATA_TYPE
  const fieldsWithValidation = new Set(
    requirements.filter(r => r.requirementType === RequirementTypes.REQUIRED_FIELD && r.subject !== "unknown")
      .map(r => r.subject)
  );
  const fieldsWithType = new Set(
    requirements.filter(r => r.requirementType === RequirementTypes.DATA_TYPE)
      .map(r => r.subject)
  );

  for (const field of fieldsWithValidation) {
    if (!fieldsWithType.has(field)) {
      const req = requirements.find(r => r.subject === field && r.requirementType === RequirementTypes.REQUIRED_FIELD);
      if (req) {
        gaps.push(makeGap(req, ++gapCounter, "MISSING_TYPE",
          `Field '${field}' is marked as required but no data type constraint is specified. Expected type (string, number, boolean, etc.) is unknown.`,
          "MEDIUM"));
      }
    }
  }

  return gaps;
}

function makeGap(req, counter, type, description, severity) {
  return {
    gapId: `GAP-${String(counter).padStart(3, "0")}`,
    requirementId: req.requirementId,
    type,
    description,
    severity,
  };
}

module.exports = { detectGaps };
