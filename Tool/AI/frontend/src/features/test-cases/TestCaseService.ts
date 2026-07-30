import { apiClient } from "../../services";
import type { GenerateTestCasesResponse, GenerateTestCasesRequest } from "../../types";
import type { ActiveRequirement } from "../requirements/RequirementTypes";

export function mapActiveRequirementToTicket(activeRequirement: ActiveRequirement | null): Record<string, unknown> {
  if (!activeRequirement?.requirement) {
    return {};
  }

  const req = activeRequirement.requirement;

  const ticket: Record<string, unknown> = {
    key: req.key,
    summary: req.summary,
    description: req.description,
    acceptanceCriteria: req.acceptanceCriteria,
  };

  if (req.source === "jira") {
    ticket.issueType = req.issueType;
    ticket.status = req.status;
    ticket.priority = req.priority;
    ticket.labels = req.labels;
  }

  return ticket;
}

export async function generateTestCases(
  projectId: string,
  activeRequirement: ActiveRequirement | null
): Promise<GenerateTestCasesResponse> {
  const ticket = mapActiveRequirementToTicket(activeRequirement);

  const request: GenerateTestCasesRequest = {
    projectId,
    ticket,
  };

  const response = await apiClient.post<{ projectId: string; generationId: string; status: string }>(
    "/api/test-cases/generate",
    request
  );

  return {
    projectId: response.projectId,
    testCases: [],
    diagnostics: { generated: 0 },
    warnings: [],
    generationId: response.generationId,
    status: response.status,
  } as GenerateTestCasesResponse;
}

interface GenerationStatusResponse {
  generationId: string;
  status: string;
  testCases: any[];
  diagnostics: { generated: number };
  warnings: string[];
  error?: string | null;
  startedAt: string;
  updatedAt: string;
}

export async function getGenerationStatus(
  projectId: string,
  generationId: string
): Promise<GenerateTestCasesResponse> {
  const url = "/api/test-cases/generate/status?projectId=" + encodeURIComponent(projectId) + "&generationId=" + encodeURIComponent(generationId);
  const res = await apiClient.post<GenerationStatusResponse>(url, {});

  const statusValue = res.status;

  if (statusValue === "completed") {
    return {
      projectId,
      testCases: (res.testCases || []) as any,
      diagnostics: res.diagnostics || { generated: 0 },
      warnings: res.warnings || [],
      status: statusValue,
    };
  }

  if (statusValue === "failed") {
    throw new Error(res.error || "Generation failed");
  }

  return {
    projectId,
    testCases: [],
    diagnostics: res.diagnostics || { generated: 0 },
    warnings: res.warnings || [],
    status: statusValue,
  };
}
