/**
 * ValidationScenarioService
 *
 * Frontend service for ValidationScenario CRUD operations.
 * Backend endpoints: /api/validation-scenarios
 */

import { apiClient } from "../../services/ApiClient";

export interface ValidationScenario {
  id: string;
  projectId: string;
  requirementId: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  confidence: number;
  status: "draft" | "needs-review" | "ready" | "approved" | "rejected";
  source: "manual" | "ai-generated";
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioProposal {
  requirementId: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  confidence: number;
}

export interface ScenarioGenerationResult {
  projectId: string;
  proposals: ScenarioProposal[];
  warning?: string;
  usedAi?: boolean;
}

export interface ScenarioStats {
  total: number;
  ready: number;
  draft: number;
  needsReview: number;
  approved: number;
  rejected: number;
  lastUpdated: string | null;
}

export interface ListScenariosOptions {
  search?: string;
  sort?: string;
  order?: string;
  status?: string;
  requirementId?: string;
}

/**
 * List validation scenarios for a project.
 */
export async function listValidationScenarios(
  projectId: string,
  options?: ListScenariosOptions
): Promise<ValidationScenario[]> {
  const params = new URLSearchParams({ projectId });
  if (options?.search) params.set("search", options.search);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.order) params.set("order", options.order);
  if (options?.status) params.set("status", options.status);
  if (options?.requirementId) params.set("requirementId", options.requirementId);

  const response = await apiClient.get<{ scenarios: ValidationScenario[] }>(
    `/api/validation-scenarios?${params.toString()}`
  );
  return response.scenarios;
}

/**
 * Get validation scenario stats for a project.
 */
export async function getValidationScenarioStats(projectId: string): Promise<ScenarioStats> {
  const response = await apiClient.get<{ stats: ScenarioStats }>(
    `/api/validation-scenarios/stats?projectId=${encodeURIComponent(projectId)}`
  );
  return response.stats;
}

/**
 * Get a single validation scenario by ID.
 */
export async function getValidationScenario(projectId: string, scenarioId: string): Promise<ValidationScenario> {
  const response = await apiClient.get<{ scenario: ValidationScenario }>(
    `/api/validation-scenarios/${encodeURIComponent(scenarioId)}?projectId=${encodeURIComponent(projectId)}`
  );
  return response.scenario;
}

/**
 * Create a new validation scenario.
 */
export async function createValidationScenario(
  projectId: string,
  data: Partial<ValidationScenario>
): Promise<ValidationScenario> {
  const response = await apiClient.post<{ scenario: ValidationScenario }>("/api/validation-scenarios", {
    projectId,
    ...data,
  });
  return response.scenario;
}

/**
 * Update an existing validation scenario.
 */
export async function updateValidationScenario(
  projectId: string,
  scenarioId: string,
  data: Partial<ValidationScenario>
): Promise<ValidationScenario> {
  const response = await apiClient.patch<{ scenario: ValidationScenario }>(
    `/api/validation-scenarios/${encodeURIComponent(scenarioId)}`,
    { projectId, ...data }
  );
  return response.scenario;
}

/**
 * Delete a validation scenario.
 */
export async function deleteValidationScenario(
  projectId: string,
  scenarioId: string
): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(
    `/api/validation-scenarios/${encodeURIComponent(scenarioId)}?projectId=${encodeURIComponent(projectId)}`
  );
}

/**
 * Bulk approve validation scenarios.
 */
export async function bulkApproveScenarios(
  projectId: string,
  scenarioIds: string[]
): Promise<ValidationScenario[]> {
  const response = await apiClient.post<{ scenarios: ValidationScenario[] }>(
    "/api/validation-scenarios/bulk-approve",
    { projectId, scenarioIds }
  );
  return response.scenarios;
}

/**
 * Bulk reject validation scenarios.
 */
export async function bulkRejectScenarios(
  projectId: string,
  scenarioIds: string[]
): Promise<ValidationScenario[]> {
  const response = await apiClient.post<{ scenarios: ValidationScenario[] }>(
    "/api/validation-scenarios/bulk-reject",
    { projectId, scenarioIds }
  );
  return response.scenarios;
}

/**
 * Get readiness validation for a scenario.
 */
export async function getScenarioReadiness(
  projectId: string,
  scenarioId: string
): Promise<{ valid: boolean; checks: Array<{ field: string; passed: boolean; message: string }>; overall: string }> {
  const response = await apiClient.get<{ readiness: { valid: boolean; checks: Array<{ field: string; passed: boolean; message: string }>; overall: string } }>(
    `/api/validation-scenarios/${encodeURIComponent(scenarioId)}/readiness?projectId=${encodeURIComponent(projectId)}`
  );
  return response.readiness;
}

/**
 * Generate validation scenarios from approved requirements via AI.
 */
export async function generateScenariosFromRequirements(
  projectId: string,
  requirementIds: string[]
): Promise<ScenarioGenerationResult> {
  const response = await apiClient.post<ScenarioGenerationResult>("/api/validation-scenarios/generate", {
    projectId,
    requirementIds,
  });
  return response;
}