/**
 * Requirement source type - distinguishes between requirement input methods
 */
export type RequirementSource = "manual" | "paste" | "upload" | "jira";

/**
 * Common base fields shared by all requirement types
 */
export interface RequirementBase {
  /** Unique identifier for the requirement */
  key: string;
  /** Short summary/title */
  summary: string;
  /** Full description text */
  description: string;
  /** Acceptance criteria extracted from description */
  acceptanceCriteria: string[];
  /** Timestamp when requirement was loaded */
  fetchedAt: string;
}

/**
 * Jira comment structure as returned by backend
 */
export interface JiraComment {
  author: string;
  created: string;
  body: string;
}

/**
 * Jira-specific requirement data
 */
export interface JiraRequirement extends RequirementBase {
  source: "jira";
  id: string;
  url: string;
  issueType: string;
  status: string;
  priority: string;
  labels: string[];
  comments: JiraComment[];
}

/**
 * Manual requirement data
 */
export interface ManualRequirement extends RequirementBase {
  source: "manual";
}

/**
 * Union type for any requirement
 */
export type Requirement = JiraRequirement | ManualRequirement;

/**
 * Loading state for Jira-specific UI
 */
export interface JiraRequirementState {
  inputKey: string;
  fetched: boolean;
  error: boolean;
  loading: boolean;
}

/**
 * State for Manual-specific UI
 */
export interface ManualRequirementState {
  entered: boolean;
  error: boolean;
  draft: string;
}

/**
 * Loading status state
 */
export type RequirementLoadStatus = "idle" | "loading" | "success" | "error";

/**
 * Active confirmed requirement for the validation workflow
 */
export interface ActiveRequirement {
  source: RequirementSource;
  requirement: Requirement | null;
}

/**
 * Workflow step identifiers
 */
export type WorkflowStep = 1 | 2 | 3 | 4 | 5;

/**
 * Workflow status
 */
export type WorkflowStatus = "in-progress" | "ready-for-validation" | "completed";

/**
 * Test case in the workflow
 */
export interface WorkflowTestCase {
  id: string;
  title: string;
  description: string;
  type: "positive" | "negative";
  priority: "low" | "medium" | "high" | "critical";
  acceptanceCriteriaRef: string[];
  expectedResult: string;
  expectedStatusCode: number | null;
  tags: string[];
  risk: "low" | "medium" | "high";
  confidenceScore: number | null;
  approved: boolean;
}

/**
 * API match in the workflow
 */
export interface WorkflowApiMatch {
  testCaseId: string;
  testCaseTitle: string;
  matchedApi?: {
    serviceId: string;
    serviceName: string;
    operationId: string;
    operationName: string;
    method: string;
    path: string;
    authentication: string;
    confidence: number;
  };
  suggestedApi?: {
    serviceId: string;
    serviceName: string;
    operationId: string;
    operationName: string;
    method: string;
    path: string;
    authentication: string;
    confidence: number;
  };
  status: "matched" | "review-required" | "unmatched";
  authentication: string;
  dependencies: string[];
}

/**
 * Full RequirementWorkflow from backend
 */
export interface RequirementWorkflow {
  workflowId: string;
  projectId: string;
  requirementId: string;
  requirement: {
    title: string;
    description: string;
    acceptanceCriteria: string[];
    businessRules: string[];
    priority: "low" | "medium" | "high" | "critical";
    labels: string[];
    epic: string;
    story: string;
    dependencies: string[];
    risk: "low" | "medium" | "high" | "critical";
    status: "draft" | "needs-review" | "ready";
    source: RequirementSource;
    fileName: string | null;
  };
  analysis: {
    completed: boolean;
    acceptanceCriteria: string[];
    businessRules: string[];
    positivePaths: string[];
    negativePaths: string[];
    edgeCases: string[];
    preconditions: string[];
    postconditions: string[];
    dependencies: string[];
    assumptions: string[];
    missingInformation: string[];
    ambiguities: string[];
    analyzedAt: string | null;
  };
  generatedTests: {
    completed: boolean;
    testCases: WorkflowTestCase[];
    generatedAt: string | null;
  };
  selectedTests: {
    testCaseIds: string[];
    selectedAt: string | null;
  };
  apiMatches: {
    completed: boolean;
    matches: WorkflowApiMatch[];
    matchedAt: string | null;
  };
  approvedMappings: {
    completed: boolean;
    mappings: string[];
    approvedAt: string | null;
  };
  draftValidationScenarioIds: string[];
  scenariosGeneratedAt: string | null;
  status: WorkflowStatus;
  currentStep: WorkflowStep;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  auditHistory: Array<{
    action: string;
    timestamp: string;
    userId: string;
    details: Record<string, unknown>;
  }>;
}

/**
 * Coverage summary
 */
export interface WorkflowSummary {
  acceptanceCriteriaCount: number;
  generatedTestCount: number;
  approvedTestCount: number;
  matchedApiCount: number;
  totalApiMatches: number;
  readiness: number;
  confidence: number;
  status: WorkflowStatus;
  currentStep: WorkflowStep;
}

/**
 * Helper to determine if a requirement is Jira-sourced
 */
export function isJiraRequirement(req: Requirement | null): req is JiraRequirement {
  return req?.source === "jira";
}

/**
 * Helper to determine if a requirement is Manual-sourced
 */
export function isManualRequirement(req: Requirement | null): req is ManualRequirement {
  return req?.source === "manual";
}