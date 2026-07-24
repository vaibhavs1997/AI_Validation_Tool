/**
 * Project Setup Page
 *
 * Sections:
 * 1. Project selector + create (when no active project)
 * 2. APIs / Services (reuses existing contract parsing)
 * 3. Project Knowledge (instructions)
 * 4. Relationships (proposed/confirmed/rejected)
 */

import { useState, useEffect, useCallback } from "react";
import type { Project, ServiceDefinition, ProjectKnowledge, KnowledgeRelationship } from "../../types";
import { listProjects, createProject } from "./ProjectService";
import { registerService, listServices } from "./ServiceRegistrationService";
import { getProjectKnowledge, updateInstructions, confirmRelationship, rejectRelationship } from "./KnowledgeService";
import { parseApiContract } from "../api-collection/ApiCollectionService";
import { ContractPaster } from "../api-collection/ContractPaster";
import { ContractUploader } from "../api-collection/ContractUploader";
import type { ApiContract } from "../api-collection/ApiCollectionTypes";
import type { ApiError } from "../../services";

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

const IconFolderPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    <path d="M12 11v6M9 14h6" />
  </svg>
);

const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
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

  // ─── Services Section ─────────────────────────────────────────────────────
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [contractInputMode, setContractInputMode] = useState<"upload" | "paste">("upload");
  const [pastedJsonDraft, setPastedJsonDraft] = useState("");
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsedContract, setParsedContract] = useState<ApiContract | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState("");

  // ─── Knowledge Section ────────────────────────────────────────────────────
  const [knowledge, setKnowledge] = useState<ProjectKnowledge | null>(null);
  const [instructions, setInstructions] = useState("");
  const [instructionsDirty, setInstructionsDirty] = useState(false);
  const [instructionsLoading, setInstructionsLoading] = useState(false);
  const [instructionsError, setInstructionsError] = useState("");

  // ─── Project Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => {});
  }, []);

  const loadProjectData = useCallback(async (projectId: string) => {
    try {
      const [svcs, kn] = await Promise.all([
        listServices(projectId),
        getProjectKnowledge(projectId).catch(() => null),
      ]);
      setServices(svcs);
      setKnowledge(kn);
      if (kn) {
        setInstructions(kn.instructions || "");
      } else {
        setInstructions("");
      }
    } catch {
      setServices([]);
      setKnowledge(null);
    }
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      loadProjectData(activeProjectId);
    }
  }, [activeProjectId, loadProjectData]);

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

  // ─── Contract/Service Handlers ────────────────────────────────────────────
  const handleParse = async () => {
    const trimmed = pastedJsonDraft.trim();
    if (!trimmed) {
      setParseError("Enter or paste an API collection before parsing.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      setParseError("Invalid JSON. Check the collection syntax and try again.");
      return;
    }
    setParseLoading(true);
    setParseError("");
    setRegisterSuccess("");
    try {
      const contract = await parseApiContract(parsed, "pasted-contract");
      setParsedContract(contract);
    } catch (err) {
      const apiErr = err as ApiError;
      setParseError(apiErr.message || "Unable to parse API collection.");
    } finally {
      setParseLoading(false);
    }
  };

  const handleRegisterService = async () => {
    if (!activeProjectId || !parsedContract) return;
    setRegisterLoading(true);
    setParseError("");
    setRegisterSuccess("");
    try {
      const result = await registerService(activeProjectId, parsedContract);
      setServices((prev) => [...prev, result.service]);
      setRegisterSuccess(`Service "${result.service.name}" registered successfully.`);
      setParsedContract(null);
      setPastedJsonDraft("");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to register service.");
    } finally {
      setRegisterLoading(false);
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
            <h2 id="project-setup-title">Project Setup</h2>
            <p>Create or select a project to start testing your APIs.</p>
          </div>

          {/* Main Project Setup Card */}
          <div id="project-setup-card" className="project-setup-card">
            {/* Card Intro Header */}
            <div className="project-card-header">
              <div className="project-card-icon"><IconFolder /></div>
              <div>
                <h3>Choose your project</h3>
                <p>Projects organize your APIs, tests, dependencies, runs, and results.</p>
              </div>
            </div>

            {/* Existing Projects Section */}
            <div id="existing-projects-section">
              <div className="existing-projects-header">Existing Projects</div>
              {projects.length > 0 ? (
                projects.map((p) => (
                  <button
                    key={p.id}
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
                ))
              ) : (
                <div id="projects-empty-state" className="projects-empty-state">
                  <div className="projects-empty-state-icon"><IconFolderPlus /></div>
                  <div>
                    <strong>No projects yet</strong>
                    <span>Create your first project below to start testing APIs.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="project-section-divider" />

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

                <button
                  id="create-project-button"
                  type="button"
                  onClick={handleCreateProject}
                  disabled={creating}
                >
                  <IconPlus />
                  Create Project
                </button>
              </div>

              {projectError && (
                <div className="project-error">{projectError}</div>
              )}
            </div>
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
      </section>
    );
  }

  /* ───────────────────────────────────────────────────────────────────
     ACTIVE PROJECT — Project detail view (services, knowledge, etc.)
     ─────────────────────────────────────────────────────────────────── */
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
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

      {/* ─── Section: APIs / Services ─────────────────────────────────────── */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)", borderRadius: "8px",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--color-border)",
          background: "var(--blue-soft)"
        }}>
          <span style={{
            width: "30px", height: "30px", display: "inline-flex",
            alignItems: "center", justifyContent: "center",
            borderRadius: "8px", fontWeight: 800,
            background: "var(--blue)", color: "#fff", marginRight: "10px"
          }}>
            [1]
          </span>
          <h3 style={{ margin: 0, display: "inline", fontSize: "17px", color: "var(--blue-deep)" }}>
            APIs / Services
          </h3>
        </div>
        <div style={{ padding: "18px" }}>
          {/* Registered services list */}
          {services.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                Registered Services ({services.length})
              </span>
              <div style={{ marginTop: "8px", display: "grid", gap: "6px" }}>
                {services.map((s) => (
                  <div key={s.id} style={{
                    padding: "8px 12px", border: "1px solid var(--color-border)",
                    borderRadius: "6px", background: "var(--color-bg-subtle)",
                    fontSize: "13px"
                  }}>
                    <strong>{s.name}</strong>
                    <span style={{ color: "var(--color-text-muted)", marginLeft: "8px" }}>{s.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source selector (reuse existing tab pattern) */}
          <div style={{
            display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px"
          }}>
            <label style={{ fontSize: "12px", fontWeight: 800, color: "var(--color-text-muted)", textTransform: "uppercase" }}>
              Source
            </label>
            <div style={{
              display: "flex", gap: "4px", border: "1px solid var(--color-border)",
              borderRadius: "6px", overflow: "hidden"
            }}>
              <span
                onClick={() => setContractInputMode("upload")}
                style={{
                  padding: "6px 14px", fontSize: "13px", fontWeight: 700,
                  cursor: "pointer",
                  color: contractInputMode === "upload" ? "#fff" : "var(--color-text-muted)",
                  background: contractInputMode === "upload" ? "var(--blue)" : "var(--color-bg-surface)"
                }}
              >
                Upload File
              </span>
              <span
                onClick={() => setContractInputMode("paste")}
                style={{
                  padding: "6px 14px", fontSize: "13px", fontWeight: 700,
                  cursor: "pointer",
                  color: contractInputMode === "paste" ? "#fff" : "var(--color-text-muted)",
                  background: contractInputMode === "paste" ? "var(--blue)" : "var(--color-bg-surface)"
                }}
              >
                Paste JSON
              </span>
            </div>
          </div>

          {/* Contract upload/paste - reuse existing components */}
          {contractInputMode === "upload" ? (
            <ContractUploader
              onContractParsed={(contract) => {
                setParsedContract(contract);
                if (contract && activeProjectId) {
                  registerService(activeProjectId, contract)
                    .then((result) => {
                      setServices((prev) => [...prev, result.service]);
                      setRegisterSuccess(`Service "${result.service.name}" registered.`);
                    })
                    .catch((err) => setParseError(err.message));
                }
              }}
              activeContract={parsedContract}
            />
          ) : (
            <ContractPaster
              jsonText={pastedJsonDraft}
              onDraftChange={setPastedJsonDraft}
              onParse={handleParse}
              onSample={() => {}}
              loading={parseLoading}
              error={parseError}
              parsedContract={parsedContract}
            />
          )}

          {/* Register button for paste mode */}
          {contractInputMode === "paste" && parsedContract && (
            <div style={{ marginTop: "12px" }}>
              <button
                type="button"
                onClick={handleRegisterService}
                disabled={registerLoading}
                style={{
                  padding: "8px 16px", fontSize: "14px", fontWeight: 600,
                  color: "#fff", background: registerLoading ? "var(--color-border)" : "var(--blue)",
                  border: "none", borderRadius: "6px",
                  cursor: registerLoading ? "not-allowed" : "pointer"
                }}
              >
                {registerLoading ? "Registering..." : "Register Service"}
              </button>
            </div>
          )}

          {registerSuccess && (
            <p style={{ color: "var(--color-success)", fontSize: "13px", marginTop: "8px" }}>
              ✓ {registerSuccess}
            </p>
          )}
        </div>
      </section>

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
          <span style={{
            width: "30px", height: "30px", display: "inline-flex",
            alignItems: "center", justifyContent: "center",
            borderRadius: "8px", fontWeight: 800,
            background: "var(--violet)", color: "#fff", marginRight: "10px"
          }}>
            [2]
          </span>
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
      {knowledge && knowledge.relationships.length > 0 && (
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
              {knowledge.relationships.filter((r) => r.status === "confirmed").length} dependency configured
              {knowledge.relationships.filter((r) => r.status === "proposed").length > 0 && (
                <span style={{ color: "var(--color-text-muted)" }}> · {knowledge.relationships.filter((r) => r.status === "proposed").length} pending review</span>
              )}
            </div>
            <details style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Advanced Relationships</summary>
              {(["proposed", "confirmed", "rejected"] as const).map((status) => {
                const filtered = knowledge.relationships.filter((r) => r.status === status);
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
                      {filtered.map((rel, idx) => (
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