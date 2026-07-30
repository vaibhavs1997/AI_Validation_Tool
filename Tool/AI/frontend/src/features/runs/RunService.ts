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
import type { RunSummary, RunDetail, ListRunsResponse, GetRunResponse } from "../../types";

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