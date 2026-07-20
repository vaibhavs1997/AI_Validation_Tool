/**
 * Requirement source type - distinguishes between Jira and Manual requirements
 */
export type RequirementSource = "jira" | "manual";

/**
 * Common base fields shared by all requirement types
 */
export interface RequirementBase {
  /** Unique identifier for the requirement */
  key: string;
  /** Short summary/title */
  summary: string;
  /** Full description text */
  description: string;
  /** Acceptance criteria extracted from description */
  acceptanceCriteria: string[];
  /** Timestamp when requirement was loaded */
  fetchedAt: string;
}

/**
 * Jira comment structure as returned by backend
 */
export interface JiraComment {
  author: string;
  created: string;
  body: string;
}

/**
 * Jira-specific requirement data
 * Represents ticket data as returned by /api/jira/ticket endpoint
 * and normalized in the legacy app.js
 */
export interface JiraRequirement extends RequirementBase {
  source: "jira";
  id: string;
  url: string;
  issueType: string; // e.g., "Story", "Task", "Bug"
  status: string;
  priority: string;
  labels: string[];
  comments: JiraComment[];
}

/**
 * Manual requirement data
 * Represents plain text or JSON input from user
 */
export interface ManualRequirement extends RequirementBase {
  source: "manual";
}

/**
 * Union type for any requirement
 */
export type Requirement = JiraRequirement | ManualRequirement;

/**
 * Loading state for Jira-specific UI
 */
export interface JiraRequirementState {
  inputKey: string;
  fetched: boolean;
  error: boolean;
  loading: boolean;
}

/**
 * State for Manual-specific UI
 */
export interface ManualRequirementState {
  entered: boolean;
  error: boolean;
  draft: string;
}

/**
 * Loading status state
 */
export type RequirementLoadStatus = "idle" | "loading" | "success" | "error";

/**
 * Active confirmed requirement for the validation workflow
 */
export interface ActiveRequirement {
  source: RequirementSource;
  requirement: Requirement | null;
}

/**
 * Helper to determine if a requirement is Jira-sourced
 */
export function isJiraRequirement(req: Requirement | null): req is JiraRequirement {
  return req?.source === "jira";
}

/**
 * Helper to determine if a requirement is Manual-sourced
 */
export function isManualRequirement(req: Requirement | null): req is ManualRequirement {
  return req?.source === "manual";
}