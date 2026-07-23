import { apiClient } from "../../services";
import type { GenerateTestCasesRequest, GenerateTestCasesResponse } from "../../types";
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

  const response = await apiClient.post<GenerateTestCasesResponse>(
    "/api/test-cases/generate",
    request
  );

  return response;
}
