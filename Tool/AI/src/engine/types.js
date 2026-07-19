/**
 * Test Case Generation Engine — Type Definitions
 * Single source of truth for all pipeline data models.
 */

/**
 * @typedef {Object} JiraRequirementInput
 * @property {string} ticketKey
 * @property {string} summary
 * @property {string} description
 * @property {string[]} acceptanceCriteria
 * @property {string} issueType
 * @property {string} priority
 * @property {string[]} labels
 * @property {Array<{author:string, body:string}>} comments
 * @property {Object<string, any>} metadata
 */

/**
 * @typedef {'FIELD_VALIDATION'|'REQUIRED_FIELD'|'DATA_TYPE'|'RANGE_CONSTRAINT'|'FORMAT_CONSTRAINT'|'ENUM_CONSTRAINT'|'LENGTH_CONSTRAINT'|'BUSINESS_RULE'|'API_BEHAVIOR'|'RESPONSE_VALIDATION'|'STATUS_CODE'|'QUERY_PARAMETER'|'PATH_PARAMETER'|'HEADER_REQUIREMENT'|'AUTHENTICATION'|'AUTHORIZATION'|'ERROR_HANDLING'|'WORKFLOW'|'STATE_TRANSITION'|'UI_BEHAVIOR'|'UNKNOWN'} RequirementType
 */

/** @type {Object<string, RequirementType>} */
const RequirementTypes = {
  FIELD_VALIDATION: 'FIELD_VALIDATION',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  DATA_TYPE: 'DATA_TYPE',
  RANGE_CONSTRAINT: 'RANGE_CONSTRAINT',
  FORMAT_CONSTRAINT: 'FORMAT_CONSTRAINT',
  ENUM_CONSTRAINT: 'ENUM_CONSTRAINT',
  LENGTH_CONSTRAINT: 'LENGTH_CONSTRAINT',
  BUSINESS_RULE: 'BUSINESS_RULE',
  API_BEHAVIOR: 'API_BEHAVIOR',
  RESPONSE_VALIDATION: 'RESPONSE_VALIDATION',
  STATUS_CODE: 'STATUS_CODE',
  QUERY_PARAMETER: 'QUERY_PARAMETER',
  PATH_PARAMETER: 'PATH_PARAMETER',
  HEADER_REQUIREMENT: 'HEADER_REQUIREMENT',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  ERROR_HANDLING: 'ERROR_HANDLING',
  WORKFLOW: 'WORKFLOW',
  STATE_TRANSITION: 'STATE_TRANSITION',
  UI_BEHAVIOR: 'UI_BEHAVIOR',
  UNKNOWN: 'UNKNOWN',
};

/**
 * @typedef {'AC'|'DESCRIPTION'|'COMMENT'|'CONTRACT'|'OTHER'} SourceType
 */

/**
 * @typedef {Object} RequirementConstraint
 * @property {'string'|'number'|'integer'|'boolean'|'array'|'object'} [dataType]
 * @property {boolean} [required]
 * @property {number} [minLength]
 * @property {number} [maxLength]
 * @property {number} [minimum]
 * @property {number} [maximum]
 * @property {number} [exclusiveMinimum]
 * @property {number} [exclusiveMaximum]
 * @property {string} [pattern]
 * @property {Array} [enum]
 * @property {string} [format]
 * @property {boolean} [nullable]
 * @property {string} [comparator]  // ">", "<", ">=", "<=", "=="
 * @property {any} [comparisonValue]
 */

/**
 * @typedef {Object} AtomicRequirement
 * @property {string} requirementId
 * @property {string} sourceText
 * @property {SourceType} sourceType
 * @property {RequirementType} requirementType
 * @property {string} subject
 * @property {RequirementConstraint} [constraint]
 * @property {boolean} explicit
 * @property {number} confidence
 */

/**
 * @typedef {Object} NormalizedRequirement
 * @property {string} requirementId
 * @property {string} sourceText
 * @property {SourceType} sourceType
 * @property {RequirementType} requirementType
 * @property {string} subject
 * @property {RequirementConstraint} [constraint]
 * @property {boolean} explicit
 * @property {number} confidence
 * @property {string} detectedField
 * @property {string[]} tags
 */

/**
 * @typedef {'MISSING_BOUNDARY'|'MISSING_LENGTH'|'MISSING_ERROR'|'MISSING_AUTH'|'MISSING_FORMAT'|'MISSING_TYPE'|'CONTRADICTORY'|'AMBIGUOUS'} GapType
 */

/**
 * @typedef {Object} RequirementGap
 * @property {string} gapId
 * @property {string} requirementId
 * @property {GapType} type
 * @property {string} description
 * @property {'HIGH'|'MEDIUM'|'LOW'} severity
 */

/**
 * @typedef {Object} PayloadMutation
 * @property {'ADD'|'REMOVE'|'REPLACE'|'SET_NULL'|'SET_EMPTY'|'CHANGE_TYPE'|'BOUNDARY_VALUE'|'INVALID_FORMAT'|'DUPLICATE'|'CUSTOM'} operation
 * @property {string} path
 * @property {any} [value]
 * @property {string} [description]
 */

/**
 * @typedef {Object} TestCondition
 * @property {string} conditionId
 * @property {string} requirementId
 * @property {'BVA'|'EP'|'DECISION_TABLE'|'STATE_TRANSITION'|'ERROR_GUESSING'} technique
 * @property {'POSITIVE'|'NEGATIVE'|'BOUNDARY'|'EDGE'} category
 * @property {string} field
 * @property {PayloadMutation} [mutation]
 * @property {string} expectedBehaviorDescription
 * @property {string} [equivalencePartition]
 */

/**
 * @typedef {Object} TestCaseClassification
 * @property {'POSITIVE'|'NEGATIVE'|'BOUNDARY'|'EDGE'|'CONTRACT'|'SECURITY'|'WORKFLOW'} category
 * @property {'BVA'|'EP'|'DECISION_TABLE'|'STATE_TRANSITION'|'ERROR_GUESSING'|'REQUIREMENT_BASED'} technique
 * @property {'EXPLICIT'|'DERIVED'|'INFERRED'|'EXPLORATORY'} origin
 * @property {'HIGH'|'MEDIUM'|'LOW'} confidence
 */

/**
 * @typedef {Object} TestCaseTraceability
 * @property {string} jiraTicket
 * @property {string[]} requirementIds
 * @property {string[]} acceptanceCriteria
 */

/**
 * @typedef {Object} TestCaseExpected
 * @property {string} behavior
 * @property {number|null} statusCode
 * @property {string[]} bodyAssertions
 * @property {string[]} headerAssertions
 * @property {string[]} schemaAssertions
 * @property {string|null} requirementGap
 */

/**
 * @typedef {Object} TestCaseRequest
 * @property {string|null} method
 * @property {string|null} endpoint
 * @property {Object<string,string>} headers
 * @property {Object<string,string>} queryParams
 * @property {Object<string,string>} pathParams
 * @property {Object<string,any>} basePayload
 * @property {PayloadMutation|null} mutation
 */

/**
 * @typedef {Object} TestCase
 * @property {string} testCaseId
 * @property {string} title
 * @property {string} description
 * @property {TestCaseClassification} classification
 * @property {TestCaseTraceability} traceability
 * @property {string[]} preconditions
 * @property {TestCaseRequest} [request]
 * @property {Object<string,any>} testData
 * @property {TestCaseExpected} expected
 * @property {'P0'|'P1'|'P2'|'P3'} priority
 * @property {{automatable:boolean, reason:string|null}} automation
 */

/**
 * @typedef {Object} CoverageEntry
 * @property {string} requirementId
 * @property {string[]} testCaseIds
 * @property {'NO_TEST'|'LOW_COVERAGE'|'FULL_COVERAGE'} status
 */

/**
 * @typedef {Object} CoverageReport
 * @property {number} requirementCoverage
 * @property {number} acceptanceCriteriaCoverage
 * @property {Object<string, {total:number, covered:number, coverage:number}>} byType
 * @property {CoverageEntry[]} traceabilityMatrix
 */

/**
 * @typedef {Object} GenerationSummary
 * @property {string} ticket
 * @property {'SMOKE'|'STANDARD'|'COMPREHENSIVE'} mode
 * @property {Object} summary
 * @property {number} summary.requirementsDetected
 * @property {number} summary.testCasesGenerated
 * @property {Object<string,number>} summary.byCategory
 * @property {{requirementCoverage:number, acceptanceCriteriaCoverage:number}} summary.coverage
 * @property {{highConfidence:number, mediumConfidence:number, lowConfidence:number, duplicatesRemoved:number}} summary.quality
 * @property {number} summary.requirementGaps
 * @property {Object} metadata
 * @property {string} metadata.model
 * @property {string} metadata.generationTimestamp
 * @property {string} metadata.inputHash
 * @property {{prompt:number, completion:number, total:number}|null} metadata.tokenUsage
 * @property {number} metadata.latencyMs
 * @property {Array} requirements
 * @property {Array} requirementGaps
 * @property {TestCase[]} testCases
 * @property {Array} traceabilityMatrix
 */

/**
 * @typedef {'SMOKE'|'STANDARD'|'COMPREHENSIVE'} GenerationMode
 */

/** @type {Object<string, GenerationMode>} */
const GenerationModes = {
  SMOKE: 'SMOKE',
  STANDARD: 'STANDARD',
  COMPREHENSIVE: 'COMPREHENSIVE',
};

module.exports = {
  RequirementTypes,
  GenerationModes,
};
