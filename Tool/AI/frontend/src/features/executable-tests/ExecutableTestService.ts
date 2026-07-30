/**
 * ExecutableTestService
 *
 * Frontend service for ExecutableTest CRUD operations.
 * Backend endpoints: /api/executable-tests
 */

import { apiClient } from "../../services/ApiClient";

export interface ExecutableTest {
  id: string;
  projectId: string;
  mappingId?: string;
  scenarioId?: string;
  requirementId?: string;
  title: string;
  description: string;
  scenario: string;
  mappedApis: Array<{
    serviceId?: string;
    operationId?: string;
    method?: string;
    path?: string;
  }>;
  executionSteps: Array<{
    step: number;
    description: string;
    operationRef?: {
      serviceId?: string;
      operationId?: string;
    };
    headers?: Record<string, string>;
    body?: any;
  }>;
  headers: Record<string, string>;
  variables: Record<string, string>;
  requestBody?: any;
  assertions: Array<{
    type: string;
    field?: string;
    expected?: any;
    operator?: string;
  }>;
  expectedStatusCode: number;
  expectedResponse?: any;
  dependencies: string[];
  priority: "low" | "medium" | "high" | "critical";
  confidence: number;
  status: "draft" | "needs-review" | "ready" | "approved" | "rejected";
  source: "manual" | "ai-generated";
  createdAt: string;
  updatedAt: string;
}

export interface TestProposal {
  mappingId?: string;
  requirementId?: string;
  scenarioId?: string;
  title: string;
  description: string;
  scenario: string;
  mappedApis: Array<{
    serviceId?: string;
    operationId?: string;
    method?: string;
    path?: string;
  }>;
  executionSteps: Array<{
    step: number;
    description: string;
    operationRef?: {
      serviceId?: string;
      operationId?: string;
    };
    headers?: Record<string, string>;
    body?: any;
  }>;
  headers: Record<string, string>;
  variables: Record<string, string>;
  requestBody?: any;
  assertions: Array<{
    type: string;
    field?: string;
    expected?: any;
    operator?: string;
  }>;
  expectedStatusCode: number;
  expectedResponse?: any;
  dependencies: string[];
  priority: "low" | "medium" | "high" | "critical";
  confidence: number;
}

export interface TestGenerationResult {
  projectId: string;
  proposals: TestProposal[];
  warning?: string;
  usedAi?: boolean;
}

export interface TestStats {
  total: number;
  ready: number;
  draft: number;
  needsReview: number;
  approved: number;
  rejected: number;
  lastUpdated: string | null;
}

export interface ListTestsOptions {
  search?: string;
  sort?: string;
  order?: string;
  status?: string;
  mappingId?: string;
  scenarioId?: string;
  requirementId?: string;
}

/**
 * List executable tests for a project.
 */
export async function listExecutableTests(
  projectId: string,
  options?: ListTestsOptions
): Promise<ExecutableTest[]> {
  const params = new URLSearchParams({ projectId });
  if (options?.search) params.set("search", options.search);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.order) params.set("order", options.order);
  if (options?.status) params.set("status", options.status);
  if (options?.mappingId) params.set("mappingId", options.mappingId);
  if (options?.scenarioId) params.set("scenarioId", options.scenarioId);
  if (options?.requirementId) params.set("requirementId", options.requirementId);

  const response = await apiClient.get<{ tests: ExecutableTest[] }>(
    `/api/executable-tests?${params.toString()}`
  );
  return response.tests;
}

/**
 * Get executable test stats for a project.
 */
export async function getExecutableTestStats(projectId: string): Promise<TestStats> {
  const response = await apiClient.get<{ stats: TestStats }>(
    `/api/executable-tests/stats?projectId=${encodeURIComponent(projectId)}`
  );
  return response.stats;
}

/**
 * Get a single executable test by ID.
 */
export async function getExecutableTest(projectId: string, testId: string): Promise<ExecutableTest> {
  const response = await apiClient.get<{ test: ExecutableTest }>(
    `/api/executable-tests/${encodeURIComponent(testId)}?projectId=${encodeURIComponent(projectId)}`
  );
  return response.test;
}

/**
 * Create a new executable test.
 */
export async function createExecutableTest(
  projectId: string,
  data: Partial<ExecutableTest>
): Promise<ExecutableTest> {
  const response = await apiClient.post<{ test: ExecutableTest }>("/api/executable-tests", {
    projectId,
    ...data,
  });
  return response.test;
}

/**
 * Update an existing executable test.
 */
export async function updateExecutableTest(
  projectId: string,
  testId: string,
  data: Partial<ExecutableTest>
): Promise<ExecutableTest> {
  const response = await apiClient.patch<{ test: ExecutableTest }>(
    `/api/executable-tests/${encodeURIComponent(testId)}`,
    { projectId, ...data }
  );
  return response.test;
}

/**
 * Delete an executable test.
 */
export async function deleteExecutableTest(
  projectId: string,
  testId: string
): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(
    `/api/executable-tests/${encodeURIComponent(testId)}?projectId=${encodeURIComponent(projectId)}`
  );
}

/**
 * Bulk approve executable tests.
 */
export async function bulkApproveTests(
  projectId: string,
  testIds: string[]
): Promise<ExecutableTest[]> {
  const response = await apiClient.post<{ tests: ExecutableTest[] }>(
    "/api/executable-tests/bulk-approve",
    { projectId, testIds }
  );
  return response.tests;
}

/**
 * Bulk reject executable tests.
 */
export async function bulkRejectTests(
  projectId: string,
  testIds: string[]
): Promise<ExecutableTest[]> {
  const response = await apiClient.post<{ tests: ExecutableTest[] }>(
    "/api/executable-tests/bulk-reject",
    { projectId, testIds }
  );
  return response.tests;
}

/**
 * Generate executable test proposals from approved requirements, scenarios, and mappings via AI.
 */
export async function generateExecutableTests(
  projectId: string,
  mappingIds?: string[]
): Promise<TestGenerationResult> {
  const response = await apiClient.post<TestGenerationResult>("/api/executable-tests/generate", {
    projectId,
    mappingIds: mappingIds || [],
  });
  return response;
}