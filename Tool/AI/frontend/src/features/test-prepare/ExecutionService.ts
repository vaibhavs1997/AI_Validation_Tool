/**
 * ExecutionService
 *
 * STEP 5.7 — Frontend service for executing prepared TestSpecifications
 * with their ExecutionPlans via the dependency-aware execution backend.
 *
 * Calls POST /api/runs/execute-dependent
 *
 * Does NOT call legacy /api/runs/execute
 * Does NOT silently modify TestSpecification or ExecutionPlan
 */

import { apiClient } from "../../services";

/**
 * Response from POST /api/runs/execute-dependent
 */
export interface ExecuteDependentResponse {
  specId: string;
  spec: {
    title: string;
    description: string;
  };
  status: "passed" | "failed";
  results: Array<{
    step: number;
    operation: {
      serviceId: string;
      operationId: string;
      method?: string;
      path?: string;
    };
    status: "passed" | "failed" | "blocked";
    response?: {
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: unknown;
    } | null;
    request?: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body: unknown;
    } | null;
    error?: string;
    validation?: {
      assertions: string[];
      passed: boolean;
      failed: boolean;
    };
  }>;
  errors: string[];
  success: boolean;
  /** Persisted run ID for navigation to ResultsPage */
  runId?: string;
  /** Persisted run metadata */
  run?: {
    id: string;
    projectId: string;
  };
}

export interface ExecuteDependentRequest {
  projectId: string;
  testSpecification: unknown;
  executionPlan: unknown;
  environment?: {
    variables?: Record<string, string>;
  };
}

/**
 * Execute a prepared TestSpecification with its ExecutionPlan.
 *
 * @param request - The execution request containing prepared artifacts
 * @returns Execution results with step-by-step status
 */
export async function executePreparedTest(
  request: ExecuteDependentRequest
): Promise<ExecuteDependentResponse> {
  const response = await apiClient.post<ExecuteDependentResponse>(
    "/api/runs/execute-dependent",
    request
  );
  return response;
}