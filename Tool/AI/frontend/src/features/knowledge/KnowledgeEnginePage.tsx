/**
 * KnowledgeEnginePage
 *
 * Transformed Knowledge Engine — the central place to understand API relationships.
 *
 * Sections:
 * 1. Project Overview — services, operations, relationships, auth flows, last analysis
 * 2. Project Instructions — instruction editor with save status
 * 3. AI Analysis Summary — auth relationships, data dependencies, variable mappings, confidence
 * 4. Relationship Review — review table with confirm/reject
 * 5. Knowledge Health — summary card with checkmarks
 * 6. Navigation — recommend next step when all confirmed
 *
 * Reuses existing domain models:
 *   - ProjectKnowledge
 *   - KnowledgeRelationship
 *   - ProjectKnowledgeAnalyzer (via backend /api/knowledge/instructions)
 *   - DependencyResolver (via backend relationship endpoints)
 */

import { useState, useEffect, useCallback } from "react";
import type { ProjectKnowledge, KnowledgeRelationship, ServiceDefinition, ApiModel } from "../../types";
import {
  getProjectKnowledge,
  updateInstructions,
  listServices,
  getServiceApiModel,
  confirmRelationship,
  rejectRelationship,
  computeRelationshipKey,
} from "./KnowledgeService";

// ─── SVG Icon Components ─────────────────────────────────────────────────────

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

const IconDatabase = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

// ─── Interface ───────────────────────────────────────────────────────────────

interface KnowledgeEnginePageProps {
  activeProjectId: string | null;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getStatusStyle(status: string) {
  switch (status) {
    case "proposed": return { bg: "var(--yellow-soft, #fff8e1)", text: "var(--yellow-deep, #f57f17)", border: "var(--yellow, #ffc107)" };
    case "confirmed": return { bg: "var(--green-soft, #e8f5e9)", text: "var(--green-deep, #2e7d32)", border: "var(--green, #4caf50)" };
    case "rejected": return { bg: "var(--red-soft, #ffebee)", text: "var(--red-deep, #c62828)", border: "var(--red, #ef5350)" };
    default: return { bg: "var(--surface-alt, #f5f5f5)", text: "var(--muted, #9e9e9e)", border: "var(--line, #e0e0e0)" };
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "authentication": return <IconShield />;
    case "data_dependency": return <IconDatabase />;
    default: return <IconInfo />;
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "authentication": return "Auth";
    case "data_dependency": return "Data Dep";
    default: return type;
  }
}

function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function getConfidenceColor(score: number): string {
  if (score >= 0.8) return "var(--green-deep, #2e7d32)";
  if (score >= 0.5) return "var(--yellow-deep, #f57f17)";
  return "var(--red-deep, #c62828)";
}

function getConfidenceBg(score: number): string {
  if (score >= 0.8) return "var(--green-soft, #e8f5e9)";
  if (score >= 0.5) return "var(--yellow-soft, #fff8e1)";
  return "var(--red-soft, #ffebee)";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function KnowledgeEnginePage({ activeProjectId }: KnowledgeEnginePageProps) {
  // ─── State ───────────────────────────────────────────────────────────────
  const [knowledge, setKnowledge] = useState<ProjectKnowledge | null>(null);
  const [instructions, setInstructions] = useState("");
  const [instructionsDirty, setInstructionsDirty] = useState(false);
  const [instructionsLoading, setInstructionsLoading] = useState(false);
  const [instructionsError, setInstructionsError] = useState("");
  const [instructionsSaved, setInstructionsSaved] = useState(false);

  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [apiModels, setApiModels] = useState<ApiModel[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ─── Derived Data ────────────────────────────────────────────────────────
  const totalOperations = apiModels.reduce((sum, m) => sum + (m.operations?.length || 0), 0);
  const relationships = knowledge?.relationships || [];
  const proposedRelationships = relationships.filter((r) => r.status === "proposed");
  const confirmedRelationships = relationships.filter((r) => r.status === "confirmed");
  const rejectedRelationships = relationships.filter((r) => r.status === "rejected");
  const authRelationships = relationships.filter((r) => r.type === "authentication");
  const dataDependencyRelationships = relationships.filter((r) => r.type === "data_dependency");
  const allConfirmed = relationships.length > 0 && proposedRelationships.length === 0;
  const hasKnowledge = knowledge !== null && knowledge !== undefined;

  // ─── Load Data ───────────────────────────────────────────────────────────
  const loadAll = useCallback(async (projectId: string) => {
    setLoading(true);
    setError("");

    try {
      // Load knowledge
      const kn = await getProjectKnowledge(projectId).catch(() => null);
      setKnowledge(kn);
      if (kn) {
        setInstructions(kn.instructions || "");
      } else {
        setInstructions("");
      }

      // Load services
      setLoadingServices(true);
      const svcs = await listServices(projectId).catch(() => []);
      setServices(svcs);

      // Load API models for each service to count operations
      const models: ApiModel[] = [];
      for (const svc of svcs) {
        try {
          const { apiModel } = await getServiceApiModel(projectId, svc.id);
          if (apiModel) {
            models.push(apiModel);
          }
        } catch {
          // skip services without models
        }
      }
      setApiModels(models);
      setLoadingServices(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      loadAll(activeProjectId);
    } else {
      setKnowledge(null);
      setInstructions("");
      setServices([]);
      setApiModels([]);
    }
  }, [activeProjectId, loadAll]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleSaveInstructions = async () => {
    if (!activeProjectId) return;
    setInstructionsLoading(true);
    setInstructionsError("");
    setInstructionsSaved(false);
    try {
      const updated = await updateInstructions(activeProjectId, instructions);
      setKnowledge(updated);
      setInstructionsDirty(false);
      setInstructionsSaved(true);
      setTimeout(() => setInstructionsSaved(false), 3000);
    } catch (err) {
      setInstructionsError(err instanceof Error ? err.message : "Failed to save instructions.");
    } finally {
      setInstructionsLoading(false);
    }
  };

  const handleConfirmRelationship = async (rel: KnowledgeRelationship) => {
    if (!activeProjectId || !knowledge) return;
    const sourceKey = computeRelationshipKey(rel);
    const updated = await confirmRelationship(activeProjectId, sourceKey);
    if (updated) {
      setKnowledge(updated);
    }
  };

  const handleRejectRelationship = async (rel: KnowledgeRelationship) => {
    if (!activeProjectId || !knowledge) return;
    const sourceKey = computeRelationshipKey(rel);
    const updated = await rejectRelationship(activeProjectId, sourceKey);
    if (updated) {
      setKnowledge(updated);
    }
  };

  const handleRefresh = () => {
    if (activeProjectId) {
      loadAll(activeProjectId);
    }
  };

  // ─── No Project State ────────────────────────────────────────────────────
  if (!activeProjectId) {
    return (
      <section style={{
        padding: "22px", maxWidth: "1520px", margin: "0 auto",
        border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-border)", background: "var(--violet-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              width: "30px", height: "30px", display: "inline-flex",
              alignItems: "center", justifyContent: "center",
              borderRadius: "8px", fontWeight: 800,
              background: "var(--violet)", color: "#fff", fontSize: "14px"
            }}>
              K
            </span>
            <h2 style={{ margin: 0, fontSize: "17px", color: "var(--violet-deep)" }}>Knowledge Engine</h2>
          </div>
        </div>
        <div style={{ padding: "18px" }}>
          <p style={{ color: "var(--muted)", fontSize: "13px" }}>
            Select a project to view its knowledge graph, API relationships, and dependency analysis.
          </p>
        </div>
      </section>
    );
  }

  // ─── Loading State ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <section style={{
        padding: "22px", maxWidth: "1520px", margin: "0 auto",
        border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-border)", background: "var(--violet-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              width: "30px", height: "30px", display: "inline-flex",
              alignItems: "center", justifyContent: "center",
              borderRadius: "8px", fontWeight: 800,
              background: "var(--violet)", color: "#fff", fontSize: "14px"
            }}>
              K
            </span>
            <h2 style={{ margin: 0, fontSize: "17px", color: "var(--violet-deep)" }}>Knowledge Engine</h2>
          </div>
        </div>
        <div style={{ padding: "18px" }}>
          <p style={{ color: "var(--muted)", fontSize: "13px" }}>Loading knowledge data...</p>
        </div>
      </section>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <section style={{
        padding: "22px", maxWidth: "1520px", margin: "0 auto",
        border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--color-border)", background: "var(--violet-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              width: "30px", height: "30px", display: "inline-flex",
              alignItems: "center", justifyContent: "center",
              borderRadius: "8px", fontWeight: 800,
              background: "var(--violet)", color: "#fff", fontSize: "14px"
            }}>
              K
            </span>
            <h2 style={{ margin: 0, fontSize: "17px", color: "var(--violet-deep)" }}>Knowledge Engine</h2>
          </div>
        </div>
        <div style={{ padding: "18px" }}>
          <div style={{
            padding: "10px 12px", background: "var(--red-soft)", border: "1px solid var(--red)",
            borderRadius: "6px", fontSize: "13px", color: "var(--red-deep)", marginBottom: "12px"
          }}>
            {error}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            style={{
              padding: "6px 12px", fontSize: "13px", fontWeight: 600,
              border: "1px solid var(--color-border)", borderRadius: "4px",
              background: "var(--color-bg-surface)", cursor: "pointer", color: "var(--color-text-primary)"
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <IconRefresh /> Retry
            </span>
          </button>
        </div>
      </section>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "20px"
      }}>
        <div>
          <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)" }}>
            Knowledge Engine
          </span>
          <h2 style={{ margin: "4px 0 0 0", color: "var(--color-text-primary)", fontSize: "20px" }}>
            API Relationship Analysis
          </h2>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          style={{
            padding: "6px 12px", fontSize: "13px", fontWeight: 600,
            border: "1px solid var(--color-border)", borderRadius: "4px",
            background: "var(--color-bg-surface)", cursor: "pointer", color: "var(--color-text-primary)",
            display: "inline-flex", alignItems: "center", gap: "6px"
          }}
        >
          <IconRefresh /> Refresh
        </button>
      </div>

      {/* ─── SECTION 1: Project Overview ──────────────────────────────────── */}
      <section style={{
        marginBottom: "18px",
        border: "1px solid var(--color-border)", borderRadius: "8px",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--color-border)",
          background: "var(--violet-soft)"
        }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--violet-deep)" }}>
            Project Overview
          </h3>
        </div>
        <div style={{ padding: "16px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px"
          }}>
            {/* Services */}
            <div style={{
              padding: "12px", borderRadius: "6px",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-subtle)"
            }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: "4px" }}>
                Services
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--violet)" }}>
                {loadingServices ? "..." : services.length}
              </div>
            </div>

            {/* Operations */}
            <div style={{
              padding: "12px", borderRadius: "6px",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-subtle)"
            }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: "4px" }}>
                API Operations
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--violet)" }}>
                {loadingServices ? "..." : totalOperations}
              </div>
            </div>

            {/* Relationships */}
            <div style={{
              padding: "12px", borderRadius: "6px",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-subtle)"
            }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: "4px" }}>
                Relationships
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--violet)" }}>
                {relationships.length}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                {confirmedRelationships.length} confirmed · {proposedRelationships.length} proposed
              </div>
            </div>

            {/* Auth Flows */}
            <div style={{
              padding: "12px", borderRadius: "6px",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-subtle)"
            }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: "4px" }}>
                Auth Flows
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--violet)" }}>
                {authRelationships.length}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                {authRelationships.filter((r) => r.status === "confirmed").length} configured
              </div>
            </div>

            {/* Last Analysis */}
            <div style={{
              padding: "12px", borderRadius: "6px",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-subtle)"
            }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: "4px" }}>
                Last Analysis
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                {knowledge?.updatedAt ? formatDateTime(knowledge.updatedAt) : "Not yet analyzed"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: Project Instructions ──────────────────────────────── */}
      <section style={{
        marginBottom: "18px",
        border: "1px solid var(--color-border)", borderRadius: "8px",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--color-border)",
          background: "var(--violet-soft)"
        }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--violet-deep)" }}>
            Project Instructions
          </h3>
        </div>
        <div style={{ padding: "16px" }}>
          <label style={{
            display: "block", fontSize: "12px", fontWeight: 600,
            color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: "6px"
          }}>
            Describe how your APIs relate to each other
          </label>
          <textarea
            placeholder="For example: The token from generate-token is used as Bearer Authorization for login..."
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              setInstructionsDirty(true);
              setInstructionsSaved(false);
            }}
            rows={4}
            style={{
              width: "100%", padding: "10px 12px", fontSize: "14px",
              border: "1px solid var(--color-border)", borderRadius: "6px",
              background: "var(--color-bg-surface)", color: "var(--color-text-primary)",
              resize: "vertical", fontFamily: "inherit",
              boxSizing: "border-box"
            }}
          />
          <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleSaveInstructions}
              disabled={!instructionsDirty || instructionsLoading}
              style={{
                padding: "8px 16px", fontSize: "14px", fontWeight: 600,
                color: "#fff",
                background: (!instructionsDirty || instructionsLoading) ? "var(--color-border)" : "var(--violet)",
                border: "none", borderRadius: "6px",
                cursor: (!instructionsDirty || instructionsLoading) ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", gap: "6px"
              }}
            >
              {instructionsLoading ? "Saving..." : "Save & Analyze"}
            </button>

            {instructionsSaved && (
              <span style={{
                fontSize: "12px", fontWeight: 600, color: "var(--green-deep)",
                display: "inline-flex", alignItems: "center", gap: "4px"
              }}>
                <IconCheck /> Saved
              </span>
            )}

            {instructionsDirty && !instructionsLoading && (
              <span style={{ fontSize: "12px", color: "var(--yellow-deep)", fontWeight: 600 }}>
                Unsaved changes
              </span>
            )}

            {knowledge?.updatedAt && (
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                Last analyzed: {formatDateTime(knowledge.updatedAt)}
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

      {/* ─── SECTION 3: AI Analysis Summary ───────────────────────────────── */}
      {hasKnowledge && relationships.length > 0 && (
        <section style={{
          marginBottom: "18px",
          border: "1px solid var(--color-border)", borderRadius: "8px",
          background: "var(--color-bg-surface)", overflow: "hidden"
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--color-border)",
            background: "var(--blue-soft)"
          }}>
            <h3 style={{ margin: 0, fontSize: "15px", color: "var(--blue-deep)" }}>
              AI Analysis Summary
            </h3>
          </div>
          <div style={{ padding: "16px" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "12px"
            }}>
              {/* Auth Relationships */}
              <div style={{
                padding: "12px", borderRadius: "6px",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-subtle)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <IconShield />
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                    Auth Relationships
                  </span>
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--blue-deep)" }}>
                  {authRelationships.length}
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                  {authRelationships.filter((r) => r.status === "confirmed").length} confirmed
                </div>
              </div>

              {/* Data Dependencies */}
              <div style={{
                padding: "12px", borderRadius: "6px",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-subtle)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <IconDatabase />
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                    Data Dependencies
                  </span>
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--blue-deep)" }}>
                  {dataDependencyRelationships.length}
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                  {dataDependencyRelationships.filter((r) => r.status === "confirmed").length} confirmed
                </div>
              </div>

              {/* Variable Mappings */}
              <div style={{
                padding: "12px", borderRadius: "6px",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-subtle)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <IconArrowRight />
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                    Variable Mappings
                  </span>
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--blue-deep)" }}>
                  {relationships.filter((r) => r.transform && r.transform.length > 0).length}
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                  with transform rules
                </div>
              </div>

              {/* Average Confidence */}
              <div style={{
                padding: "12px", borderRadius: "6px",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-subtle)"
              }}>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: "4px" }}>
                  Avg Confidence
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--blue-deep)" }}>
                  {relationships.length > 0
                    ? formatConfidence(relationships.reduce((s, r) => s + (r.confidence || 0), 0) / relationships.length)
                    : "N/A"}
                </div>
              </div>

              {/* Proposed Count */}
              <div style={{
                padding: "12px", borderRadius: "6px",
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-subtle)"
              }}>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", marginBottom: "4px" }}>
                  Pending Review
                </div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: proposedRelationships.length > 0 ? "var(--yellow-deep)" : "var(--green-deep)" }}>
                  {proposedRelationships.length}
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                  {proposedRelationships.length === 0 ? "All reviewed" : "awaiting decision"}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── SECTION 4: Relationship Review ───────────────────────────────── */}
      {hasKnowledge && relationships.length > 0 && (
        <section style={{
          marginBottom: "18px",
          border: "1px solid var(--color-border)", borderRadius: "8px",
          background: "var(--color-bg-surface)", overflow: "hidden"
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--color-border)",
            background: "var(--green-soft)"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: "15px", color: "var(--green-deep)" }}>
                Relationship Review ({relationships.length})
              </h3>
              <div style={{ display: "flex", gap: "8px", fontSize: "12px" }}>
                <span style={{ color: "var(--green-deep)", fontWeight: 600 }}>
                  {confirmedRelationships.length} confirmed
                </span>
                <span style={{ color: "var(--yellow-deep)", fontWeight: 600 }}>
                  {proposedRelationships.length} proposed
                </span>
                {rejectedRelationships.length > 0 && (
                  <span style={{ color: "var(--red-deep)", fontWeight: 600 }}>
                    {rejectedRelationships.length} rejected
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ padding: "16px" }}>
            {/* Table Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 2fr 80px 70px 80px 1.5fr 100px",
              gap: "8px",
              padding: "8px 12px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--muted)",
              borderBottom: "1px solid var(--color-border)",
              marginBottom: "8px"
            }}>
              <div>Source Operation</div>
              <div>Target Operation</div>
              <div>Type</div>
              <div>Confidence</div>
              <div>Status</div>
              <div>Evidence</div>
              <div style={{ textAlign: "center" }}>Actions</div>
            </div>

            {/* Relationship Rows */}
            {relationships.map((rel, idx) => {
              const st = getStatusStyle(rel.status);
              const srcLabel = `${rel.source.serviceId}::${rel.source.operationId}`;
              const tgtLabel = `${rel.target.serviceId}::${rel.target.operationId}`;

              return (
                <div
                  key={rel.id || idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 2fr 80px 70px 80px 1.5fr 100px",
                    gap: "8px",
                    padding: "10px 12px",
                    fontSize: "12px",
                    borderBottom: idx < relationships.length - 1 ? "1px solid var(--color-border)" : "none",
                    background: rel.status === "proposed" ? "var(--yellow-soft, #fffde7)" : "transparent",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "12px" }}>{srcLabel}</div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "monospace" }}>{rel.source.location.split(".").slice(-1)[0] || rel.source.location}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "12px" }}>{tgtLabel}</div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "monospace" }}>{rel.target.location.split(".").slice(-1)[0] || rel.target.location}</div>
                  </div>
                  <div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      padding: "2px 6px", borderRadius: "4px",
                      fontSize: "11px", fontWeight: 600,
                      background: rel.type === "authentication" ? "var(--blue-soft)" : "var(--surface-alt)",
                      color: rel.type === "authentication" ? "var(--blue-deep)" : "var(--ink)"
                    }}>
                      {getTypeIcon(rel.type)}
                      {getTypeLabel(rel.type)}
                    </span>
                  </div>
                  <div>
                    <span style={{
                      padding: "2px 6px", borderRadius: "4px",
                      fontSize: "11px", fontWeight: 700,
                      background: getConfidenceBg(rel.confidence || 0),
                      color: getConfidenceColor(rel.confidence || 0)
                    }}>
                      {formatConfidence(rel.confidence || 0)}
                    </span>
                  </div>
                  <div>
                    <span style={{
                      display: "inline-block", padding: "2px 6px", borderRadius: "4px",
                      fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                      background: st.bg, color: st.text
                    }}>
                      {rel.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>
                    {rel.evidence || "—"}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    {rel.status === "proposed" ? (
                      <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleConfirmRelationship(rel)}
                          title="Confirm relationship"
                          style={{
                            width: "28px", height: "28px",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            border: "1px solid var(--green)", borderRadius: "4px",
                            background: "var(--green-soft)", color: "var(--green-deep)",
                            cursor: "pointer", fontSize: "14px"
                          }}
                        >
                          <IconCheck />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectRelationship(rel)}
                          title="Reject relationship"
                          style={{
                            width: "28px", height: "28px",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            border: "1px solid var(--red)", borderRadius: "4px",
                            background: "var(--red-soft)", color: "var(--red-deep)",
                            cursor: "pointer", fontSize: "14px"
                          }}
                        >
                          <IconX />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                        {rel.status === "confirmed" ? "✓" : "✕"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── SECTION 5: Knowledge Health ──────────────────────────────────── */}
      <section style={{
        marginBottom: "18px",
        border: "1px solid var(--color-border)", borderRadius: "8px",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--color-border)",
          background: "var(--surface-alt)"
        }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--ink)" }}>
            Knowledge Health
          </h3>
        </div>
        <div style={{ padding: "16px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "10px"
          }}>
            {/* Auth configured */}
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 12px", borderRadius: "6px",
              border: `1px solid ${authRelationships.filter((r) => r.status === "confirmed").length > 0 ? "var(--green)" : "var(--color-border)"}`,
              background: authRelationships.filter((r) => r.status === "confirmed").length > 0 ? "var(--green-soft)" : "var(--color-bg-subtle)"
            }}>
              <span style={{
                width: "24px", height: "24px", display: "inline-flex",
                alignItems: "center", justifyContent: "center",
                borderRadius: "50%",
                background: authRelationships.filter((r) => r.status === "confirmed").length > 0 ? "var(--green)" : "var(--line)",
                color: "#fff", fontSize: "12px", fontWeight: 700
              }}>
                {authRelationships.filter((r) => r.status === "confirmed").length > 0 ? "✓" : "—"}
              </span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                  Authentication configured
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {authRelationships.filter((r) => r.status === "confirmed").length} auth flow{authRelationships.filter((r) => r.status === "confirmed").length !== 1 ? "s" : ""} confirmed
                </div>
              </div>
            </div>

            {/* Dependencies analyzed */}
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 12px", borderRadius: "6px",
              border: `1px solid ${dataDependencyRelationships.length > 0 ? "var(--green)" : "var(--color-border)"}`,
              background: dataDependencyRelationships.length > 0 ? "var(--green-soft)" : "var(--color-bg-subtle)"
            }}>
              <span style={{
                width: "24px", height: "24px", display: "inline-flex",
                alignItems: "center", justifyContent: "center",
                borderRadius: "50%",
                background: dataDependencyRelationships.length > 0 ? "var(--green)" : "var(--line)",
                color: "#fff", fontSize: "12px", fontWeight: 700
              }}>
                {dataDependencyRelationships.length > 0 ? "✓" : "—"}
              </span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                  Dependencies analyzed
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {dataDependencyRelationships.length} data flow{dataDependencyRelationships.length !== 1 ? "s" : ""} detected
                </div>
              </div>
            </div>

            {/* Relationship coverage */}
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 12px", borderRadius: "6px",
              border: `1px solid ${confirmedRelationships.length > 0 ? "var(--green)" : "var(--color-border)"}`,
              background: confirmedRelationships.length > 0 ? "var(--green-soft)" : "var(--color-bg-subtle)"
            }}>
              <span style={{
                width: "24px", height: "24px", display: "inline-flex",
                alignItems: "center", justifyContent: "center",
                borderRadius: "50%",
                background: confirmedRelationships.length > 0 ? "var(--green)" : "var(--line)",
                color: "#fff", fontSize: "12px", fontWeight: 700
              }}>
                {confirmedRelationships.length > 0 ? "✓" : "—"}
              </span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                  Relationship coverage
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {confirmedRelationships.length} of {relationships.length} confirmed
                </div>
              </div>
            </div>

            {/* Missing relationships */}
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 12px", borderRadius: "6px",
              border: `1px solid ${proposedRelationships.length === 0 ? "var(--green)" : "var(--yellow)"}`,
              background: proposedRelationships.length === 0 ? "var(--green-soft)" : "var(--yellow-soft)"
            }}>
              <span style={{
                width: "24px", height: "24px", display: "inline-flex",
                alignItems: "center", justifyContent: "center",
                borderRadius: "50%",
                background: proposedRelationships.length === 0 ? "var(--green)" : "var(--yellow)",
                color: "#fff", fontSize: "12px", fontWeight: 700
              }}>
                {proposedRelationships.length === 0 ? "✓" : "!"}
              </span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                  {proposedRelationships.length === 0 ? "All relationships reviewed" : "Pending relationships"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {proposedRelationships.length === 0 ? "No pending reviews" : `${proposedRelationships.length} need${proposedRelationships.length === 1 ? "s" : ""} review`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 6: Navigation — Next Step ────────────────────────────── */}
      {allConfirmed && (
        <section style={{
          padding: "16px 20px",
          border: "2px solid var(--green)",
          borderRadius: "8px",
          background: "var(--green-soft)",
          marginBottom: "18px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--green-deep)", marginBottom: "4px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <IconCheck /> All relationships confirmed
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--green-deep)" }}>
                Your knowledge graph is complete. All {relationships.length} relationship{relationships.length !== 1 ? "s" : ""} have been reviewed and confirmed.
              </div>
            </div>
            <button
              type="button"
              onClick={() => { window.location.hash = "#workspace"; }}
              style={{
                padding: "10px 20px", fontSize: "14px", fontWeight: 700,
                color: "#fff", background: "var(--green)",
                border: "none", borderRadius: "6px", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: "8px"
              }}
            >
              Continue to Requirements <IconArrowRight />
            </button>
          </div>
        </section>
      )}

      {/* ─── Empty State ──────────────────────────────────────────────────── */}
      {hasKnowledge && relationships.length === 0 && (
        <section style={{
          padding: "24px",
          border: "1px solid var(--color-border)", borderRadius: "8px",
          background: "var(--color-bg-surface)", textAlign: "center"
        }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🧠</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "var(--ink)" }}>
            No relationships discovered yet
          </h3>
          <p style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "500px", margin: "0 auto", lineHeight: 1.5 }}>
            Write instructions about how your APIs relate to each other and click "Save & Analyze" to discover authentication flows and data dependencies automatically.
          </p>
        </section>
      )}

      {/* ─── No Knowledge State ───────────────────────────────────────────── */}
      {!hasKnowledge && (
        <section style={{
          padding: "24px",
          border: "1px solid var(--color-border)", borderRadius: "8px",
          background: "var(--color-bg-surface)", textAlign: "center"
        }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "var(--ink)" }}>
            Knowledge Engine ready
          </h3>
          <p style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "500px", margin: "0 auto", lineHeight: 1.5 }}>
            Write instructions about your API relationships above and click "Save & Analyze" to begin. The AI will analyze your registered services and propose relationships automatically.
          </p>
        </section>
      )}
    </div>
  );
}