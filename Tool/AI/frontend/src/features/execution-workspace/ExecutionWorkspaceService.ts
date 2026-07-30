/**
 * ExecutionWorkspaceService
 *
 * Frontend service for Execution Workspace operations.
 * Backend endpoints: /api/execution-runs
 */

import { apiClient } from "../../services/ApiClient";

export type ExecutionStatus = "pending" | "planned" | "running" | "passed" | "failed" | "blocked" | "skipped" | "cancelled" | "completed";

export interface ExecutionStep {
  id: string;
  testId: string;
  title: string;
  description: string;
  order: number;
  status: ExecutionStatus;
  dependencies: string[];
  executionTime?: number;
  log?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  variables?: Record<string, string>;
  authentication?: Record<string, unknown>;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  totalSteps: number;
  executionOrder: string[];
  warnings: string[];
  variables: Record<string, string>;
  authentication: Record<string, unknown>;
  environment: Record<string, unknown>;
  estimatedSteps: number;
  dependencies: Record<string, string[]>;
}

export interface ExecutionRun {
  id: string;
  projectId: string;
  name: string;
  status: ExecutionStatus;
  plan: ExecutionPlan | null;
  steps: ExecutionStep[];
  logs: string[];
  variables: Record<string, string>;
  authentication: Record<string, unknown>;
  environment: Record<string, unknown>;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  approved: boolean;
}

export interface RunStats {
  total: number;
  pending: number;
  planned: number;
  running: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  cancelled: number;
  completed: number;
  lastUpdated: string | null;
}

export interface CreateRunData {
  name?: string;
  variables?: Record<string, string>;
  authentication?: Record<string, unknown>;
  environment?: Record<string, unknown>;
}

export interface BuildPlanData {
  variables?: Record<string, string>;
  authentication?: Record<string, unknown>;
  environment?: Record<string, unknown>;
}

export interface ExecuteRunData {
  dryRun?: boolean;
  environment?: Record<string, unknown>;
}

/**
 * List execution runs for a project.
 */
export async function listExecutionRuns(projectId: string): Promise<ExecutionRun[]> {
  const response = await apiClient.get<{ runs: ExecutionRun[] }>(
    `/api/execution-runs?projectId=${encodeURIComponent(projectId)}`
  );
  return response.runs;
}

/**
 * Get execution run stats for a project.
 */
export async function getExecutionRunStats(projectId: string): Promise<RunStats> {
  const response = await apiClient.get<{ stats: RunStats }>(
    `/api/execution-runs/stats?projectId=${encodeURIComponent(projectId)}`
  );
  return response.stats;
}

/**
 * Get a single execution run by ID.
 */
export async function getExecutionRun(projectId: string, runId: string): Promise<ExecutionRun> {
  const response = await apiClient.get<{ run: ExecutionRun }>(
    `/api/execution-runs/${encodeURIComponent(runId)}?projectId=${encodeURIComponent(projectId)}`
  );
  return response.run;
}

/**
 * Create a new execution run.
 */
export async function createExecutionRun(
  projectId: string,
  data: CreateRunData
): Promise<ExecutionRun> {
  const response = await apiClient.post<{ run: ExecutionRun }>("/api/execution-runs", {
    projectId,
    ...data,
  });
  return response.run;
}

/**
 * Delete an execution run.
 */
export async function deleteExecutionRun(
  projectId: string,
  runId: string
): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(
    `/api/execution-runs/${encodeURIComponent(runId)}?projectId=${encodeURIComponent(projectId)}`
  );
}

/**
 * Build or rebuild the execution plan for a run.
 */
export async function buildExecutionPlan(
  projectId: string,
  runId: string,
  data: BuildPlanData
): Promise<ExecutionRun> {
  const response = await apiClient.post<{ run: ExecutionRun }>(
    `/api/execution-runs/${encodeURIComponent(runId)}/build-plan`,
    { projectId, ...data }
  );
  return response.run;
}

/**
 * Rebuild the execution plan for a run.
 */
export async function rebuildExecutionPlan(
  projectId: string,
  runId: string,
  data: BuildPlanData
): Promise<ExecutionRun> {
  const response = await apiClient.post<{ run: ExecutionRun }>(
    `/api/execution-runs/${encodeURIComponent(runId)}/rebuild-plan`,
    { projectId, ...data }
  );
  return response.run;
}

/**
 * Execute a run (real or dry run).
 */
export async function executeExecutionRun(
  projectId: string,
  runId: string,
  data: ExecuteRunData
): Promise<ExecutionRun> {
  const response = await apiClient.post<{ run: ExecutionRun }>(
    `/api/execution-runs/${encodeURIComponent(runId)}/execute`,
    { projectId, ...data }
  );
  return response.run;
}

/**
 * Dry run a run (no actual execution).
 */
export async function dryRunExecutionRun(
  projectId: string,
  runId: string,
  data: ExecuteRunData
): Promise<ExecutionRun> {
  const response = await apiClient.post<{ run: ExecutionRun }>(
    `/api/execution-runs/${encodeURIComponent(runId)}/dry-run`,
    { projectId, ...data }
  );
  return response.run;
}

/**
 * Cancel a running execution run.
 */
export async function cancelExecutionRun(
  projectId: string,
  runId: string
): Promise<ExecutionRun> {
  const response = await apiClient.post<{ run: ExecutionRun }>(
    `/api/execution-runs/${encodeURIComponent(runId)}/cancel`,
    { projectId }
  );
  return response.run;
}
