/**
 * ImplementationMappingService
 *
 * Frontend service for ImplementationMapping CRUD operations.
 * Backend endpoints: /api/implementation-mappings
 */

import { apiClient } from "../../services/ApiClient";

export interface ImplementationMapping {
  id: string;
  projectId: string;
  scenarioId: string;
  requirementId?: string;
  title: string;
  description: string;
  candidateApis: Array<{
    serviceId?: string;
    operationId?: string;
    method?: string;
    path?: string;
  }>;
  executionOrder: "sequential" | "parallel";
  authenticationRequired: boolean;
  authenticationDetails: string;
  requestDependencies: string[];
  variablesRequired: string[];
  executionFlow: Array<{
    step: number;
    description: string;
    operationRef?: {
      serviceId?: string;
      operationId?: string;
    };
  }>;
  confidence: number;
  reasoning: string;
  status: "draft" | "needs-review" | "ready" | "approved" | "rejected";
  source: "manual" | "ai-generated";
  createdAt: string;
  updatedAt: string;
}

export interface MappingProposal {
  scenarioId: string;
  requirementId?: string;
  title: string;
  description: string;
  candidateApis: Array<{
    serviceId?: string;
    operationId?: string;
    method?: string;
    path?: string;
  }>;
  executionOrder: "sequential" | "parallel";
  authenticationRequired: boolean;
  authenticationDetails: string;
  requestDependencies: string[];
  variablesRequired: string[];
  executionFlow: Array<{
    step: number;
    description: string;
    operationRef?: {
      serviceId?: string;
      operationId?: string;
    };
  }>;
  confidence: number;
  reasoning: string;
}

export interface MappingAnalysisResult {
  projectId: string;
  proposals: MappingProposal[];
  warning?: string;
  usedAi?: boolean;
}

export interface MappingStats {
  total: number;
  ready: number;
  draft: number;
  needsReview: number;
  approved: number;
  rejected: number;
  lastUpdated: string | null;
}

export interface ListMappingsOptions {
  search?: string;
  sort?: string;
  order?: string;
  status?: string;
  scenarioId?: string;
  requirementId?: string;
}

/**
 * List implementation mappings for a project.
 */
export async function listImplementationMappings(
  projectId: string,
  options?: ListMappingsOptions
): Promise<ImplementationMapping[]> {
  const params = new URLSearchParams({ projectId });
  if (options?.search) params.set("search", options.search);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.order) params.set("order", options.order);
  if (options?.status) params.set("status", options.status);
  if (options?.scenarioId) params.set("scenarioId", options.scenarioId);
  if (options?.requirementId) params.set("requirementId", options.requirementId);

  const response = await apiClient.get<{ mappings: ImplementationMapping[] }>(
    `/api/implementation-mappings?${params.toString()}`
  );
  return response.mappings;
}

/**
 * Get implementation mapping stats for a project.
 */
export async function getImplementationMappingStats(projectId: string): Promise<MappingStats> {
  const response = await apiClient.get<{ stats: MappingStats }>(
    `/api/implementation-mappings/stats?projectId=${encodeURIComponent(projectId)}`
  );
  return response.stats;
}

/**
 * Get a single implementation mapping by ID.
 */
export async function getImplementationMapping(projectId: string, mappingId: string): Promise<ImplementationMapping> {
  const response = await apiClient.get<{ mapping: ImplementationMapping }>(
    `/api/implementation-mappings/${encodeURIComponent(mappingId)}?projectId=${encodeURIComponent(projectId)}`
  );
  return response.mapping;
}

/**
 * Create a new implementation mapping.
 */
export async function createImplementationMapping(
  projectId: string,
  data: Partial<ImplementationMapping>
): Promise<ImplementationMapping> {
  const response = await apiClient.post<{ mapping: ImplementationMapping }>("/api/implementation-mappings", {
    projectId,
    ...data,
  });
  return response.mapping;
}

/**
 * Update an existing implementation mapping.
 */
export async function updateImplementationMapping(
  projectId: string,
  mappingId: string,
  data: Partial<ImplementationMapping>
): Promise<ImplementationMapping> {
  const response = await apiClient.patch<{ mapping: ImplementationMapping }>(
    `/api/implementation-mappings/${encodeURIComponent(mappingId)}`,
    { projectId, ...data }
  );
  return response.mapping;
}

/**
 * Delete an implementation mapping.
 */
export async function deleteImplementationMapping(
  projectId: string,
  mappingId: string
): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(
    `/api/implementation-mappings/${encodeURIComponent(mappingId)}?projectId=${encodeURIComponent(projectId)}`
  );
}

/**
 * Bulk approve implementation mappings.
 */
export async function bulkApproveMappings(
  projectId: string,
  mappingIds: string[]
): Promise<ImplementationMapping[]> {
  const response = await apiClient.post<{ mappings: ImplementationMapping[] }>(
    "/api/implementation-mappings/bulk-approve",
    { projectId, mappingIds }
  );
  return response.mappings;
}

/**
 * Bulk reject implementation mappings.
 */
export async function bulkRejectMappings(
  projectId: string,
  mappingIds: string[]
): Promise<ImplementationMapping[]> {
  const response = await apiClient.post<{ mappings: ImplementationMapping[] }>(
    "/api/implementation-mappings/bulk-reject",
    { projectId, mappingIds }
  );
  return response.mappings;
}

/**
 * Generate implementation mapping proposals from approved requirements and scenarios via AI.
 */
export async function analyzeImplementationMappings(
  projectId: string
): Promise<MappingAnalysisResult> {
  const response = await apiClient.post<MappingAnalysisResult>("/api/implementation-mappings/analyze", {
    projectId,
  });
  return response;
}