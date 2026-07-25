/**
 * useProject
 *
 * Manages state for a single project: load, update, delete.
 * This hook wraps ProjectService calls and exposes loading/error/success states.
 * React components must use this hook rather than calling ProjectService directly.
 */

import { useState, useCallback } from "react";
import * as ProjectService from "../features/project-setup/ProjectService";
import type { Project, UpdateProjectRequest, DeleteProjectResponse } from "../types";

export interface ProjectState {
  /** The project data, or null if not loaded */
  project: Project | null;
  /** Whether the project is being loaded */
  loading: boolean;
  /** Whether a mutation (update/delete) is in progress */
  saving: boolean;
  /** Whether a delete is in progress */
  deleting: boolean;
  /** Error message, or null */
  error: string | null;
  /** Success message, or null */
  success: string | null;
}

export interface ProjectActions {
  /** Load the project by ID */
  loadProject: (projectId: string) => Promise<void>;
  /** Update the project name */
  updateProject: (projectId: string, data: UpdateProjectRequest) => Promise<Project>;
  /** Delete the project */
  deleteProject: (projectId: string) => Promise<DeleteProjectResponse>;
  /** Clear error state */
  clearError: () => void;
  /** Clear success state */
  clearSuccess: () => void;
}

export type UseProjectReturn = [ProjectState, ProjectActions];

function initialState(): ProjectState {
  return {
    project: null,
    loading: false,
    saving: false,
    deleting: false,
    error: null,
    success: null,
  };
}

/**
 * Hook for managing a single project's lifecycle.
 */
export function useProject(): UseProjectReturn {
  const [state, setState] = useState<ProjectState>(initialState);

  const loadProject = useCallback(async (projectId: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const project = await ProjectService.getProject(projectId);
      setState((prev) => ({
        ...prev,
        project,
        loading: false,
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load project";
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, []);

  const updateProject = useCallback(async (projectId: string, data: UpdateProjectRequest): Promise<Project> => {
    setState((prev) => ({ ...prev, saving: true, error: null, success: null }));
    try {
      const updated = await ProjectService.updateProject(projectId, data);
      setState((prev) => ({
        ...prev,
        project: updated,
        saving: false,
        success: `Project renamed to "${updated.name}"`,
      }));
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update project";
      setState((prev) => ({ ...prev, saving: false, error: message }));
      throw err;
    }
  }, []);

  const deleteProject = useCallback(async (projectId: string): Promise<DeleteProjectResponse> => {
    setState((prev) => ({ ...prev, deleting: true, error: null, success: null }));
    try {
      const response = await ProjectService.deleteProject(projectId);
      setState((prev) => ({
        ...prev,
        project: null,
        deleting: false,
        success: `Project "${projectId}" deleted successfully`,
      }));
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete project";
      setState((prev) => ({ ...prev, deleting: false, error: message }));
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearSuccess = useCallback(() => {
    setState((prev) => ({ ...prev, success: null }));
  }, []);

  const actions: ProjectActions = {
    loadProject,
    updateProject,
    deleteProject,
    clearError,
    clearSuccess,
  };

  return [state, actions];
}