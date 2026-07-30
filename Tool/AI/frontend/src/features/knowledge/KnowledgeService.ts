/**
 * KnowledgeService
 *
 * Enhanced frontend service for the Knowledge Engine.
 * Reuses existing backend endpoints.
 *
 * Backend endpoints:
 *   GET  /api/knowledge?projectId=...
 *   POST /api/knowledge/instructions
 *   GET  /api/knowledge/relationships/:status
 *   POST /api/knowledge/relationships/confirm
 *   POST /api/knowledge/relationships/reject
 *   GET  /api/services?projectId=...
 *   GET  /api/services/:projectId/:serviceId
 */

import { apiClient } from "../../services/ApiClient";
import type {
  ProjectKnowledge,
  KnowledgeRelationship,
  ServiceDefinition,
  ApiModel,
} from "../../types";

/**
 * Get project knowledge (instructions + relationships).
 */
export async function getProjectKnowledge(projectId: string): Promise<ProjectKnowledge | null> {
  const response = await apiClient.get<{ knowledge: ProjectKnowledge | null }>(
    `/api/knowledge?projectId=${encodeURIComponent(projectId)}`
  );
  return response.knowledge || null;
}

/**
 * Update project instructions and trigger knowledge analysis.
 */
export async function updateInstructions(
  projectId: string,
  instructions: string
): Promise<ProjectKnowledge> {
  const response = await apiClient.post<{ knowledge: ProjectKnowledge }>("/api/knowledge/instructions", {
    projectId,
    instructions,
  });
  return response.knowledge;
}

/**
 * List all services for a project.
 */
export async function listServices(projectId: string): Promise<ServiceDefinition[]> {
  const response = await apiClient.get<{ services: ServiceDefinition[] }>(
    `/api/services?projectId=${encodeURIComponent(projectId)}`
  );
  return response.services;
}

/**
 * Get a specific service with its API model (including operations).
 */
export async function getServiceApiModel(projectId: string, serviceId: string): Promise<{ service: ServiceDefinition; apiModel: ApiModel | null }> {
  return apiClient.get<{ service: ServiceDefinition; apiModel: ApiModel | null }>(
    `/api/services/${encodeURIComponent(projectId)}/${encodeURIComponent(serviceId)}`
  );
}

/**
 * List relationships by status (proposed | confirmed | rejected).
 */
export async function listRelationshipsByStatus(
  projectId: string,
  status: "proposed" | "confirmed" | "rejected"
): Promise<KnowledgeRelationship[]> {
  const response = await apiClient.get<{ relationships: KnowledgeRelationship[] }>(
    `/api/knowledge/relationships/${status}?projectId=${encodeURIComponent(projectId)}`
  );
  return response.relationships;
}

/**
 * Confirm a proposed relationship by its source key.
 */
export async function confirmRelationship(
  projectId: string,
  sourceKey: string
): Promise<ProjectKnowledge | null> {
  try {
    const response = await apiClient.post<{ knowledge: ProjectKnowledge }>("/api/knowledge/relationships/confirm", {
      projectId,
      sourceKey,
    });
    return response.knowledge;
  } catch {
    return null;
  }
}

/**
 * Reject a proposed relationship by its source key.
 */
export async function rejectRelationship(
  projectId: string,
  sourceKey: string
): Promise<ProjectKnowledge | null> {
  try {
    const response = await apiClient.post<{ knowledge: ProjectKnowledge }>("/api/knowledge/relationships/reject", {
      projectId,
      sourceKey,
    });
    return response.knowledge;
  } catch {
    return null;
  }
}

/**
 * Compute sourceKey for a relationship (matches backend's relationshipKey).
 */
export function computeRelationshipKey(rel: KnowledgeRelationship): string {
  return `${rel.source.serviceId}::${rel.source.operationId}::${rel.source.location}::${rel.target.serviceId}::${rel.target.operationId}::${rel.target.location}`;
}