/**
 * ProjectDashboard
 *
 * Main dashboard for displaying projects.
 * Consumes ProjectContext - no direct ProjectService calls.
 *
 * Displays:
 * - Loading state while fetching
 * - Error state on API failure
 * - Empty state when no projects match
 * - Grid of project cards when projects exist
 * - Create Project button and dialog
 */

import { useState, useCallback } from "react";
import { useProjectContext } from "./ProjectContext";
import { ProjectToolbar } from "./ProjectToolbar";
import { ProjectGrid } from "./ProjectGrid";
import { ProjectEmptyState } from "./ProjectEmptyState";
import { ProjectLoading } from "./ProjectLoading";
import { ProjectError } from "./ProjectError";
import { CreateProjectButton } from "./CreateProjectButton";
import { CreateProjectDialog } from "./CreateProjectDialog";
import type { Project } from "../../types";

export function ProjectDashboard() {
  const {
    projects,
    loading,
    error,
    total,
    refetchProjects,
    success,
    clearSuccess,
    selectedProjectId,
    selectProject,
  } = useProjectContext();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    refetchProjects();
  };

  const handleProjectSelect = useCallback((project: Project) => {
    selectProject(project);
  }, [selectProject]);

  return (
    <section
      className="project-dashboard"
      aria-labelledby="project-dashboard-title"
    >
      <header className="project-dashboard-header">
        <div className="project-dashboard-header-left">
          <h1 id="project-dashboard-title" className="project-dashboard-title">
            Projects
          </h1>
          <p className="project-dashboard-count" aria-live="polite">
            {total} project{total !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateProjectButton onClick={() => setIsCreateOpen(true)} />
      </header>

      <div className="project-workspace">
        {/* Left sidebar: search, list, create */}
        <aside className="project-sidebar" aria-label="Project list">
          <div className="project-sidebar-header">
            <ProjectToolbar />
          </div>

          <div className="project-sidebar-content">
            {loading && <ProjectLoading />}

            {!loading && error && (
              <ProjectError message={error} onRetry={refetchProjects} />
            )}

            {!loading && !error && projects.length === 0 && <ProjectEmptyState />}

            {!loading && !error && projects.length > 0 && (
              <ProjectGrid
                projects={projects}
                selectedProjectId={selectedProjectId}
                onProjectSelect={handleProjectSelect}
              />
            )}
          </div>

          <div className="project-sidebar-footer">
            <CreateProjectButton onClick={() => setIsCreateOpen(true)} />
          </div>
        </aside>

        {/* Right main: selected project summary */}
        <main className="project-main" aria-live="polite">
          {selectedProjectId ? (
            <div className="project-summary">
              <h2 className="project-summary-title">Selected Project</h2>
              <div className="project-summary-content">
                <p className="project-summary-name">
                  {projects.find(p => p.id === selectedProjectId)?.name || selectedProjectId}
                </p>
                <p className="project-summary-id">ID: {selectedProjectId}</p>
                <p className="project-summary-hint">
                  Use the project list to switch between projects.
                </p>
              </div>
            </div>
          ) : (
            <div className="project-summary">
              <h2 className="project-summary-title">No Project Selected</h2>
              <div className="project-summary-content">
                <p className="project-summary-hint">
                  Select a project from the list to view details.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Success notification */}
      {success && (
        <div className="toast toast-success" role="status" aria-live="polite">
          <span className="toast-icon" aria-hidden="true">✓</span>
          {success}
          <button
            type="button"
            className="toast-close"
            onClick={clearSuccess}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Create Project Dialog */}
      <CreateProjectDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </section>
  );
}
