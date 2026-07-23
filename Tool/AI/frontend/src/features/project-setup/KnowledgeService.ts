/**
 * KnowledgeService
 *
 * Frontend service for project knowledge and relationship management.
 * Backend endpoints:
 *   GET  /api/knowledge?projectId=...
 *   POST /api/knowledge/instructions
 *   GET  /api/knowledge/relationships/:status
 *   POST /api/knowledge/relationships/confirm
 *   POST /api/knowledge/relationships/reject
 */

import { apiClient } from "../../services/ApiClient";
import type {
  ProjectKnowledge,
  KnowledgeRelationship,
  GetKnowledgeResponse,
  ListRelationshipsResponse,
  UpdateInstructionsResponse,
  ConfirmRejectResponse,
} from "../../types";

/**
 * Get project knowledge (instructions + relationships).
 */
export async function getProjectKnowledge(projectId: string): Promise<ProjectKnowledge | null> {
  const response = await apiClient.get<GetKnowledgeResponse>(
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
  const response = await apiClient.post<UpdateInstructionsResponse>("/api/knowledge/instructions", {
    projectId,
    instructions,
  });
  return response.knowledge;
}

/**
 * List relationships by status (proposed | confirmed | rejected).
 */
export async function listRelationshipsByStatus(
  projectId: string,
  status: "proposed" | "confirmed" | "rejected"
): Promise<KnowledgeRelationship[]> {
  const response = await apiClient.get<ListRelationshipsResponse>(
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
    const response = await apiClient.post<ConfirmRejectResponse>("/api/knowledge/relationships/confirm", {
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
    const response = await apiClient.post<ConfirmRejectResponse>("/api/knowledge/relationships/reject", {
      projectId,
      sourceKey,
    });
    return response.knowledge;
  } catch {
    return null;
  }
}