/**
 * ProjectContext
 *
 * React Context for project state management.
 * This is the single source of truth for project data across the application.
 * Components consume this context rather than calling ProjectService or hooks directly.
 */

import { createContext, useContext, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import type { Project, UpdateProjectRequest, DeleteProjectResponse } from "../../types";
import { useProjects } from "../../hooks/useProjects";
import { useProject } from "../../hooks/useProject";
import { useLocalStorage } from "../../hooks/useLocalStorage";

// ─── Context Value ──────────────────────────────────────────────────────────

export interface ProjectContextValue {
  // List state
  projects: Project[];
  total: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
  success: string | null;
  searchQuery: string;
  sort: "id" | "name" | "createdAt" | "updatedAt";
  order: "asc" | "desc";
  limit: number;
  offset: number;

  // List actions
  refetchProjects: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setSort: (sort: "id" | "name" | "createdAt" | "updatedAt") => void;
  setOrder: (order: "asc" | "desc") => void;
  goToPage: (page: number) => void;
  clearError: () => void;
  clearSuccess: () => void;

  // Single project state
  selectedProject: Project | null;
  projectLoading: boolean;
  projectSaving: boolean;
  deleting: boolean;
  projectError: string | null;
  projectSuccess: string | null;

  // Single project actions
  loadProject: (projectId: string) => Promise<void>;
  createProject: (id: string, name: string) => Promise<Project>;
  updateProject: (projectId: string, data: UpdateProjectRequest) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<DeleteProjectResponse>;
  clearProjectError: () => void;
  clearProjectSuccess: () => void;
  
  // Selection state and actions
  selectedProjectId: string | null;
  selectProject: (project: Project | null) => void;
  clearSelection: () => void;
  restoreSelection: () => void;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

export interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [projectsState, projectsActions] = useProjects();
  const [projectState, projectActions] = useProject();
  const [selectedProjectId, setSelectedProjectId] = useLocalStorage<string | null>("selectedProjectId", null);

  const selectedProject = projectsState.projects.find(p => p.id === selectedProjectId) || null;

  const selectProject = useCallback((project: Project | null) => {
    setSelectedProjectId(project?.id || null);
    if (project) {
      projectActions.loadProject(project.id);
    }
  }, [setSelectedProjectId, projectActions]);

  const clearSelection = useCallback(() => {
    setSelectedProjectId(null);
  }, [setSelectedProjectId]);

  const restoreSelection = useCallback(() => {
    // useLocalStorage automatically restores from localStorage on init
    // This function is provided for explicit re-restoration if needed
  }, []);

  // Combine list and single-project state
  const value = useMemo<ProjectContextValue>(
    () => ({
      // List state
      projects: projectsState.projects,
      total: projectsState.total,
      loading: projectsState.loading,
      saving: projectsState.saving,
      error: projectsState.error,
      success: projectsState.success,
      searchQuery: projectsState.searchQuery,
      sort: projectsState.sort,
      order: projectsState.order,
      limit: projectsState.limit,
      offset: projectsState.offset,

      // List actions
      refetchProjects: projectsActions.refetch,
      setSearchQuery: projectsActions.setSearchQuery,
      setSort: projectsActions.setSort,
      setOrder: projectsActions.setOrder,
      goToPage: projectsActions.goToPage,
      clearError: projectsActions.clearError,
      clearSuccess: projectsActions.clearSuccess,

      // Single project state
      selectedProject,
      projectLoading: projectState.loading,
      projectSaving: projectState.saving,
      deleting: projectState.deleting,
      projectError: projectState.error,
      projectSuccess: projectState.success,

      // Single project actions
      loadProject: projectActions.loadProject,
      createProject: projectsActions.createProject,
      updateProject: projectActions.updateProject,
      deleteProject: projectActions.deleteProject,
      clearProjectError: projectActions.clearError,
      clearProjectSuccess: projectActions.clearSuccess,
      
      // Selection state and actions
      selectedProjectId,
      selectProject,
      clearSelection,
      restoreSelection,
    }),
    [
      projectsState, 
      projectsActions, 
      projectState, 
      projectActions, 
      selectedProject, 
      selectedProjectId, 
      selectProject, 
      clearSelection, 
      restoreSelection
    ]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * useProjectContext
 *
 * Hook to access project state and actions from any component.
 * Throws if used outside of ProjectProvider.
 */
export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjectContext must be used within a ProjectProvider");
  }
  return context;
}