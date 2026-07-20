import { apiClient } from "../../services";
import type { ActiveRequirement } from "../requirements/RequirementTypes";
import type { ApiContract } from "../api-collection/ApiCollectionTypes";
import type { GenerateScenariosRequest, GenerateScenariosResponse } from "./ScenarioTypes";

/**
 * Response DTO from POST /api/scenarios/generate
 */
interface GenerateScenariosResponseDto {
  scenarios: GenerateScenariosResponse["scenarios"];
  unusedEndpoints: GenerateScenariosResponse["unusedEndpoints"];
  mode: GenerateScenariosResponse["mode"];
  warnings?: string[];
}

/**
 * Maps an ActiveRequirement to the flat ticket object the backend expects.
 *
 * ActiveRequirement is a frontend wrapper { source, requirement }.
 * The backend expects a flat ticket object with fields directly at the top level.
 *
 * For Jira requirements: extracts key, summary, description, acceptanceCriteria
 * from the JiraRequirement. Jira-specific fields (issueType, status, priority,
 * labels, comments) are preserved as-is since the backend may use them.
 *
 * For Manual requirements: extracts key, summary, description, acceptanceCriteria
 * from the ManualRequirement. No Jira metadata is invented.
 *
 * If requirement is null, returns an empty object (backend will handle gracefully).
 */
export function mapActiveRequirementToTicket(activeRequirement: ActiveRequirement | null): Record<string, unknown> {
  if (!activeRequirement?.requirement) {
    return {};
  }

  const req = activeRequirement.requirement;

  // Both JiraRequirement and ManualRequirement extend RequirementBase,
  // so these fields are always available
  const ticket: Record<string, unknown> = {
    key: req.key,
    summary: req.summary,
    description: req.description,
    acceptanceCriteria: req.acceptanceCriteria,
  };

  // Preserve optional Jira-specific fields if present (backend may use them)
  if (req.source === "jira") {
    ticket.issueType = req.issueType;
    ticket.status = req.status;
    ticket.priority = req.priority;
    ticket.labels = req.labels;
    ticket.comments = req.comments;
  }

  return ticket;
}

/**
 * Generates test scenarios from a ticket and API contract.
 *
 * Calls POST /api/scenarios/generate using the existing shared apiClient.
 *
 * The request body contains:
 * - ticket: Flat ticket object (mapped from ActiveRequirement)
 * - contract: Normalized ApiContract (sent as-is)
 * - useAi: Whether to use AI enhancement (defaults to false for local generation)
 *
 * @param activeRequirement - The active requirement from WorkspacePage state (must have requirement)
 * @param activeContract - The active API contract from WorkspacePage state (must be non-null)
 * @param useAi - Whether to enable AI-enhanced generation (default: false)
 * @returns The typed backend response with scenarios, unusedEndpoints, and mode
 * @throws Error if activeRequirement or activeContract is missing
 */
export async function generateTestScenarios(
  activeRequirement: ActiveRequirement | null,
  activeContract: ApiContract | null,
  useAi: boolean = false
): Promise<GenerateScenariosResponse> {
  // Fail fast if prerequisites are missing
  if (!activeRequirement?.requirement) {
    throw new Error("No requirement configured. Configure a requirement before generating scenarios.");
  }
  if (!activeContract) {
    throw new Error("No API contract configured. Import an API collection before generating scenarios.");
  }

  const ticket = mapActiveRequirementToTicket(activeRequirement);
  const contract: GenerateScenariosRequest["contract"] = activeContract;

  const request: GenerateScenariosRequest = {
    ticket,
    contract,
    useAi,
  };

  const response = await apiClient.post<GenerateScenariosResponseDto>(
    "/api/scenarios/generate",
    request
  );

  return {
    scenarios: response.scenarios,
    unusedEndpoints: response.unusedEndpoints,
    mode: response.mode,
    warnings: response.warnings,
  };
}
