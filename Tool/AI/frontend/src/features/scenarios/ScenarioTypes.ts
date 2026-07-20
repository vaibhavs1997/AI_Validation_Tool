import type { ApiEndpoint, ApiContract } from "../api-collection/ApiCollectionTypes";

// ─── Scenario type/category ────────────────────────────────────────────────
// Verified against scenarioGenerator.js: buildScenario() overrides set type
// from createTestCasesFromTicket(): "positive", "negative", "auth"
export type ScenarioType = "positive" | "negative" | "auth";

// ─── Risk level ────────────────────────────────────────────────────────────
// Verified against scenarioGenerator.js: buildScenario() defaults to "medium",
// overrides from createTestCasesFromTicket(): "low", "medium", "high"
export type ScenarioRisk = "low" | "medium" | "high";

// ─── Match confidence level ────────────────────────────────────────────────
// Verified against matchingEngine.js → confidenceAnalyzer.js:
// "HIGH" (>=0.75), "MEDIUM" (>=0.50), "LOW" (>=0.25), "NONE" (<0.25)
export type MatchConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

// ─── Mutation operation ────────────────────────────────────────────────────
// Verified against scenarioGenerator.js: deriveMutationFromRule() and
// testConditionEngine.js produce these operation values
export type MutationOperation =
  | "boundaryMax"
  | "boundaryMin"
  | "remove"
  | "invalidType"
  | "duplicate"
  | "boundary"
  | "invalidFormat"
  | "replace"
  | "maxLengthExceeded";

// ─── Mutation structure ────────────────────────────────────────────────────
// Verified against scenarioGenerator.js: deriveMutationFromRule() returns
// { field, operation, value } objects
export interface ScenarioMutation {
  field: string;
  operation: MutationOperation;
  value?: unknown;
}

// ─── Scenario model ────────────────────────────────────────────────────────
// Verified against scenarioGenerator.js: buildScenario() + overrides from
// assignEndpointsToTestCases() + createUnlinkedScenario()
export interface Scenario {
  /** Unique scenario identifier (e.g. "createUser-TC-001") */
  id: string;
  /** Matched endpoint ID, or null if unlinked */
  endpointId: string | null;
  /** HTTP method (from matched endpoint or inferred) */
  method: string;
  /** API path (from matched endpoint or "/" if unlinked) */
  path: string;
  /** Human-readable scenario title */
  title: string;
  /** Scenario category: positive, negative, or auth */
  type: ScenarioType;
  /** Risk level assigned during generation */
  risk: ScenarioRisk;
  /** Source acceptance criterion text that produced this scenario */
  sourceAc: string;
  /** Expected HTTP status code for this scenario */
  expectedStatus: number;
  /** Sample payload generated from the endpoint's request schema */
  basePayload: Record<string, unknown>;
  /** Payload mutations to apply for negative/edge testing */
  mutations: ScenarioMutation[];
  /** Expected response assertions as human-readable strings */
  assertions: string[];
  /** Match score (0-100) from the matching engine */
  matchScore?: number;
  /** Human-readable reasons for the match */
  matchReasons?: string[];
  /** Confidence level from the matching engine */
  matchConfidence?: MatchConfidence;
  /** Whether the match was ambiguous (top 2 candidates too close) */
  matchAmbiguous?: boolean;
  /** Whether this match needs human review */
  matchNeedsReview?: boolean;
  /** Whether this scenario requires human review */
  needsHumanReview?: boolean;
  /** Whether this scenario has no linked endpoint */
  unlinked?: boolean;
}

// ─── Generate request ──────────────────────────────────────────────────────
// Verified against server.js line 149-156 and scenarioGenerator.js line 569
// The backend receives { ticket, contract, useAi }
// ticket is the raw Jira ticket object (not wrapped in ActiveRequirement)
// contract is the raw API contract object (ApiContract)
export interface GenerateScenariosRequest {
  /** Ticket object with key, summary, description, acceptanceCriteria */
  ticket: {
    key?: string;
    summary?: string;
    description?: string;
    acceptanceCriteria?: string[];
    [key: string]: unknown;
  };
  /** Parsed API contract */
  contract: ApiContract | { endpoints: ApiEndpoint[] };
  /** Whether to use AI enhancement (defaults to false) */
  useAi?: boolean;
}

// ─── Generate response ─────────────────────────────────────────────────────
// Verified against scenarioGenerator.js line 586-604
// mode is always "local" (AI path returns "local" with a warning)
export interface GenerateScenariosResponse {
  /** Generated scenarios */
  scenarios: Scenario[];
  /** Endpoints that were not matched to any scenario */
  unusedEndpoints: ApiEndpoint[];
  /** Generation mode — always "local" in current implementation */
  mode: "local";
  /** Warnings from the generation process */
  warnings?: string[];
}