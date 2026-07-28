/**
 * Project Setup Page
 *
 * Sections:
 * 1. Project selector + create (when no active project)
 * 2. Project Knowledge (instructions) - when project is active
 * 3. Relationships (proposed/confirmed/rejected)
 */

import { useState, useEffect, useCallback } from "react";
import type { Project, KnowledgeRelationship } from "../../types";
import { listProjects, createProject, updateProject, deleteProject } from "./ProjectService";
import { getProjectKnowledge, updateInstructions, confirmRelationship, rejectRelationship } from "./KnowledgeService";
import { ProjectCard } from "./ProjectCard";
import { SortDropdown, SORT_OPTIONS } from "./SortDropdown";
import type { ProjectCardData } from "./ProjectCard";
import { useDebounce } from "../../hooks/useDebounce";
import { useLocalStorage } from "../../hooks/useLocalStorage";

// SVG Icon Components
const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

interface SetupPageProps {
  activeProjectId: string | null;
  onActiveProjectChange: (projectId: string) => void;
}

export function SetupPage({ activeProjectId, onActiveProjectChange }: SetupPageProps) {
  // ─── Project Section ──────────────────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectId, setNewProjectId] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [projectError, setProjectError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);

  // ─── Last Used Project ─────────────────────────────────────────────────────
  const [lastUsedProjectId, setLastUsedProjectId] = useLocalStorage<string>("testforge:last-used-project", "");

  // ─── Search & Sort ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useLocalStorage<string>("testforge:project-sort", "recently-updated");
  const [showClearSearch, setShowClearSearch] = useState(false);

  // Defensive: ensure no legacy 1970 timestamps leak through
  const sanitizedProjects = projects.map((p) => ({
    ...p,
    createdAt: p.createdAt && new Date(p.createdAt).getFullYear() > 1970 ? p.createdAt : new Date().toISOString(),
    updatedAt: p.updatedAt && new Date(p.updatedAt).getFullYear() > 1970 ? p.updatedAt : new Date().toISOString(),
  }));

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowClearSearch(value.length > 0);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setSearchQuery("");
      setShowClearSearch(false);
      e.currentTarget.blur();
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setShowClearSearch(false);
  };

  // Filter and sort projects
  const filteredProjects = sanitizedProjects
    .filter((project) => {
      if (!debouncedSearchQuery.trim()) return true;
      const query = debouncedSearchQuery.trim().toLowerCase();
      return (
        project.name.toLowerCase().includes(query) ||
        project.id.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return (a.name || a.id).localeCompare(b.name || b.id);
        case "name-desc":
          return (b.name || b.id).localeCompare(a.name || a.id);
        case "newest-created":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest-created":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "recently-updated":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

  // Derive last used project from the projects list
  const lastUsedProject = projects.find((p) => p.id === lastUsedProjectId);

  // Exclude last used from the main grid
  const otherProjects = filteredProjects.filter((p) => p.id !== lastUsedProjectId);

  // ─── Validation ────────────────────────────────────────────────────────────
  const validateProjectName = (name: string, currentProjectId?: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return "Project name cannot be empty.";
    if (trimmed !== name) return "Project name cannot have leading or trailing spaces.";
    if (projects.some((p) => p.name.toLowerCase() === trimmed.toLowerCase() && p.id !== currentProjectId)) {
      return "A project with this name already exists.";
    }
    return null;
  };

  // ─── Rename ────────────────────────────────────────────────────────────────
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [lastFocusedElement, setLastFocusedElement] = useState<HTMLElement | null>(null);

  const openRenameModal = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    setRenameProjectId(projectId);
    setRenameName(project.name || project.id);
    setRenameError("");
    setLastFocusedElement(document.activeElement as HTMLElement);
    setRenameModalOpen(true);
  };

  const closeRenameModal = () => {
    setRenameModalOpen(false);
    setRenameProjectId(null);
    setRenameName("");
    setRenameError("");
    lastFocusedElement?.focus();
  };

  const handleRenameSave = async () => {
    if (!renameProjectId) return;
    const validationError = validateProjectName(renameName, renameProjectId);
    if (validationError) {
      setRenameError(validationError);
      return;
    }
    setRenaming(true);
    try {
      const updated = await updateProject?.(renameProjectId, { name: renameName.trim() });
      if (updated) {
        setProjects((prev) => prev.map((p) => (p.id === renameProjectId ? updated : p)));
        closeRenameModal();
      }
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Failed to rename project.");
    } finally {
      setRenaming(false);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleRenameSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeRenameModal();
    }
  };

  // ─── Toast Notifications ───────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Delete Confirmation Modal ─────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<{ type: "single"; projectId: string } | { type: "all" } | null>(null);

  // ─── Knowledge Section ────────────────────────────────────────────────────
  const [knowledge, setKnowledge] = useState<any>(null);
  const [instructions, setInstructions] = useState("");
  const [instructionsDirty, setInstructionsDirty] = useState(false);
  const [instructionsLoading, setInstructionsLoading] = useState(false);
  const [instructionsError, setInstructionsError] = useState("");

  // ─── Project Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    listProjects()
      .then((response) => setProjects(response.projects))
      .catch(() => {});
  }, []);

  const loadProjectData = useCallback(async (projectId: string) => {
    try {
      const kn = await getProjectKnowledge(projectId).catch(() => null);
      setKnowledge(kn);
      if (kn) {
        setInstructions(kn.instructions || "");
      } else {
        setInstructions("");
      }
    } catch {
      setKnowledge(null);
    }
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      loadProjectData(activeProjectId);
    }
  }, [activeProjectId, loadProjectData]);

  // ─── Delete Handlers ─────────────────────────────────────────────────────
  const handleDeleteAllProjects = async () => {
    if (projects.length === 0) return;
    setConfirmDelete({ type: "all" });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;

    if (confirmDelete.type === "single") {
      const projectId = confirmDelete.projectId;
      setDeleting(projectId);
      setConfirmDelete(null);
      try {
        await deleteProject(projectId);
        const nextProject = projects.find((p) => p.id !== projectId);
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        if (activeProjectId === projectId) {
          onActiveProjectChange(nextProject?.id || "");
        }
        showToast("Project deleted successfully.");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete project.";
        setProjectError(message);
      } finally {
        setDeleting(null);
      }
    } else {
      setDeleteAllLoading(true);
      setConfirmDelete(null);
      const projectIds = projects.filter((p) => p.id !== "default");
      const errors: string[] = [];
      for (const p of projectIds) {
        try {
          await deleteProject(p.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${p.id}: ${msg}`);
        }
      }
      if (errors.length === 0) {
        setProjects((prev) => prev.filter((p) => p.id === "default"));
        onActiveProjectChange("");
        showToast("All projects deleted successfully.");
      } else {
        setProjectError(`Failed to delete ${errors.length} project(s): ${errors.join("; ")}`);
        setProjects((prev) => prev.filter((p) => p.id === "default" || errors.some((e) => e.startsWith(p.id))));
      }
      setDeleteAllLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(null);
  };

  // ─── Project Handlers ────────────────────────────────────────────────────
  const handleCreateProject = async () => {
    const trimmedId = newProjectId.trim();
    const trimmedName = newProjectName.trim() || trimmedId;
    if (!trimmedId) {
      setProjectError("Project ID is required.");
      return;
    }
    const validationError = validateProjectName(trimmedName);
    if (validationError) {
      setProjectError(validationError);
      return;
    }
    setProjectError("");
    setCreating(true);
    try {
      const project = await createProject({ id: trimmedId, name: trimmedName });
      setProjects((prev) => [...prev, project]);
      setLastUsedProjectId(project.id);
      onActiveProjectChange(project.id);
      setNewProjectId("");
      setNewProjectName("");
      showToast("Project created successfully.");
    } catch (err) {
      const message = (err as { message?: string })?.message || (err as { error?: string })?.error || "Failed to create project.";
      setProjectError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectProject = async (projectId: string) => {
    setLastUsedProjectId(projectId);
    onActiveProjectChange(projectId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateProject();
    }
  };

  // ─── Knowledge Handlers ───────────────────────────────────────────────────
  const handleSaveInstructions = async () => {
    if (!activeProjectId) return;
    setInstructionsLoading(true);
    setInstructionsError("");
    try {
      const updated = await updateInstructions(activeProjectId, instructions);
      setKnowledge(updated);
      setInstructionsDirty(false);
    } catch (err) {
      setInstructionsError(err instanceof Error ? err.message : "Failed to save instructions.");
    } finally {
      setInstructionsLoading(false);
    }
  };

  // ─── Relationship Handlers ────────────────────────────────────────────────
  const handleConfirmRelationship = async (rel: KnowledgeRelationship) => {
    if (!activeProjectId || !knowledge) return;
    const sourceKey = `${rel.source.serviceId}::${rel.source.operationId}::${rel.source.location}::${rel.target.serviceId}::${rel.target.operationId}::${rel.target.location}`;
    const updated = await confirmRelationship(activeProjectId, sourceKey);
    if (updated) {
      setKnowledge(updated);
    }
  };

  const handleRejectRelationship = async (rel: KnowledgeRelationship) => {
    if (!activeProjectId || !knowledge) return;
    const sourceKey = `${rel.source.serviceId}::${rel.source.operationId}::${rel.source.location}::${rel.target.serviceId}::${rel.target.operationId}::${rel.target.location}`;
    const updated = await rejectRelationship(activeProjectId, sourceKey);
    if (updated) {
      setKnowledge(updated);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatRelationship = (rel: KnowledgeRelationship): string => {
    const src = `${rel.source.serviceId}/${rel.source.operationId}`;
    const tgt = `${rel.target.serviceId}/${rel.target.operationId}`;
    const srcLocation = rel.source.location.split(".").slice(-1)[0] || rel.source.location;
    const tgtLocation = rel.target.location.split(".").slice(-1)[0] || rel.target.location;
    return `${src} ${srcLocation} → ${tgt} ${tgtLocation}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "proposed": return { bg: "#fff3e0", text: "#e65100" };
      case "confirmed": return { bg: "#e3fcef", text: "#0a7c42" };
      case "rejected": return { bg: "#fce4e2", text: "#b44236" };
      default: return { bg: "#f5f5f5", text: "#616161" };
    }
  };

  /* ───────────────────────────────────────────────────────────────────
     NO ACTIVE PROJECT — Project Setup / Overview page
     ─────────────────────────────────────────────────────────────────── */
  if (!activeProjectId) {
    return (
      <section id="project-setup-page" className="project-setup-page">
        <div className="project-setup-container">
          {/* Page Introduction */}
          <div className="project-page-intro">
            <h2 id="project-setup-title">Create or select a project</h2>
            <p>Projects organize your APIs, tests, dependencies, runs, and results.</p>
          </div>

          {/* ─── Welcome Banner (empty state) ──────────────────────────────── */}
          {projects.length === 0 && (
            <div className="welcome-banner">
              <div className="welcome-logo">TF</div>
              <h2 className="welcome-title">Welcome to TestForge</h2>
              <p className="welcome-subtitle">Create your first project.</p>
              <button
                type="button"
                className="welcome-cta"
                onClick={() => document.getElementById("project-id-input")?.focus()}
              >
                <IconPlus />
                Create Project
              </button>
            </div>
          )}

          {/* Main Project Setup Card */}
          <div id="project-setup-card" className="project-setup-card">
            {/* Create New Project Section */}
            <div id="create-project-section">
              <div className="create-project-heading">
                <div className="section-icon"><IconPlus /></div>
                <div>
                  <h3>Create New Project</h3>
                  <p>Start a new workspace for a product, service, or API collection.</p>
                </div>
              </div>

              <div id="create-project-form" className="create-project-form">
                <div className="form-field">
                  <label htmlFor="project-id-input" className="form-label">Project ID</label>
                  <input
                    id="project-id-input"
                    type="text"
                    className="form-input"
                    placeholder="e.g. payments-api"
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="form-helper">Used as the unique project identifier.</div>
                </div>

                <div className="form-field">
                  <label htmlFor="project-name-input" className="form-label">
                    Project Name
                    <span className="optional-label">Optional</span>
                  </label>
                  <input
                    id="project-name-input"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Payments API"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="form-helper">A friendly display name for your team.</div>
                </div>

                <div className="form-field form-field-button">
                  <label className="form-label">&nbsp;</label>
                  <button
                    id="create-project-button"
                    type="button"
                    onClick={handleCreateProject}
                    disabled={creating}
                  >
                    <IconPlus />
                    Create Project
                  </button>
                  <div className="form-helper">&nbsp;</div>
                </div>
              </div>

              {projectError && (
                <div className="project-error">{projectError}</div>
              )}
            </div>

            {/* Divider — only show when there are existing projects */}
            {projects.length > 0 && <div className="project-section-divider" />}

            {/* Existing Projects Section — card grid */}
            {projects.length > 0 && (
              <div id="existing-projects-section">
                {/* ─── Last Used Project ─────────────────────────────────────── */}
                {lastUsedProject && (
                  <div className="last-used-project-section">
                    <div className="last-used-project-label">Last Used Project</div>
                    <div className="last-used-project-grid">
                      {(() => {
                        const cardData: ProjectCardData = {
                          id: lastUsedProject.id,
                          name: lastUsedProject.name || lastUsedProject.id,
                          createdAt: lastUsedProject.createdAt,
                          updatedAt: lastUsedProject.updatedAt,
                          isDefault: lastUsedProject.id === "default",
                          apiCount: null,
                          requirementCount: null,
                          testCaseCount: null,
                        };
                        return (
                          <ProjectCard
                            project={cardData}
                            isSelected={activeProjectId === lastUsedProject.id}
                            onSelect={handleSelectProject}
                            onDelete={(id) => {
                              setConfirmDelete({ type: "single", projectId: id });
                            }}
                            onRename={openRenameModal}
                            deleting={deleting === lastUsedProject.id}
                          />
                        );
                      })()}
                    </div>
                  </div>
                )}

                <div className="existing-projects-header">
                  <span>All Projects</span>
                  <button
                    type="button"
                    className="delete-all-btn"
                    onClick={handleDeleteAllProjects}
                    disabled={deleteAllLoading}
                  >
                    <IconTrash />
                    {deleteAllLoading ? "Deleting..." : "Delete All"}
                  </button>
                </div>

                {/* Search and Sort Controls */}
                <div className="project-toolbar">
                  <div className="project-search-wrapper">
                    <input
                      type="text"
                      placeholder="Search projects by name or ID..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      onKeyDown={handleSearchKeyDown}
                      aria-label="Search projects"
                      className="project-search-input"
                    />
                    {showClearSearch && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        aria-label="Clear search"
                        className="project-search-clear"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <SortDropdown
                    value={sortBy}
                    onChange={setSortBy}
                    options={SORT_OPTIONS}
                    aria-label="Sort projects"
                  />
                </div>

                {/* Filtered and Sorted Projects */}
                {otherProjects.length === 0 ? (
                  <div className="projects-empty-state" style={{ justifyContent: "center" }}>
                    <span>No matching projects found.</span>
                  </div>
                ) : (
                  <div className="project-grid">
                    {otherProjects.map((p) => {
                      const cardData: ProjectCardData = {
                        id: p.id,
                        name: p.name || p.id,
                        createdAt: p.createdAt,
                        updatedAt: p.updatedAt,
                        isDefault: p.id === "default",
                        apiCount: null,
                        requirementCount: null,
                        testCaseCount: null,
                      };
                      return (
                        <ProjectCard
                          key={p.id}
                          project={cardData}
                          isSelected={activeProjectId === p.id}
                          onSelect={handleSelectProject}
                          onDelete={(id) => {
                            setConfirmDelete({ type: "single", projectId: id });
                          }}
                          onRename={openRenameModal}
                          deleting={deleting === p.id}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Information Callout */}
          <div id="project-info-callout" className="project-info-callout">
            <div className="info-icon"><IconInfo /></div>
            <div>
              <strong>Everything stays organized</strong>
              <span>Your APIs, tests, dependencies, runs, and results stay together within each project.</span>
            </div>
          </div>
        </div>

        {/* ─── Delete Confirmation Modal ──────────────────────────────────── */}
        {confirmDelete && (
          <div className="modal-overlay" onClick={handleCancelDelete}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-icon"><IconTrash /></div>
                <h3 className="modal-title">
                  {confirmDelete.type === "single"
                    ? `Delete "${confirmDelete.projectId}"?`
                    : `Delete all ${projects.length} projects?`}
                </h3>
              </div>
              <p className="modal-body">
                {confirmDelete.type === "single"
                  ? `This will permanently delete project "${confirmDelete.projectId}" and all associated data. This action cannot be undone.`
                  : `This will permanently delete all ${projects.length} projects and all associated data. This action cannot be undone.`}
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn modal-btn-cancel"
                  onClick={handleCancelDelete}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="modal-btn modal-btn-delete"
                  onClick={handleConfirmDelete}
                >
                  <IconTrash />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Toast Notification ─────────────────────────────────────────── */}
        {toast && (
          <div style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            padding: "12px 20px",
            borderRadius: "8px",
            background: "var(--color-success-soft)",
            border: "1px solid var(--color-success)",
            color: "var(--green-deep)",
            fontSize: "14px",
            fontWeight: 500,
            boxShadow: "var(--shadow-card)",
            zIndex: 1200,
            animation: "slideIn 0.2s ease-out",
          }}>
            {toast.message}
          </div>
        )}

        {/* ─── Rename Modal ───────────────────────────────────────────────── */}
        {renameModalOpen && (
          <div className="modal-overlay" onClick={closeRenameModal}>
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </div>
                <h3 className="modal-title">Rename Project</h3>
              </div>
              <div className="modal-body">
                <div className="form-field">
                  <label htmlFor="rename-project-name" className="form-label">Project Name</label>
                  <input
                    id="rename-project-name"
                    type="text"
                    value={renameName}
                    onChange={(e) => {
                      setRenameName(e.target.value);
                      setRenameError("");
                    }}
                    onKeyDown={handleRenameKeyDown}
                    placeholder="Enter project name"
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      fontSize: "14px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "6px",
                      background: "var(--color-bg-surface)",
                      color: "var(--color-text-primary)",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                    marginTop: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "var(--color-bg-muted)",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontFamily: "monospace",
                      fontSize: "11px",
                      color: "var(--color-text-secondary)",
                      border: "1px dashed var(--color-border-strong)",
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      {renameProjectId}
                    </span>
                    <span style={{ fontSize: "11px", opacity: 0.8 }}>Read-only</span>
                  </div>
                  {renameError && (
                    <div style={{
                      color: "var(--red)",
                      fontSize: "12px",
                      marginTop: "6px",
                    }}>
                      {renameError}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn modal-btn-cancel"
                  onClick={closeRenameModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="modal-btn modal-btn-delete"
                  onClick={handleRenameSave}
                  disabled={renaming}
                  style={{
                    background: "var(--color-primary)",
                    border: "none",
                    color: "#fff",
                  }}
                >
                  {renaming ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  /* ───────────────────────────────────────────────────────────────────
     ACTIVE PROJECT — Project Knowledge page
     ─────────────────────────────────────────────────────────────────── */
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
      {/* Project header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "24px"
      }}>
        <div>
          <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)" }}>
            Active Project
          </span>
          <h2 style={{ margin: "4px 0 0 0", color: "var(--color-text-primary)" }}>
            {activeProject?.name || activeProjectId}
          </h2>
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
            ID: {activeProjectId}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onActiveProjectChange("")}
          style={{
            padding: "6px 12px", fontSize: "13px",
            border: "1px solid var(--color-border)", borderRadius: "4px",
            background: "var(--color-bg-surface)", cursor: "pointer", color: "var(--color-text-primary)"
          }}
        >
          Change Project
        </button>
      </div>

      {/* ─── Section: Project Knowledge ───────────────────────────────────── */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)", borderRadius: "8px",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--color-border)",
          background: "var(--violet-soft)"
        }}>
          <h3 style={{ margin: 0, display: "inline", fontSize: "17px", color: "var(--violet)" }}>
            Project Knowledge
          </h3>
        </div>
        <div style={{ padding: "18px" }}>
          <label style={{
            display: "block", fontSize: "12px", fontWeight: 600,
            color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "6px"
          }}>
            Instructions
          </label>
          <textarea
            placeholder="Describe how your APIs relate to each other. For example: The token from generate-token is used as Bearer Authorization for login..."
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              setInstructionsDirty(true);
            }}
            rows={5}
            style={{
              width: "100%", padding: "10px 12px", fontSize: "14px",
              border: "1px solid var(--color-border)", borderRadius: "6px",
              background: "var(--color-bg-surface)", color: "var(--color-text-primary)",
              resize: "vertical", fontFamily: "inherit",
              boxSizing: "border-box"
            }}
          />
          <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleSaveInstructions}
              disabled={!instructionsDirty || instructionsLoading}
              style={{
                padding: "8px 16px", fontSize: "14px", fontWeight: 600,
                color: "#fff",
                background: (!instructionsDirty || instructionsLoading) ? "var(--color-border)" : "var(--violet)",
                border: "none", borderRadius: "6px",
                cursor: (!instructionsDirty || instructionsLoading) ? "not-allowed" : "pointer"
              }}
            >
              {instructionsLoading ? "Saving..." : "Save & Analyze"}
            </button>
            {knowledge && (
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                Last updated: {new Date(knowledge.updatedAt).toLocaleString()}
              </span>
            )}
          </div>
          {instructionsError && (
            <p style={{ color: "var(--red)", fontSize: "13px", marginTop: "8px" }}>
              {instructionsError}
            </p>
          )}
        </div>
      </section>

      {/* ─── Section: Relationships ────────────────────────────────────────── */}
      {knowledge && knowledge.relationships && knowledge.relationships.length > 0 && (
        <section style={{
          border: "1px solid var(--color-border)", borderRadius: "8px",
          background: "var(--color-bg-surface)", overflow: "hidden"
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--color-border)",
            background: "var(--green-soft)"
          }}>
            <span style={{
              width: "30px", height: "30px", display: "inline-flex",
              alignItems: "center", justifyContent: "center",
              borderRadius: "8px", fontWeight: 800,
              background: "var(--green)", color: "#fff", marginRight: "10px"
            }}>
              3
            </span>
            <h3 style={{ margin: 0, display: "inline", fontSize: "17px", color: "var(--green-deep)" }}>
              API Dependencies
            </h3>
          </div>
          <div style={{ padding: "18px" }}>
            <div style={{ fontSize: "13px", color: "var(--color-text-primary)", marginBottom: "12px" }}>
              {knowledge.relationships.filter((r: any) => r.status === "confirmed").length} dependency configured
              {knowledge.relationships.filter((r: any) => r.status === "proposed").length > 0 && (
                <span style={{ color: "var(--color-text-muted)" }}> · {knowledge.relationships.filter((r: any) => r.status === "proposed").length} pending review</span>
              )}
            </div>
            <details style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Advanced Relationships</summary>
              {(["proposed", "confirmed", "rejected"] as const).map((status) => {
                const filtered = knowledge.relationships.filter((r: any) => r.status === status);
                if (filtered.length === 0) return null;
                const colors = getStatusColor(status);
                return (
                  <div key={status} style={{ marginBottom: "12px" }}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: "4px",
                      fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                      background: colors.bg, color: colors.text, marginBottom: "8px"
                    }}>
                      {status} ({filtered.length})
                    </span>
                    <div style={{ display: "grid", gap: "6px" }}>
                      {filtered.map((rel: KnowledgeRelationship, idx: number) => (
                        <div key={idx} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", border: "1px solid var(--color-border)",
                          borderRadius: "6px", background: "var(--color-bg-subtle)",
                          fontSize: "13px"
                        }}>
                          <div>
                            <span style={{ fontWeight: 500 }}>{formatRelationship(rel)}</span>
                            <span style={{
                              display: "inline-block", marginLeft: "8px",
                              padding: "1px 6px", borderRadius: "3px",
                              fontSize: "11px", fontWeight: 600,
                              background: colors.bg, color: colors.text
                            }}>
                              {rel.type}
                            </span>
                          </div>
                          {rel.status === "proposed" && (
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() => handleConfirmRelationship(rel)}
                                style={{
                                  padding: "4px 10px", fontSize: "12px", fontWeight: 600,
                                  color: "#fff", background: "var(--green)",
                                  border: "none", borderRadius: "4px", cursor: "pointer"
                                }}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectRelationship(rel)}
                                style={{
                                  padding: "4px 10px", fontSize: "12px", fontWeight: 600,
                                  color: "#fff", background: "var(--red)",
                                  border: "none", borderRadius: "4px", cursor: "pointer"
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </details>
          </div>
        </section>
      )}
    </div>
  );
}