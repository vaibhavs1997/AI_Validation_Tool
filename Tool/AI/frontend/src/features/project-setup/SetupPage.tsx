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
import { listProjects, createProject, deleteProject } from "./ProjectService";
import { getProjectKnowledge, updateInstructions, confirmRelationship, rejectRelationship } from "./KnowledgeService";

// SVG Icon Components
const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
);

const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
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
  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete({ type: "single", projectId });
  };

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
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        if (activeProjectId === projectId) {
          onActiveProjectChange("");
        }
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
    setProjectError("");
    setCreating(true);
    try {
      const project = await createProject({ id: trimmedId, name: trimmedName });
      setProjects((prev) => [...prev, project]);
      onActiveProjectChange(project.id);
      setNewProjectId("");
      setNewProjectName("");
    } catch (err) {
      const message = (err as { message?: string })?.message || (err as { error?: string })?.error || "Failed to create project.";
      setProjectError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectProject = (projectId: string) => {
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

            {/* Existing Projects Section — only when there are projects */}
            {projects.length > 0 && (
              <div id="existing-projects-section">
                <div className="existing-projects-header">
                  <span>Existing Projects</span>
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
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="project-option-wrapper"
                  >
                    <button
                      type="button"
                      className="project-option"
                      data-project-id={p.id}
                      onClick={() => handleSelectProject(p.id)}
                    >
                      <div className="project-option-icon"><IconFolder /></div>
                      <div className="project-option-content">
                        <div className="project-option-name">{p.name || p.id}</div>
                        <div className="project-option-meta">
                          Project ID: <span className="project-id-badge">{p.id}</span>
                        </div>
                      </div>
                      <div className="project-option-action"><IconChevronRight /></div>
                    </button>
                    <button
                      type="button"
                      className="project-delete-btn"
                      onClick={(e) => handleDeleteProject(p.id, e)}
                      disabled={deleting === p.id}
                      title={`Delete ${p.name || p.id}`}
                    >
                      {deleting === p.id ? "..." : <IconTrash />}
                    </button>
                  </div>
                ))}
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