/**
 * RequirementService
 *
 * Frontend service for Requirement CRUD and Workflow operations.
 * Backend endpoints: /api/requirements/* and /api/requirement-workflows/*
 */

import { apiClient } from "../../services/ApiClient";
import type { RequirementWorkflow, WorkflowSummary } from "./RequirementTypes";

export interface Requirement {
  id: string;
  projectId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  businessRules: string[];
  priority: "low" | "medium" | "high" | "critical";
  notes: string;
  status: "draft" | "needs-review" | "ready";
  source: "manual" | "paste" | "upload";
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequirementProposal {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  businessRules: string[];
  priority: "low" | "medium" | "high" | "critical";
  confidence: number;
  sourceNotes: string;
}

export interface RequirementExtractionResult {
  proposals: RequirementProposal[];
  warning?: string;
  usedAi?: boolean;
  fileName?: string;
  mimeType?: string;
}

export interface RequirementStats {
  total: number;
  ready: number;
  draft: number;
  needsReview: number;
  lastUpdated: string | null;
}

export interface ReadinessCheck {
  field: string;
  passed: boolean;
  message: string;
}

export interface ReadinessResult {
  valid: boolean;
  checks: ReadinessCheck[];
  overall: "not-ready" | "ready-with-warnings" | "ready";
}

export interface ListRequirementsOptions {
  search?: string;
  sort?: string;
  order?: string;
  status?: string;
}

/**
 * List requirements for a project.
 */
export async function listRequirements(
  projectId: string,
  options?: ListRequirementsOptions
): Promise<Requirement[]> {
  const params = new URLSearchParams({ projectId });
  if (options?.search) params.set("search", options.search);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.order) params.set("order", options.order);
  if (options?.status) params.set("status", options.status);

  const response = await apiClient.get<{ requirements: Requirement[] }>(
    `/api/requirements?${params.toString()}`
  );
  return response.requirements;
}

/**
 * Get requirement stats for a project.
 */
export async function getRequirementStats(projectId: string): Promise<RequirementStats> {
  const response = await apiClient.get<{ stats: RequirementStats }>(
    `/api/requirements/stats?projectId=${encodeURIComponent(projectId)}`
  );
  return response.stats;
}

/**
 * Get a single requirement by ID.
 */
export async function getRequirement(projectId: string, reqId: string): Promise<Requirement> {
  const response = await apiClient.get<{ requirement: Requirement }>(
    `/api/requirements/${encodeURIComponent(reqId)}?projectId=${encodeURIComponent(projectId)}`
  );
  return response.requirement;
}

/**
 * Create a new requirement.
 */
export async function createRequirement(
  projectId: string,
  data: Partial<Requirement>
): Promise<Requirement> {
  const response = await apiClient.post<{ requirement: Requirement }>("/api/requirements", {
    projectId,
    ...data,
  });
  return response.requirement;
}

/**
 * Update an existing requirement.
 */
export async function updateRequirement(
  projectId: string,
  reqId: string,
  data: Partial<Requirement>
): Promise<Requirement> {
  const response = await apiClient.patch<{ requirement: Requirement }>(
    `/api/requirements/${encodeURIComponent(reqId)}`,
    { projectId, ...data }
  );
  return response.requirement;
}

/**
 * Delete a requirement.
 */
export async function deleteRequirement(
  projectId: string,
  reqId: string
): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(
    `/api/requirements/${encodeURIComponent(reqId)}?projectId=${encodeURIComponent(projectId)}`
  );
}

/**
 * Get readiness validation for a requirement.
 */
export async function getRequirementReadiness(
  projectId: string,
  reqId: string
): Promise<ReadinessResult> {
  const response = await apiClient.get<{ readiness: ReadinessResult }>(
    `/api/requirements/${encodeURIComponent(reqId)}/readiness?projectId=${encodeURIComponent(projectId)}`
  );
  return response.readiness;
}

/**
 * Extract requirements from pasted text or file content via AI.
 */
export async function extractRequirementsFromText(
  projectId: string,
  text: string,
  fileName?: string
): Promise<RequirementExtractionResult> {
  const response = await apiClient.post<RequirementExtractionResult>("/api/requirements/extract", {
    projectId,
    text,
    fileName,
  });
  return response;
}

/**
 * Fetch requirement details from Jira ticket.
 */
export async function fetchRequirementFromJira(
  projectId: string,
  ticketKey: string
): Promise<Requirement> {
  const response = await apiClient.post<{ requirement: Requirement }>("/api/requirements/from-jira", {
    projectId,
    ticketKey,
  });
  return response.requirement;
}

/**
 * Upload a requirement document for AI extraction.
 */
export async function uploadRequirementDocument(
  projectId: string,
  file: File
): Promise<RequirementExtractionResult> {
  const buffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const response = await apiClient.post<RequirementExtractionResult>("/api/requirements/upload", {
    projectId,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    buffer: base64,
  });
  return response;
}

// ─── Requirement Workflow API ─────────────────────────────────────────────

/**
 * Initialize a workflow for a requirement.
 */
export async function initializeWorkflow(
  projectId: string,
  requirementId: string
): Promise<RequirementWorkflow> {
  const response = await apiClient.post<{ workflow: RequirementWorkflow }>(
    `/api/requirement-workflows/${encodeURIComponent('initialize')}/initialize`,
    { projectId, requirementId }
  );
  return response.workflow;
}

/**
 * Get a workflow by ID.
 */
export async function getWorkflow(
  projectId: string,
  workflowId: string
): Promise<RequirementWorkflow> {
  const response = await apiClient.get<{ workflow: RequirementWorkflow }>(
    `/api/requirement-workflows/${encodeURIComponent(workflowId)}?projectId=${encodeURIComponent(projectId)}`
  );
  return response.workflow;
}

/**
 * Get workflow by requirement ID.
 */
export async function getWorkflowByRequirement(
  projectId: string,
  requirementId: string
): Promise<RequirementWorkflow | null> {
  const response = await apiClient.get<{ workflows: RequirementWorkflow[] }>(
    `/api/requirement-workflows?projectId=${encodeURIComponent(projectId)}&requirementId=${encodeURIComponent(requirementId)}`
  );
  return response.workflows?.[0] || null;
}

/**
 * Analyze a requirement using AI.
 */
export async function analyzeRequirement(
  projectId: string,
  workflowId: string
): Promise<RequirementWorkflow> {
  const response = await apiClient.post<{ workflow: RequirementWorkflow }>(
    `/api/requirement-workflows/${encodeURIComponent(workflowId)}/analyze`,
    { projectId }
  );
  return response.workflow;
}

/**
 * Generate test cases for analyzed requirement.
 */
export async function generateWorkflowTestCases(
  projectId: string,
  workflowId: string
): Promise<RequirementWorkflow> {
  const response = await apiClient.post<{ workflow: RequirementWorkflow }>(
    `/api/requirement-workflows/${encodeURIComponent(workflowId)}/generate-tests`,
    { projectId }
  );
  return response.workflow;
}

/**
 * Update test case selection.
 */
export async function updateTestSelection(
  projectId: string,
  workflowId: string,
  testCaseIds: string[]
): Promise<RequirementWorkflow> {
  const response = await apiClient.post<{ workflow: RequirementWorkflow }>(
    `/api/requirement-workflows/${encodeURIComponent(workflowId)}/update-selection`,
    { projectId, testCaseIds }
  );
  return response.workflow;
}

/**
 * Approve selected test cases.
 */
export async function approveTests(
  projectId: string,
  workflowId: string
): Promise<RequirementWorkflow> {
  const response = await apiClient.post<{ workflow: RequirementWorkflow }>(
    `/api/requirement-workflows/${encodeURIComponent(workflowId)}/approve-tests`,
    { projectId }
  );
  return response.workflow;
}

/**
 * Match test cases to APIs.
 */
export async function matchApis(
  projectId: string,
  workflowId: string
): Promise<RequirementWorkflow> {
  const response = await apiClient.post<{ workflow: RequirementWorkflow }>(
    `/api/requirement-workflows/${encodeURIComponent(workflowId)}/match-apis`,
    { projectId }
  );
  return response.workflow;
}

/**
 * Confirm API mappings.
 */
export async function confirmMappings(
  projectId: string,
  workflowId: string
): Promise<RequirementWorkflow> {
  const response = await apiClient.post<{ workflow: RequirementWorkflow }>(
    `/api/requirement-workflows/${encodeURIComponent(workflowId)}/confirm-mappings`,
    { projectId }
  );
  return response.workflow;
}

/**
 * Generate draft validation scenarios.
 */
export async function generateDraftScenarios(
  projectId: string,
  workflowId: string
): Promise<RequirementWorkflow> {
  const response = await apiClient.post<{ workflow: RequirementWorkflow }>(
    `/api/requirement-workflows/${encodeURIComponent(workflowId)}/generate-scenarios`,
    { projectId }
  );
  return response.workflow;
}

/**
 * Get workflow summary/coverage.
 */
export async function getWorkflowSummary(
  projectId: string,
  workflowId: string
): Promise<WorkflowSummary> {
  const response = await apiClient.post<{ workflow: WorkflowSummary }>(
    `/api/requirement-workflows/${encodeURIComponent(workflowId)}/summary`,
    { projectId }
  );
  return response.workflow;
}