/**
 * RunService
 *
 * STEP 5.8 — Frontend service for fetching persisted runs
 * from the active TestCase-first workflow.
 *
 * Calls:
 *   GET /api/active/runs?projectId={projectId} — list run summaries
 *   GET /api/active/runs/:runId?projectId={projectId} — get full run detail
 */

import { apiClient } from "../../services";

export interface RunSummary {
  id: string;
  projectId: string;
  testSpecificationId: string;
  title: string;
  description: string;
  status: "passed" | "failed" | "unknown";
  targetServiceId: string;
  targetOperationId: string;
  stepCount: number;
  passedSteps: number;
  failedSteps: number;
  blockedSteps: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface RunDetail {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: "passed" | "failed" | "unknown";
  testSpecification: {
    id: string;
    title: string;
    description: string;
    requirementRefs: Array<{ acIndex: number; acText?: string }>;
    operationRefs: Array<{ serviceId?: string; operationId?: string; method?: string; path?: string }>;
    expectedBehavior: { status: number; responseAssertions: string[] };
  };
  executionPlanSummary: {
    target: { serviceId?: string; operationId?: string };
    stepCount: number;
    operations: Array<{ serviceId: string; operationId: string; method?: string; path?: string }>;
  };
  targetOperation: { serviceId?: string; operationId?: string };
  results: Array<{
    step: number;
    operation: { serviceId: string; operationId: string; method?: string; path?: string };
    status: "passed" | "failed" | "blocked";
    request?: unknown;
    response?: unknown;
    validation?: unknown;
    error?: string;
  }>;
  errors: string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface ListRunsResponse {
  runs: RunSummary[];
}

export interface GetRunResponse {
  run: RunDetail;
}

/**
 * List run summaries for a project (newest first).
 */
export async function listRuns(projectId: string): Promise<RunSummary[]> {
  const response = await apiClient.get<ListRunsResponse>(
    `/api/active/runs?projectId=${encodeURIComponent(projectId)}`
  );
  return response.runs;
}

/**
 * Get full run details by projectId and runId.
 */
export async function getRun(projectId: string, runId: string): Promise<RunDetail> {
  const response = await apiClient.get<GetRunResponse>(
    `/api/active/runs/${encodeURIComponent(runId)}?projectId=${encodeURIComponent(projectId)}`
  );
  return response.run;
}