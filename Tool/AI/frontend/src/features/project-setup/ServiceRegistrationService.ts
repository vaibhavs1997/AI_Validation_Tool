/**
 * ServiceRegistrationService
 *
 * Frontend service for registering API services under a project.
 * Backend endpoints: /api/services/register (POST), /api/services (GET)
 */

import { apiClient } from "../../services/ApiClient";
import type { ServiceDefinition, RegisterServiceResponse, ListServicesResponse, ApiModel } from "../../types";

/**
 * Register a service/API under a project from a parsed contract.
 */
export async function registerService(projectId: string, contract: unknown, serviceId?: string): Promise<RegisterServiceResponse> {
  const response = await apiClient.post<RegisterServiceResponse>("/api/services/register", {
    projectId,
    contract,
    serviceId,
  });
  return response;
}

/**
 * List all services for a project.
 */
export async function listServices(projectId: string): Promise<ServiceDefinition[]> {
  const response = await apiClient.get<ListServicesResponse>(`/api/services?projectId=${encodeURIComponent(projectId)}`);
  return response.services;
}

/**
 * Get a specific service with its API model.
 */
export async function getService(projectId: string, serviceId: string): Promise<{ service: ServiceDefinition; apiModel: ApiModel | null }> {
  const response = await apiClient.get<{ service: ServiceDefinition; apiModel: ApiModel | null }>(
    `/api/services/${encodeURIComponent(projectId)}/${encodeURIComponent(serviceId)}`
  );
  return response;
}