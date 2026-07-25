/**
 * Validation utilities for project forms.
 */

import { PROJECT_ID_PATTERN, MAX_PROJECT_ID_LENGTH } from "./constants";

/**
 * Validate a project ID.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateProjectId(id: string): string | null {
  if (!id || !id.trim()) {
    return "Project ID is required.";
  }
  if (id.length > MAX_PROJECT_ID_LENGTH) {
    return `Project ID must be at most ${MAX_PROJECT_ID_LENGTH} characters.`;
  }
  if (!PROJECT_ID_PATTERN.test(id)) {
    return "Project ID must contain only alphanumeric characters, hyphens, underscores, and dots.";
  }
  return null;
}

/**
 * Validate a project name.
 * Returns null if valid, or an error message string if invalid.
 * Name is optional, but if provided must be non-empty.
 */
export function validateProjectName(name: string): string | null {
  if (name && !name.trim()) {
    return "Project name must be non-empty if provided.";
  }
  return null;
}