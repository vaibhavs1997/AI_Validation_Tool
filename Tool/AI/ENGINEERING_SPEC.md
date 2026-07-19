# AI-Powered Test Case Generation Engine — Engineering Specification

## Phase 1: Current State Analysis

### Existing Architecture (as implemented)

**File**: `src/scenarios/scenarioGenerator.js` (~670 lines, monolithic)

**Current flow**:
```
Jira Ticket Object → createTestCasesFromTicket() → assignEndpointsToTestCases() → prioritizeScenarios()
                                    ↓
                         localGenerate() → generateScenarios()
```

**What it does well**:
- Accepts a normalized ticket object with `acceptanceCriteria[]`
- Parses plain text ACs into structured test cases using deterministic rules
- Scores endpoints for matching (method + path + tags + operationId)
- Deduplicates by type + mutation signature + assertion text
- Prioritizes by risk (high/medium/low)
- Merges AI-enhanced scenarios with local ones
- Has a working `enhanceScenarios()` via LLM client

**Critical weaknesses against the spec**:

| Issue | Current Behavior | Spec Requirement |
|-------|-----------------|------------------|
| Atomic requirements | AC text used directly as source — no atomic extraction | Must extract FIELD_VALIDATION, RANGE, TYPE, FORMAT etc. individually |
| Fact vs inference | No classification — all generated tests appear equivalent | Must tag EXPLICIT/DERIVED/INFERRED/EXPLORATORY |
| Hallucinated boundaries | `boundaryMax: 999999999`, `boundaryMin: -1` invented without evidence | Must NOT invent boundaries; must flag gaps instead |
| Hardcoded field patterns | `detectAcField()` maps keywords to specific field names | Must be schema-aware, not keyword-mapped |
| No gap detection | Silently generates speculative tests | Must detect and report missing min/max/format/null behavior |
| Test design techniques | Single monolithic `createTestCasesFromTicket()` | Must apply BVA, EP, decision tables, state transition per requirement |
| Confidence model | None — all tests treated equally | Must score HIGH/MEDIUM/LOW per test |
| Coverage analysis | None — just a list of tests | Must produce traceability matrix with requirement coverage % |
| Output structure | Flat scenario object with custom fields | Must follow structured schema (testCaseId, classification, traceability, expectations) |
| Generation modes | No mode control | Must support SMOKE/STANDARD/COMPREHENSIVE |
| Validation pipeline | None | Must validate each test before inclusion |
| Mutation engine | `mutationEngine.js` exists but limited (7 operations, shallow path) | Needs ADD/REMOVE/REPLACE/SET_NULL/CHANGE_TYPE with nested JSON path support |

**Reusable components**:
- `src/acExtractor.js` — text normalization and AC extraction ✓
- `src/payload/mutationEngine.js` — basic mutation operations (needs extension)
- `src/contracts/contractParser.js` — schema parsing for OpenAPI/Postman
- `src/integrations/llmClient.js` — LLM integration pattern (needs structured output validation)
- `src/validation/validators.js` — response validation (status, schema, time)
- `src/execution/executionEngine.js` — execution layer
- `src/storage.js` — persistence
- `src/server.js` — API routing

**Components needing replacement**:
- `src/scenarios/scenarioGenerator.js` — the entire file needs to be replaced by the pipeline
- `src/payload/mutationEngine.js` — needs extension for nested paths, more operations
- `src/integrations/llmClient.js` — needs structured JSON schema validation

---

## Phase 2: Target Architecture

```
JiraInput (normalized ticket)
    ↓
RequirementExtractor          ← deterministic + LLM
    ↓
AtomicRequirement[]
    ↓
RequirementNormalizer         ← deterministic (schema enrichment, type detection)
    ↓
NormalizedRequirement[]
    ↓
GapDetector                  ← deterministic rules
    ↓
NormalizedRequirement[] + Gap[]
    ↓
TestConditionEngine           ← test design technique selection
    ↓
TestCondition[]
    ↓
TestDesignEngine              ← BVA / EP / DecisionTable / StateTransition
    ↓
TestCase[]
    ↓
LLMScenarioEnhancer          ← optional LLM stage for complex scenarios
    ↓
TestCase[]
    ↓
TestCaseValidator             ← deterministic validation rules
    ↓
TestCase[]
    ↓
DeduplicationEngine           ← deterministic + semantic
    ↓
TestCase[]
    ↓
CoverageEngine                ← traceability matrix
    ↓
CoverageReport
    ↓
PrioritizationEngine          ← risk-based
    ↓
TestCase[] (final, prioritized, with metadata)
```

### Component Responsibilities

#### 1. RequirementExtractor (`src/engine/requirementExtractor.js`)
- Input: Normalized ticket object (key, summary, description, acceptanceCriteria[], comments[])
- Output: `AtomicRequirement[]`
- Algorithm:
  1. For each AC/description line, detect requirement type using regex patterns
  2. Split compound requirements ("must be numeric and > 0" → 2 requirements)
  3. Classify each as FIELD_VALIDATION, DATA_TYPE, RANGE, FORMAT, BUSINESS_RULE, etc.
  4. If LLM available and configured, send ambiguous text for structured extraction
  5. Return ordered list with source traceability
- Deterministic patterns for common cases:
  - "must be required" / "is required" / "mandatory" → REQUIRED_FIELD
  - "must be numeric" / "must be a number" / "must be an integer" → DATA_TYPE
  - "must be greater than" / "exceed" / "minimum" / "maximum" → RANGE_CONSTRAINT
  - "must match pattern" / "must be in format" / "valid email" → FORMAT_CONSTRAINT
  - "must be one of" / "must be either" / "allowed values" → ENUM_CONSTRAINT
  - "must not exceed" / "max length" / "min length" → LENGTH_CONSTRAINT

#### 2. RequirementNormalizer (`src/engine/requirementNormalizer.js`)
- Input: `AtomicRequirement[]`
- Output: `NormalizedRequirement[]`
- Enriches requirements with:
  - Detected field name from context
  - Inferred data type from surrounding text
  - Schema information if contract is provided
  - Resolves references between requirements

#### 3. GapDetector (`src/engine/gapDetector.js`)
- Input: `NormalizedRequirement[]`
- Output: `NormalizedRequirement[]` + `RequirementGap[]`
- Detection rules:
  - RANGE without both min and max → "MISSING_BOUNDARY" gap
  - STRING type without length constraint → "MISSING_LENGTH_CONSTRAINT" gap
  - FIELD_VALIDATION without explicit error behavior → "MISSING_ERROR_BEHAVIOR" gap
  - NO_AUTH requirement without explicit auth type → "MISSING_AUTH_SPECIFICATION" gap
  - Conflicting requirements → "CONTRADICTORY_REQUIREMENTS" gap

#### 4. TestConditionEngine (`src/engine/testConditionEngine.js`)
- Input: `NormalizedRequirement[]` + `GenerationMode`
- Output: `TestCondition[]`
- For each requirement, determines applicable test design techniques:
  - DATA_TYPE → EP (valid type, invalid types)
  - REQUIRED_FIELD → EP (present, missing, empty, null)
  - RANGE_CONSTRAINT → BVA (min-1, min, min+1, nominal, max-1, max, max+1) + EP
  - FORMAT_CONSTRAINT → EP (valid format, invalid formats)
  - ENUM_CONSTRAINT → EP (valid value, invalid value)
  - LENGTH_CONSTRAINT → BVA (min-1, min, min+1, nominal, max-1, max, max+1)
  - BUSINESS_RULE → Decision table
  - STATE_TRANSITION → State transition coverage
  - AUTHENTICATION → EP (valid token, missing token, expired token)
- Respects generation mode: SMOKE = positive only, STANDARD = positive + negative + key boundaries, COMPREHENSIVE = everything

#### 5. TestDesignEngine (`src/engine/testDesignEngine.js`)
- Input: `TestCondition[]`
- Output: `TestCase[]` (preliminary, before enrichment)
- Applies the selected techniques:
  - BVA: Generates specific boundary values
  - EP: Generates one representative per partition
  - Decision table: Generates meaningful combinations (not Cartesian explosion)
  - State transition: Generates valid/invalid transition tests
- Generates base payload mutations for each test
- Classification: Each test gets category + technique + origin tags

#### 6. LLMScenarioEnhancer (`src/engine/llmEnhancer.js`)
- Input: `TestCase[]` + `NormalizedRequirement[]` + `JiraInput`
- Output: `TestCase[]` (enriched)
- **Only called for complex scenarios that deterministic rules can't handle**
- Not used for simple field validation or boundary tests
- Receives structured context, returns structured JSON validated against schema
- Adds business-context descriptions and edge-case suggestions
- All additions are tagged as INFERRED or EXPLORATORY

#### 7. TestCaseValidator (`src/engine/testCaseValidator.js`)
- Input: `TestCase[]`
- Output: `TestCase[]` (some rejected)
- Validation rules:
  1. Traceable to requirement or marked EXPLORATORY
  2. Mutations are valid JSON paths
  3. Expected results don't invent HTTP codes without evidence
  4. Single responsibility per test
  5. No contradictory expectations
  6. Classification is consistent with test data

#### 8. DeduplicationEngine (`src/engine/deduplicationEngine.js`)
- Input: `TestCase[]`
- Output: `TestCase[]` + dedup stats
- Dedup signature: `category|technique|field|mutation.operation|mutation.value|equivalencePartition`
- Two-phase: exact match (hash) → fuzzy match (same requirement + same partition + same field)
- Returns metrics: input count, removed count, final count

#### 9. CoverageEngine (`src/engine/coverageEngine.js`)
- Input: `TestCase[]` + `NormalizedRequirement[]`
- Output: Coverage report with traceability matrix
- Calculates: requirement coverage %, AC coverage %, field coverage %, type coverage %
- Builds requirement → test case mapping
- Flags requirements with NO_TEST, LOW_COVERAGE, FULL_COVERAGE

#### 10. PrioritizationEngine (`src/engine/prioritizationEngine.js`)
- Input: `TestCase[]` + generation metadata
- Output: `TestCase[]` (sorted, with priority set)
- Priority matrix:
  - EXPLICIT + POSITIVE → P1
  - EXPLICIT + NEGATIVE → P1
  - DERIVED + POSITIVE → P2
  - DERIVED + NEGATIVE → P2
  - INFERRED → P3
  - EXPLORATORY → P3
  - AUTH/SECURITY → P0/P1 based on context
  - BOUNDARY → P2
- Configurable per mode

#### 11. Orchestrator (`src/engine/orchestrator.js`)
- Coordinates the full pipeline
- Manages generation modes (SMOKE/STANDARD/COMPREHENSIVE)
- Collects metadata (token usage, latency, counts)
- Returns `GenerationSummary` + `TestCase[]`

---

## Phase 3: Data Models

### JiraRequirementInput
```typescript
{
  ticketKey: string;
  summary: string;
  description: string;
  acceptanceCriteria: string[];
  issueType: string;
  priority: string;
  labels: string[];
  comments: { author: string; body: string }[];
  metadata: Record<string, any>;
}
```

### AtomicRequirement
```typescript
{
  requirementId: string;         // "REQ-001"
  sourceText: string;            // Original text
  sourceType: "AC" | "DESCRIPTION" | "COMMENT" | "CONTRACT" | "OTHER";
  requirementType: RequirementType;
  subject: string;               // What field/endpoint/behavior this is about
  constraint?: RequirementConstraint;
  explicit: boolean;
  confidence: number;            // 0.0 - 1.0
}
```

### RequirementConstraint
```typescript
{
  dataType?: "string" | "number" | "integer" | "boolean" | "array" | "object";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  pattern?: string;             // regex
  enum?: any[];
  format?: string;              // "email", "date", "uri", etc.
  nullable?: boolean;
}
```

### RequirementGap
```typescript
{
  gapId: string;
  requirementId: string;
  type: GapType;                // "MISSING_BOUNDARY" | "MISSING_LENGTH" | "MISSING_ERROR" | ...
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}
```

### TestCondition
```typescript
{
  conditionId: string;
  requirementId: string;
  technique: "BVA" | "EP" | "DECISION_TABLE" | "STATE_TRANSITION" | "ERROR_GUESSING";
  category: "POSITIVE" | "NEGATIVE" | "BOUNDARY" | "EDGE";
  field: string;
  mutation?: PayloadMutation;
  expectedBehaviorDescription: string;
  equivalencePartition?: string;
}
```

### TestCase
```typescript
{
  testCaseId: string;
  title: string;
  description: string;
  classification: {
    category: "POSITIVE" | "NEGATIVE" | "BOUNDARY" | "EDGE" | "CONTRACT" | "SECURITY" | "WORKFLOW";
    technique: "BVA" | "EP" | "DECISION_TABLE" | "STATE_TRANSITION" | "ERROR_GUESSING" | "REQUIREMENT_BASED";
    origin: "EXPLICIT" | "DERIVED" | "INFERRED" | "EXPLORATORY";
    confidence: "HIGH" | "MEDIUM" | "LOW";
  };
  traceability: {
    jiraTicket: string;
    requirementIds: string[];
    acceptanceCriteria: string[];
  };
  preconditions: string[];
  request?: {
    method: string | null;
    endpoint: string | null;
    headers: Record<string, string>;
    queryParams: Record<string, string>;
    pathParams: Record<string, string>;
    basePayload: Record<string, any>;
    mutation: PayloadMutation | null;
  };
  testData: Record<string, any>;
  expected: {
    behavior: string;
    statusCode: number | null;
    bodyAssertions: string[];
    headerAssertions: string[];
    schemaAssertions: string[];
    requirementGap: string | null;
  };
  priority: "P0" | "P1" | "P2" | "P3";
  automation: { automatable: boolean; reason: string | null };
}
```

### PayloadMutation (extended from current)
```typescript
{
  operation: "ADD" | "REMOVE" | "REPLACE" | "SET_NULL" | "SET_EMPTY" | "CHANGE_TYPE" | "BOUNDARY_VALUE" | "INVALID_FORMAT" | "DUPLICATE" | "CUSTOM";
  path: string;                  // JSON path: "$.customer.address.zipCode"
  value?: any;
  description?: string;
}
```

### CoverageReport
```typescript
{
  requirementCoverage: number;     // percentage
  acceptanceCriteriaCoverage: number;
  byType: Record<string, { total: number; covered: number; coverage: number }>;
  traceabilityMatrix: { requirementId: string; testCaseIds: string[]; status: "NO_TEST" | "LOW_COVERAGE" | "FULL_COVERAGE" }[];
}
```

### GenerationSummary
```typescript
{
  ticket: string;
  mode: "SMOKE" | "STANDARD" | "COMPREHENSIVE";
  summary: {
    requirementsDetected: number;
    testCasesGenerated: number;
    byCategory: Record<string, number>;
    coverage: { requirementCoverage: number; acceptanceCriteriaCoverage: number };
    quality: { highConfidence: number; mediumConfidence: number; lowConfidence: number; duplicatesRemoved: number };
    requirementGaps: number;
  };
  metadata: {
    model: string;
    generationTimestamp: string;
    inputHash: string;
    tokenUsage?: { prompt: number; completion: number; total: number };
    latencyMs: number;
  };
  requirements: any[];
  requirementGaps: any[];
  testCases: TestCase[];
  traceabilityMatrix: any[];
}
```

---

## Phase 4: Implementation Plan

### Step 1: Create data model types
**Files**: `src/engine/types.js`
**Purpose**: Single source of truth for all pipeline data types
**Dependencies**: None
**Risk**: None (pure constants/empty structures)
**Test**: Verify type exports exist

### Step 2: Implement RequirementExtractor
**Files**: `src/engine/requirementExtractor.js`
**Purpose**: Parse arbitrary Jira text into atomic requirements
**Dependencies**: `types.js`, `acExtractor.js`
**Risk**: Low (deterministic pattern matching)
**Test**: Run against 3+ different ticket formats

### Step 3: Implement GapDetector
**Files**: `src/engine/gapDetector.js`
**Purpose**: Find missing specification details
**Dependencies**: `types.js`
**Risk**: Low (pure analysis, no generation)
**Test**: Verify it flags incomplete specs

### Step 4: Implement TestConditionEngine + TestDesignEngine
**Files**: `src/engine/testConditionEngine.js`, `src/engine/testDesignEngine.js`
**Purpose**: Apply BVA/EP/decision table techniques
**Dependencies**: `types.js`
**Risk**: Medium (core logic)
**Test**: Verify correct boundaries and partitions

### Step 5: Implement DeduplicationEngine + CoverageEngine + PrioritizationEngine
**Files**: `src/engine/deduplicationEngine.js`, `src/engine/coverageEngine.js`, `src/engine/prioritizationEngine.js`
**Purpose**: Post-generation processing
**Dependencies**: `types.js`
**Risk**: Low
**Test**: Verify dedup removes duplicates, coverage is accurate

### Step 6: Implement TestCaseValidator
**Files**: `src/engine/testCaseValidator.js`
**Purpose**: Validate each test case against quality criteria
**Dependencies**: `types.js`
**Risk**: Low
**Test**: Known-good and known-bad test cases

### Step 7: Implement Orchestrator
**Files**: `src/engine/orchestrator.js`
**Purpose**: Coordinate the full pipeline
**Dependencies**: All engine modules
**Risk**: Medium (integration)
**Test**: Full pipeline run against sample tickets

### Step 8: Implement structured LLM enhancer
**Files**: `src/engine/llmEnhancer.js`
**Purpose**: LLM-based scenario enrichment with validation
**Dependencies**: `types.js`, existing `llmClient.js`
**Risk**: Medium (LLM output parsing)
**Test**: Verify structured output with schema validation

### Step 9: Update API and frontend
**Files**: `src/server.js` (add new endpoint), `public/app.js` (add generation mode UI)
**Purpose**: Wire new engine into existing API
**Dependencies**: All engine modules
**Risk**: Low (additive change)
**Test**: End-to-end via browser

### Step 10: Deprecate old scenarioGenerator
**Files**: Keep `scenarioGenerator.js` for backward compatibility, new engine is parallel
**Purpose**: Safe migration
**Risk**: None

---

I'll now implement Step 1 and Step 2 — the types and the RequirementExtractor. This is the foundation everything else builds on.
