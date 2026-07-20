import { apiClient } from "../../services";
import type { JiraRequirement } from "./RequirementTypes";

/**
 * API response shape for /api/jira/ticket endpoint
 */
interface JiraTicketResponse {
  ticket: JiraRequirement;
}

/**
 * Fetches a Jira ticket from the backend API.
 * Uses the generic API client with typed response.
 * 
 * @param ticketKey - Jira ticket key (e.g., "PROJ-123")
 * @returns The Jira requirement with source: "jira"
 */
export async function fetchJiraRequirement(ticketKey: string): Promise<JiraRequirement> {
  const response = await apiClient.post<JiraTicketResponse>("/api/jira/ticket", { issueKey: ticketKey });
  return response.ticket;
}