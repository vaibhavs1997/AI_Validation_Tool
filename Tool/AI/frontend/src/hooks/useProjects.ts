/**
 * useProjects
 *
 * Manages the project list state including search, sort, and pagination.
 * This hook wraps ProjectService calls and exposes loading/error/success states.
 * React components must use this hook rather than calling ProjectService directly.
 */

import { useState, useEffect, useCallback } from "react";
import * as ProjectService from "../features/project-setup/ProjectService";
import type { Project, ListProjectsResponse, ListProjectsOptions } from "../types";
import { useDebounce } from "./useDebounce";

export interface ProjectsState {
  /** List of projects */
  projects: Project[];
  /** Total number of projects (after filtering) */
  total: number;
  /** Whether the initial load is in progress */
  loading: boolean;
  /** Whether a mutation (create/update/delete) is in progress */
  saving: boolean;
  /** Error message, or null if no error */
  error: string | null;
  /** Success message after mutation, or null */
  success: string | null;
  /** Current search query */
  searchQuery: string;
  /** Current sort field */
  sort: "id" | "name" | "createdAt" | "updatedAt";
  /** Current sort order */
  order: "asc" | "desc";
  /** Current page limit */
  limit: number;
  /** Current page offset */
  offset: number;
}

export interface ProjectsActions {
  /** Refetch the project list with current options */
  refetch: () => Promise<void>;
  /** Set the search query (will be debounced) */
  setSearchQuery: (query: string) => void;
  /** Set sort field */
  setSort: (sort: "id" | "name" | "createdAt" | "updatedAt") => void;
  /** Set sort order */
  setOrder: (order: "asc" | "desc") => void;
  /** Go to a specific page (1-indexed) */
  goToPage: (page: number) => void;
  /** Create a new project */
  createProject: (id: string, name: string) => Promise<Project>;
  /** Clear error state */
  clearError: () => void;
  /** Clear success state */
  clearSuccess: () => void;
}

export type UseProjectsReturn = [ProjectsState, ProjectsActions];

const DEFAULT_LIMIT = 100;

function initialState(): ProjectsState {
  return {
    projects: [],
    total: 0,
    loading: false,
    saving: false,
    error: null,
    success: null,
    searchQuery: "",
    sort: "id",
    order: "asc",
    limit: DEFAULT_LIMIT,
    offset: 0,
  };
}

/**
 * Hook for managing the projects list with search, sort, and pagination.
 */
export function useProjects(): UseProjectsReturn {
  const [state, setState] = useState<ProjectsState>(initialState);
  const debouncedSearch = useDebounce(state.searchQuery, 300);

  // Build list options from current state
  const buildOptions = useCallback(
    (search: string): ListProjectsOptions => {
      const options: ListProjectsOptions = {
        sort: state.sort,
        order: state.order,
        limit: state.limit,
        offset: state.offset,
      };
      if (search) {
        options.search = search;
      }
      return options;
    },
    [state.sort, state.order, state.limit, state.offset]
  );

  // Fetch projects
  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const options = buildOptions(debouncedSearch);
      const response: ListProjectsResponse = await ProjectService.listProjects(options);
      setState((prev) => ({
        ...prev,
        projects: response.projects,
        total: response.total,
        loading: false,
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load projects";
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [debouncedSearch, buildOptions]);

  // Refetch when debounced search or sort/order/offset changes
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Actions
  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, searchQuery: query, offset: 0 }));
  }, []);

  const setSort = useCallback((sort: "id" | "name" | "createdAt" | "updatedAt") => {
    setState((prev) => ({ ...prev, sort, offset: 0 }));
  }, []);

  const setOrder = useCallback((order: "asc" | "desc") => {
    setState((prev) => ({ ...prev, order, offset: 0 }));
  }, []);

  const goToPage = useCallback((page: number) => {
    const offset = (page - 1) * state.limit;
    setState((prev) => ({ ...prev, offset: Math.max(0, offset) }));
  }, [state.limit]);

  const createProject = useCallback(async (id: string, name: string): Promise<Project> => {
    setState((prev) => ({ ...prev, saving: true, error: null, success: null }));
    try {
      const project = await ProjectService.createProject({ id, name });
      setState((prev) => ({
        ...prev,
        saving: false,
        success: `Project "${project.name}" created successfully`,
      }));
      // Refetch to update the list
      refetch();
      return project;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      setState((prev) => ({ ...prev, saving: false, error: message }));
      throw err;
    }
  }, [refetch]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearSuccess = useCallback(() => {
    setState((prev) => ({ ...prev, success: null }));
  }, []);

  const actions: ProjectsActions = {
    refetch,
    setSearchQuery,
    setSort,
    setOrder,
    goToPage,
    createProject,
    clearError,
    clearSuccess,
  };

  return [state, actions];
}