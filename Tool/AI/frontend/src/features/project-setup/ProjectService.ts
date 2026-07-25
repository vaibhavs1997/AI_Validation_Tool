/**
 * ProjectService
 *
 * Frontend service for Project CRUD operations.
 * Single entry point for all Project REST operations.
 * No React components should call fetch() directly.
 *
 * Backend endpoints: /api/projects (GET, POST, GET/:id, PATCH/:id, DELETE/:id)
 */

import { apiClient } from "../../services/ApiClient";
import type {
  Project,
  ListProjectsResponse,
  ListProjectsOptions,
  GetProjectResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
  DeleteProjectResponse,
} from "../../types";

/**
 * Build a query string from ListProjectsOptions.
 */
function buildListQuery(options?: ListProjectsOptions): string {
  if (!options) return "";

  const params = new URLSearchParams();
  if (options.search) params.set("search", options.search);
  if (options.sort) params.set("sort", options.sort);
  if (options.order) params.set("order", options.order);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * List all projects, with optional search/sort/filter options.
 */
export async function listProjects(options?: ListProjectsOptions): Promise<ListProjectsResponse> {
  const query = buildListQuery(options);
  return apiClient.get<ListProjectsResponse>(`/api/projects${query}`);
}

/**
 * Get a single project by ID.
 */
export async function getProject(projectId: string): Promise<Project> {
  const response = await apiClient.get<GetProjectResponse>(
    `/api/projects/${encodeURIComponent(projectId)}`
  );
  return response.project;
}

/**
 * Create a new project.
 */
export async function createProject(data: CreateProjectRequest): Promise<Project> {
  const response = await apiClient.post<{ project: Project }>("/api/projects", data);
  return response.project;
}

/**
 * Update an existing project's name.
 */
export async function updateProject(projectId: string, data: UpdateProjectRequest): Promise<Project> {
  const response = await apiClient.patch<{ project: Project }>(
    `/api/projects/${encodeURIComponent(projectId)}`,
    data
  );
  return response.project;
}

/**
 * Delete a project and all associated data.
 */
export async function deleteProject(projectId: string): Promise<DeleteProjectResponse> {
  return apiClient.delete<DeleteProjectResponse>(
    `/api/projects/${encodeURIComponent(projectId)}`
  );
}

/**
 * Search projects by query string.
 * Convenience wrapper around listProjects with search option.
 */
export async function searchProjects(query: string): Promise<ListProjectsResponse> {
  return listProjects({ search: query });
}