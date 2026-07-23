/**
 * ProjectService
 *
 * Frontend service for Project CRUD operations.
 * Backend endpoints: /api/projects (GET, POST, GET/:id)
 */

import { apiClient } from "../../services/ApiClient";
import type { Project, ListProjectsResponse, GetProjectResponse, CreateProjectRequest } from "../../types";

/**
 * List all projects.
 */
export async function listProjects(): Promise<Project[]> {
  const response = await apiClient.get<ListProjectsResponse>("/api/projects");
  return response.projects;
}

/**
 * Get a single project by ID.
 */
export async function getProject(projectId: string): Promise<Project> {
  const response = await apiClient.get<GetProjectResponse>(`/api/projects/${encodeURIComponent(projectId)}`);
  return response.project;
}

/**
 * Create a new project.
 */
export async function createProject(data: CreateProjectRequest): Promise<Project> {
  const response = await apiClient.post<{ project: Project }>("/api/projects", data);
  return response.project;
}