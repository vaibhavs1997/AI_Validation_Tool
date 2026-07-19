/**
 * Matching Engine — Type Definitions
 *
 * Data models for the test-case-to-API-endpoint matching pipeline.
 * All types are domain-agnostic — no business entities are hardcoded.
 */

/**
 * @typedef {Object} TargetIntent
 * Structured description of what a test case is trying to test,
 * extracted deterministically from the test case + its source requirements.
 *
 * @property {string} testCaseId
 * @property {OperationIntent} operationIntent
 * @property {TargetField[]} targetFields
 * @property {ParameterHints} parameterHints
 * @property {AuthIntent|null} authIntent
 * @property {SourceEvidence[]} sourceEvidence
 * @property {'POSITIVE'|'NEGATIVE'|'BOUNDARY'|'EDGE'|'SECURITY'} category
 */

/**
 * @typedef {Object} OperationIntent
 * @property {string[]} actionTerms — extracted action verbs ("create", "update", "delete", "search")
 * @property {string[]} resourceTerms — extracted resource nouns ("account", "claim", "patient", "policy")
 * @property {string[]} contextTerms — additional contextual terms from requirements/ACs
 * @property {string[]} methodHints — inferred HTTP methods ("GET", "POST", "PUT", "DELETE")
 * @property {boolean} hasExplicitMethod — true if method was explicitly stated
 */

/**
 * @typedef {Object} TargetField
 * @property {string} name — the field name
 * @property {string} [jsonPath] — normalized JSON path (e.g., "$.parent.child")
 * @property {'BODY'|'QUERY'|'PATH'|'HEADER'|'AUTH'|'UNKNOWN'} possibleLocation
 * @property {'REQUIRED'|'FORMAT'|'TYPE'|'RANGE'|'LENGTH'|'ENUM'|'OTHER'} constraintType
 * @property {number} confidence — how confidently we detected it (0-1)
 */

/**
 * @typedef {Object} ParameterHints
 * @property {string[]} query — query parameter names detected
 * @property {string[]} path — path parameter names detected
 * @property {string[]} header — header names detected
 */

/**
 * @typedef {Object} AuthIntent
 * @property {boolean} isAuthTest
 * @property {'MISSING'|'INVALID'|'EXPIRED'|'INSUFFICIENT'|'EXPLICIT'} authTestType
 * @property {string[]} authKeywords
 */

/**
 * @typedef {Object} SourceEvidence
 * @property {'REQUIREMENT'|'AC'|'TITLE'|'DESCRIPTION'|'ASSERTION'|'MUTATION'} source
 * @property {string} text
 * @property {number} confidence (0-1)
 */

/**
 * @typedef {Object} OperationContext
 * Groups related test cases that likely target the same API operation.
 *
 * @property {string} contextId
 * @property {string[]} requirementIds — shared requirement IDs
 * @property {string[]} testCaseIds — member test cases
 * @property {OperationIntent} intent — aggregated intent across members
 * @property {TargetField[]} fields — aggregated target fields
 * @property {string|null} resolvedEndpointId — endpoint assigned after matching
 * @property {MatchingResult|null} matchResult — detailed matching result
 */

/**
 * @typedef {Object} FieldIndex
 * Inverted index mapping field metadata → endpoint IDs.
 * Built dynamically from the API catalog — no hardcoded field names.
 *
 * @property {Map<string, string[]>} byFieldName — field name → endpoint IDs
 * @property {Map<string, string[]>} byJsonPath — normalized JSON path → endpoint IDs
 * @property {Map<string, string[]>} byPathToken — URL path segment → endpoint IDs
 * @property {Map<string, string[]>} byOperationTerm — operationId/summary term → endpoint IDs
 * @property {Map<string, string[]>} byTag — tag name → endpoint IDs
 * @property {Map<string, string[]>} byQueryParam — query parameter name → endpoint IDs
 * @property {Map<string, string[]>} byPathParam — path parameter name → endpoint IDs
 * @property {Map<string, string[]>} byHeaderParam — header name → endpoint IDs
 * @property {Map<'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD'|'OPTIONS', string[]>} byMethod — HTTP method → endpoint IDs
 * @property {Map<string, string[]>} byFolder — folder path → endpoint IDs (Postman only)
 * @property {Map<string, string[]>} byContentType — content type → endpoint IDs
 */

/**
 * @typedef {Object} MatchingSignal
 * A single independent signal score.
 *
 * @property {string} name — signal name (e.g., "method", "field_overlap", "path_match")
 * @property {number} score — normalized 0-1 contribution
 * @property {number} weight — importance weight (used in weighted average)
 * @property {'HARD_CONSTRAINT'|'STRONG'|'MEDIUM'|'WEAK'} strength
 * @property {string} [explanation] — human-readable reason
 * @property {boolean} [isConflict] — if true, this signal indicates a hard conflict
 */

/**
 * @typedef {Object} CandidateScore
 * Score for a single candidate endpoint.
 *
 * @property {string} endpointId
 * @property {number} totalScore — weighted sum of all signals (0-1)
 * @property {MatchingSignal[]} signals — individual signal breakdowns
 * @property {boolean} hasHardConflict — any HARD_CONSTRAINT signal flagged
 * @property {string[]} conflictReasons
 */

/**
 * @typedef {Object} MatchingResult
 * @property {string} contextId
 * @property {string[]} testCaseIds
 * @property {string} intentSummary
 * @property {CandidateScore[]} candidates — scored candidates, sorted descending
 * @property {number} confidence — final confidence 0-1
 * @property {'HIGH'|'MEDIUM'|'LOW'|'NONE'} confidenceLevel
 * @property {boolean} ambiguous — true if too close between top 2
 * @property {boolean} needsHumanReview — true if confidence low or ambiguous
 * @property {string|null} resolvedEndpointId — the selected endpoint (null if unresolved)
 * @property {string|null} [resolvedEndpointMethod] — method of resolved endpoint
 * @property {string|null} [resolvedEndpointPath] — path of resolved endpoint
 * @property {string[]} reviewReasons — why human review is needed
 * @property {string[]} [warnings]
 */

// ─── Helper functions for weights/config ─────────────────────────────────

/** Signal weights used in weighted average scoring */
const SIGNAL_WEIGHTS = {
  METHOD_MATCH: { weight: 0.15, strength: 'HARD_CONSTRAINT' },
  FIELD_OVERLAP: { weight: 0.18, strength: 'STRONG' },
  NESTED_FIELD_MATCH: { weight: 0.12, strength: 'STRONG' },
  PATH_MATCH: { weight: 0.14, strength: 'STRONG' },
  OPERATION_NAME_MATCH: { weight: 0.10, strength: 'MEDIUM' },
  FOLDER_CONTEXT_MATCH: { weight: 0.06, strength: 'MEDIUM' },
  QUERY_PARAM_MATCH: { weight: 0.08, strength: 'MEDIUM' },
  PATH_PARAM_MATCH: { weight: 0.05, strength: 'MEDIUM' },
  HEADER_MATCH: { weight: 0.04, strength: 'MEDIUM' },
  AUTH_MATCH: { weight: 0.05, strength: 'STRONG' },
  CONTENT_TYPE_MATCH: { weight: 0.03, strength: 'WEAK' },
  BUSINESS_CONTEXT_MATCH: { weight: 0.06, strength: 'MEDIUM' },
  SCHEMA_SHAPE_MATCH: { weight: 0.10, strength: 'STRONG' },
  ACTION_MATCH: { weight: 0.08, strength: 'MEDIUM' },
};

const AMBIGUITY_THRESHOLD = 0.15; // If top 2 within 15%, flag ambiguous
const HIGH_CONFIDENCE_THRESHOLD = 0.75;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.50;
const LOW_CONFIDENCE_THRESHOLD = 0.25;

module.exports = {
  SIGNAL_WEIGHTS,
  AMBIGUITY_THRESHOLD,
  HIGH_CONFIDENCE_THRESHOLD,
  MEDIUM_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
};
