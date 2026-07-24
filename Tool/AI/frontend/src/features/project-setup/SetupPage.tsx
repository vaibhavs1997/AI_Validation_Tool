/**
 * Project Setup Page (Step 5.2)
 *
 * Sections:
 * 1. Project selector + create
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
    try {
      const project = await createProject({ id: trimmedId, name: trimmedName });
      setProjects((prev) => [...prev, project]);
      onActiveProjectChange(project.id);
      setNewProjectId("");
      setNewProjectName("");
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : "Failed to create project.");
    }
  };

  const handleSelectProject = (projectId: string) => {
    onActiveProjectChange(projectId);
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

  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ marginBottom: "20px" }}>Project Setup</h2>
        <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
          Select or create a project to get started.
        </p>

        {/* Existing projects */}
        {projects.length > 0 && (
          <section style={{ marginBottom: "24px" }}>
            <h3 style={{
              fontSize: "13px", fontWeight: 700, textTransform: "uppercase",
              color: "var(--muted)", marginBottom: "8px"
            }}>
              Existing Projects
            </h3>
            <div style={{ display: "grid", gap: "8px" }}>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProject(p.id)}
                  style={{
                    textAlign: "left", padding: "10px 14px",
                    border: "1px solid var(--line)", borderRadius: "6px",
                    background: "var(--surface)", cursor: "pointer",
                    color: "var(--ink)", fontSize: "14px"
                  }}
                >
                  <strong>{p.name}</strong>
                  <span style={{ color: "var(--muted)", marginLeft: "8px", fontSize: "12px" }}>
                    {p.id}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Create project */}
        <section style={{ marginBottom: "24px" }}>
          <h3 style={{
            fontSize: "13px", fontWeight: 700, textTransform: "uppercase",
            color: "var(--muted)", marginBottom: "8px"
          }}>
            Create New Project
          </h3>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              placeholder="Project ID (e.g. my-project)"
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
              style={{
                flex: 1, padding: "8px 12px", fontSize: "14px",
                border: "1px solid var(--line)", borderRadius: "6px",
                background: "var(--surface)", color: "var(--ink)"
              }}
            />
            <input
              type="text"
              placeholder="Project Name (optional)"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              style={{
                flex: 1, padding: "8px 12px", fontSize: "14px",
                border: "1px solid var(--line)", borderRadius: "6px",
                background: "var(--surface)", color: "var(--ink)"
              }}
            />
            <button
              type="button"
              onClick={handleCreateProject}
              style={{
                padding: "8px 16px", fontSize: "14px", fontWeight: 600,
                color: "#fff", background: "var(--violet)",
                border: "none", borderRadius: "6px", cursor: "pointer"
              }}
            >
              Create
            </button>
          </div>
          {projectError && (
            <p style={{ color: "var(--red)", fontSize: "13px", margin: 0 }}>{projectError}</p>
          )}
        </section>
      </div>
    );
  }

  // Active project loaded
  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
      {/* Project header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "24px"
      }}>
        <div>
          <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
            Active Project
          </span>
          <h2 style={{ margin: "4px 0 0 0" }}>
            {activeProject?.name || activeProjectId}
          </h2>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            ID: {activeProjectId}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onActiveProjectChange("")}
          style={{
            padding: "6px 12px", fontSize: "13px",
            border: "1px solid var(--line)", borderRadius: "4px",
            background: "var(--surface)", cursor: "pointer", color: "var(--ink)"
          }}
        >
          Change Project
        </button>
      </div>

      {/* ─── Section: APIs / Services ─────────────────────────────────────── */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--line)", borderRadius: "8px",
        background: "var(--surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--line)",
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
              <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                Registered Services ({services.length})
              </span>
              <div style={{ marginTop: "8px", display: "grid", gap: "6px" }}>
                {services.map((s) => (
                  <div key={s.id} style={{
                    padding: "8px 12px", border: "1px solid var(--line)",
                    borderRadius: "6px", background: "var(--surface-alt)",
                    fontSize: "13px"
                  }}>
                    <strong>{s.name}</strong>
                    <span style={{ color: "var(--muted)", marginLeft: "8px" }}>{s.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source selector (reuse existing tab pattern) */}
          <div style={{
            display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px"
          }}>
            <label style={{ fontSize: "12px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
              Source
            </label>
            <div style={{
              display: "flex", gap: "4px", border: "1px solid var(--line)",
              borderRadius: "6px", overflow: "hidden"
            }}>
              <span
                onClick={() => setContractInputMode("upload")}
                style={{
                  padding: "6px 14px", fontSize: "13px", fontWeight: 700,
                  cursor: "pointer",
                  color: contractInputMode === "upload" ? "#fff" : "var(--muted)",
                  background: contractInputMode === "upload" ? "var(--blue)" : "var(--surface)"
                }}
              >
                Upload File
              </span>
              <span
                onClick={() => setContractInputMode("paste")}
                style={{
                  padding: "6px 14px", fontSize: "13px", fontWeight: 700,
                  cursor: "pointer",
                  color: contractInputMode === "paste" ? "#fff" : "var(--muted)",
                  background: contractInputMode === "paste" ? "var(--blue)" : "var(--surface)"
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
                  color: "#fff", background: registerLoading ? "var(--line)" : "var(--blue)",
                  border: "none", borderRadius: "6px",
                  cursor: registerLoading ? "not-allowed" : "pointer"
                }}
              >
                {registerLoading ? "Registering..." : "Register Service"}
              </button>
            </div>
          )}

          {registerSuccess && (
            <p style={{ color: "var(--green)", fontSize: "13px", marginTop: "8px" }}>
              ✓ {registerSuccess}
            </p>
          )}
        </div>
      </section>

      {/* ─── Section: Project Knowledge ───────────────────────────────────── */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--line)", borderRadius: "8px",
        background: "var(--surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--line)",
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
            color: "var(--muted)", textTransform: "uppercase", marginBottom: "6px"
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
              border: "1px solid var(--line)", borderRadius: "6px",
              background: "var(--surface)", color: "var(--ink)",
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
                background: (!instructionsDirty || instructionsLoading) ? "var(--line)" : "var(--violet)",
                border: "none", borderRadius: "6px",
                cursor: (!instructionsDirty || instructionsLoading) ? "not-allowed" : "pointer"
              }}
            >
              {instructionsLoading ? "Saving..." : "Save & Analyze"}
            </button>
            {knowledge && (
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
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
          border: "1px solid var(--line)", borderRadius: "8px",
          background: "var(--surface)", overflow: "hidden"
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--line)",
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
            <div style={{ fontSize: "13px", color: "var(--ink)", marginBottom: "12px" }}>
              {knowledge.relationships.filter((r) => r.status === "confirmed").length} dependency configured
              {knowledge.relationships.filter((r) => r.status === "proposed").length > 0 && (
                <span style={{ color: "var(--muted)" }}> · {knowledge.relationships.filter((r) => r.status === "proposed").length} pending review</span>
              )}
            </div>
            <details style={{ fontSize: "12px", color: "var(--muted)" }}>
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
                          padding: "8px 12px", border: "1px solid var(--line)",
                          borderRadius: "6px", background: "var(--surface-alt)",
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