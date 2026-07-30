/**
 * RequirementWorkflow
 *
 * Shared workflow object for tracking the requirement analysis and
 * downstream artifact generation pipeline.
 *
 * This object is reused by downstream modules to maintain traceability
 * and avoid duplicate state.
 */

export interface RequirementWorkflow {
  // Core identifiers
  requirementId: string;
  projectId: string;

  // Step 1: Requirement Input
  requirement: {
    title: string;
    description: string;
    acceptanceCriteria: string[];
    businessRules: string[];
    priority: "low" | "medium" | "high" | "critical";
    status: "draft" | "needs-review" | "ready";
    source: "manual" | "paste" | "upload" | "jira";
    fileName?: string;
  };

  // Step 2: AI Analysis
  analysis: {
    completed: boolean;
    acceptanceCriteria: string[];
    businessRules: string[];
    positivePaths: string[];
    negativePaths: string[];
    edgeCases: string[];
    dependencies: string[];
    testableStatements: string[];
    analyzedAt?: string;
  };

  // Step 3: Generated Test Cases
  generatedTests: {
    completed: boolean;
    testCases: Array<{
      id: string;
      title: string;
      description: string;
      type: "positive" | "negative";
      priority: "low" | "medium" | "high" | "critical";
      acceptanceCriteriaRef: string[];
      expectedStatusCode?: number;
      tags: string[];
    }>;
    generatedAt?: string;
  };

  // Step 3: User Selection
  selectedTests: {
    testCaseIds: string[];
    selectedAt?: string;
  };

  // Step 4: API Matching
  apiMatches: {
    completed: boolean;
    matches: Array<{
      testCaseId: string;
      matchedApi?: {
        serviceId: string;
        serviceName: string;
        operationId: string;
        operationName: string;
        method: string;
        path: string;
        confidence: number;
      };
      suggestedApi?: {
        serviceId: string;
        serviceName: string;
        operationId: string;
        operationName: string;
        method: string;
        path: string;
        confidence: number;
      };
      status: "matched" | "review-required" | "unmatched";
      authentication?: string;
      dependencies: string[];
    }>;
    matchedAt?: string;
  };

  // Step 5: Draft Validation Scenarios
  draftValidationScenarioIds: string[];
  scenariosGeneratedAt?: string;

  // Workflow metadata
  status: "in-progress" | "ready-for-validation" | "completed";
  currentStep: 1 | 2 | 3 | 4 | 5;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Create an empty workflow object
 */
export function createEmptyWorkflow(requirementId: string, projectId: string): RequirementWorkflow {
  return {
    requirementId,
    projectId,
    requirement: {
      title: "",
      description: "",
      acceptanceCriteria: [],
      businessRules: [],
      priority: "medium",
      status: "draft",
      source: "manual",
    },
    analysis: {
      completed: false,
      acceptanceCriteria: [],
      businessRules: [],
      positivePaths: [],
      negativePaths: [],
      edgeCases: [],
      dependencies: [],
      testableStatements: [],
    },
    generatedTests: {
      completed: false,
      testCases: [],
    },
    selectedTests: {
      testCaseIds: [],
    },
    apiMatches: {
      completed: false,
      matches: [],
    },
    draftValidationScenarioIds: [],
    status: "in-progress",
    currentStep: 1,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update workflow step and timestamp
 */
export function updateWorkflowStep(
  workflow: RequirementWorkflow,
  step: RequirementWorkflow["currentStep"]
): RequirementWorkflow {
  return {
    ...workflow,
    currentStep: step,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Mark workflow as ready for validation
 */
export function markReadyForValidation(workflow: RequirementWorkflow): RequirementWorkflow {
  return {
    ...workflow,
    status: "ready-for-validation",
    currentStep: 5,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}