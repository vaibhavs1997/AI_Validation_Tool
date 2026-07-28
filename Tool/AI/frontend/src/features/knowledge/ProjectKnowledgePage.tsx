/**
 * ProjectKnowledgePage
 *
 * The first page users see after opening a project.
 * Focuses on collecting project knowledge before AI analysis.
 *
 * Sections:
 * 1. Project Overview — name, ID, created, last updated (compact, merged with readiness summary)
 * 2. Knowledge Sources — upload/import cards
 * 3. Uploaded Knowledge — list of uploaded items (empty state supported)
 * 4. Additional Instructions — instructions editor with save (reuses backend)
 * 5. Knowledge Status — readiness cards (Complete / Partial / Not Added)
 *
 * Reuses existing domain models and services:
 *   - ProjectKnowledge (via /api/knowledge)
 *   - Project (via /api/projects/:id)
 *   - ServiceDefinition (via /api/services)
 */

import { useState, useEffect, useCallback } from "react";
import type { Project, ProjectKnowledge, ServiceDefinition } from "../../types";
import { getProject } from "../project-setup/ProjectService";
import { getProjectKnowledge, updateInstructions } from "./KnowledgeService";
import { listServices } from "../project-setup/ServiceRegistrationService";

// ─── SVG Icon Components ─────────────────────────────────────────────────────

const IconFileText = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 5 17 10" />
    <line x1="12" y1="5" x2="12" y2="19" />
  </svg>
);

const IconServer = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <path d="M6 6h.01M6 18h.01" />
  </svg>
);

const IconBook = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </svg>
);

const IconLayers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M12 19l7-7 7 7" />
    <path d="M12 12l7-7 7 7" />
    <path d="M12 12L5 5l7 7" />
    <path d="M12 12l7 7-7-7" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconClipboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M9 11h6M9 15h6" />
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
  </svg>
);

const IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

// ─── Interface ───────────────────────────────────────────────────────────────

interface ProjectKnowledgePageProps {
  activeProjectId: string | null;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Status type for knowledge readiness cards.
 */
type ReadinessStatus = "not-added" | "partial" | "complete";

/**
 * Determines the readiness status for a given knowledge category.
 */
function getReadinessStatus(
  category: string,
  hasCatalog: boolean,
  hasInstructions: boolean
): ReadinessStatus {
  switch (category) {
    case "api-catalog":
      return hasCatalog ? "complete" : "not-added";
    case "project-notes":
      return hasInstructions ? "complete" : "not-added";
    case "architecture":
      return "not-added";
    case "business-rules":
      return "not-added";
    case "authentication":
      return "not-added";
    default:
      return "not-added";
  }
}

function getReadinessLabel(status: ReadinessStatus): string {
  switch (status) {
    case "complete": return "Complete";
    case "partial": return "Partial";
    case "not-added": return "Not Added";
    default: return "Not Added";
  }
}

function getReadinessColor(status: ReadinessStatus): string {
  switch (status) {
    case "complete": return "var(--color-success)";
    case "partial": return "var(--color-text-secondary)";
    case "not-added": return "var(--color-text-muted)";
    default: return "var(--color-text-muted)";
  }
}

function getReadinessBg(status: ReadinessStatus): string {
  switch (status) {
    case "complete": return "var(--color-info-bg)";
    case "partial": return "var(--color-bg-subtle)";
    case "not-added": return "var(--color-bg-subtle)";
    default: return "var(--color-bg-subtle)";
  }
}

function getReadinessBadgeBg(status: ReadinessStatus): string {
  switch (status) {
    case "complete": return "rgba(22, 163, 74, 0.1)";
    case "partial": return "var(--color-bg-muted)";
    case "not-added": return "var(--color-bg-muted)";
    default: return "var(--color-bg-muted)";
  }
}

/**
 * Computes a brief readiness summary (count of complete categories).
 */
function computeReadinessSummary(
  hasCatalog: boolean,
  hasInstructions: boolean
): { complete: number; total: number } {
  const categories = ["api-catalog", "project-notes", "architecture", "business-rules", "authentication"];
  const complete = categories.filter((cat) =>
    getReadinessStatus(cat, hasCatalog, hasInstructions) === "complete"
  ).length;
  return { complete, total: categories.length };
}

// ─── Knowledge Source Card Definitions ──────────────────────────────────────

interface KnowledgeSourceCard {
  id: string;
  icon: () => JSX.Element;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProjectKnowledgePage({ activeProjectId }: ProjectKnowledgePageProps) {
  // ─── State ───────────────────────────────────────────────────────────────
  const [project, setProject] = useState<Project | null>(null);
  const [knowledge, setKnowledge] = useState<ProjectKnowledge | null>(null);
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [instructions, setInstructions] = useState("");
  const [instructionsDirty, setInstructionsDirty] = useState(false);
  const [instructionsLoading, setInstructionsLoading] = useState(false);
  const [instructionsError, setInstructionsError] = useState("");
  const [instructionsSaved, setInstructionsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ─── Derived Data ────────────────────────────────────────────────────────
  const hasCatalog = services.length > 0;
  const hasInstructions = instructions.trim().length > 0;
  const readinessSummary = computeReadinessSummary(hasCatalog, hasInstructions);

  // ─── Load Data ───────────────────────────────────────────────────────────
  const loadAll = useCallback(async (projectId: string) => {
    setLoading(true);
    setError("");

    try {
      const proj = await getProject(projectId).catch(() => null);
      setProject(proj);

      const kn = await getProjectKnowledge(projectId).catch(() => null);
      setKnowledge(kn);
      if (kn) {
        setInstructions(kn.instructions || "");
      } else {
        setInstructions("");
      }

      const svcs = await listServices(projectId).catch(() => []);
      setServices(svcs);
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
      setProject(null);
      setKnowledge(null);
      setServices([]);
      setInstructions("");
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

  const handleRefresh = () => {
    if (activeProjectId) {
      loadAll(activeProjectId);
    }
  };

  // ─── Knowledge Source Cards ──────────────────────────────────────────────
  const sourceCards: KnowledgeSourceCard[] = [
    {
      id: "upload-documents",
      icon: IconFileText,
      title: "Upload Documents",
      description: "Upload PDF, DOCX, or Markdown files with project documentation.",
      actionLabel: "Upload Files",
      onClick: () => { /* UI-only — backend support not yet available */ },
    },
    {
      id: "import-api-catalog",
      icon: IconServer,
      title: "Import API Catalog",
      description: "Import OpenAPI, Postman Collection, or HAR files to register your APIs.",
      actionLabel: "Import Catalog",
      onClick: () => { window.location.hash = "#catalog"; },
    },
    {
      id: "project-notes",
      icon: IconClipboard,
      title: "Project Notes",
      description: "Paste notes about your APIs, workflows, and business context.",
      actionLabel: "Paste Notes",
      onClick: () => {
        const instructionsEl = document.getElementById("additional-instructions-editor");
        if (instructionsEl) {
          instructionsEl.scrollIntoView({ behavior: "smooth" });
          instructionsEl.focus();
        }
      },
    },
    {
      id: "architecture-docs",
      icon: IconLayers,
      title: "Architecture Documents",
      description: "Upload architecture diagrams and system design documents.",
      actionLabel: "Upload Docs",
      onClick: () => { /* UI-only — backend support not yet available */ },
    },
  ];

  // ─── Knowledge Status Categories ─────────────────────────────────────────
  const statusCategories = [
    { id: "architecture", label: "Architecture", icon: IconLayers },
    { id: "business-rules", label: "Business Rules", icon: IconClipboard },
    { id: "authentication", label: "Authentication", icon: IconShield },
    { id: "api-catalog", label: "API Catalog", icon: IconServer },
    { id: "project-notes", label: "Project Notes", icon: IconBook },
  ];

  // ─── No Project State ────────────────────────────────────────────────────
  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
          Select a project to view its knowledge hub.
        </p>
      </div>
    );
  }

  // ─── Loading State ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
          Loading project knowledge...
        </p>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <div style={{
          padding: "10px 12px",
          background: "var(--color-info-bg)",
          border: "1px solid var(--color-info-border)",
          borderRadius: "6px",
          fontSize: "13px",
          color: "var(--color-info-text)",
          marginBottom: "12px"
        }}>
          {error}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          style={{
            padding: "6px 12px", fontSize: "13px", fontWeight: 600,
            border: "1px solid var(--color-border)", borderRadius: "4px",
            background: "var(--color-bg-surface)", cursor: "pointer",
            color: "var(--color-text-primary)",
            display: "inline-flex", alignItems: "center", gap: "6px"
          }}
        >
          <IconRefresh /> Retry
        </button>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
      {/* ═══════════════════════════════════════════════════════════════════
         SECTION 1: Project Overview (compact, merged with readiness summary)
         ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text-primary)" }}>
            Project Overview
          </h3>
          <button
            type="button"
            onClick={handleRefresh}
            style={{
              padding: "6px 12px", fontSize: "13px", fontWeight: 600,
              border: "1px solid var(--color-border)", borderRadius: "4px",
              background: "var(--color-bg-surface)", cursor: "pointer",
              color: "var(--color-text-primary)",
              display: "inline-flex", alignItems: "center", gap: "6px"
            }}
          >
            <IconRefresh /> Refresh
          </button>
        </div>
        <div style={{ padding: "16px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px"
          }}>
            {/* Project Name */}
            <div>
              <div style={{
                fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                color: "var(--color-text-muted)", marginBottom: "4px"
              }}>
                Project Name
              </div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                {project?.name || activeProjectId}
              </div>
            </div>

            {/* Project ID */}
            <div>
              <div style={{
                fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                color: "var(--color-text-muted)", marginBottom: "4px"
              }}>
                Project ID
              </div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                {activeProjectId}
              </div>
            </div>

            {/* Created Date */}
            <div>
              <div style={{
                fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                color: "var(--color-text-muted)", marginBottom: "4px"
              }}>
                Created
              </div>
              <div style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
                {project?.createdAt ? formatDateTime(project.createdAt) : "—"}
              </div>
            </div>

            {/* Last Updated */}
            <div>
              <div style={{
                fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                color: "var(--color-text-muted)", marginBottom: "4px"
              }}>
                Last Updated
              </div>
              <div style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
                {knowledge?.updatedAt
                  ? formatDateTime(knowledge.updatedAt)
                  : project?.updatedAt
                    ? formatDateTime(project.updatedAt)
                    : "—"}
              </div>
            </div>

            {/* Knowledge Readiness Summary (no percentage) */}
            <div style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "12px", borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-subtle)"
            }}>
              <div style={{
                width: "40px", height: "40px",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%",
                background: "var(--color-primary-soft)",
                color: "var(--color-primary)",
                fontSize: "14px", fontWeight: 700
              }}>
                {readinessSummary.complete}
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                  Knowledge Readiness
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  {readinessSummary.complete === 0
                    ? "No project knowledge available."
                    : `${readinessSummary.complete} of ${readinessSummary.total} categories complete.`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         SECTION 2: Knowledge Sources
         ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--color-border)"
        }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text-primary)" }}>
            Knowledge Sources
          </h3>
          <p style={{
            margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)"
          }}>
            Provide context about your application to help TestForge understand your APIs.
          </p>
        </div>
        <div style={{ padding: "16px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px"
          }}>
            {sourceCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  style={{
                    padding: "16px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-bg-surface)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px"
                  }}
                >
                  <div style={{
                    width: "44px", height: "44px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: "10px",
                    background: "var(--color-primary-soft)",
                    color: "var(--color-primary)",
                    flexShrink: 0
                  }}>
                    <Icon />
                  </div>
                  <div>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {card.title}
                    </h4>
                    <p style={{
                      margin: "0 0 12px 0", fontSize: "12px",
                      color: "var(--color-text-secondary)", lineHeight: 1.5
                    }}>
                      {card.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={card.onClick}
                    style={{
                      padding: "8px 16px", fontSize: "13px", fontWeight: 600,
                      color: "#fff", background: "var(--color-primary)",
                      border: "none", borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      gap: "6px"
                    }}
                  >
                    {card.actionLabel}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         SECTION 3: Uploaded Knowledge
         ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--color-border)"
        }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text-primary)" }}>
            Uploaded Knowledge
          </h3>
        </div>
        <div style={{ padding: "16px" }}>
          {/* Empty state — no uploaded knowledge items yet */}
          <div style={{
            padding: "24px",
            border: "1px dashed var(--color-border-strong)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-bg-subtle)",
            textAlign: "center"
          }}>
            <div style={{
              width: "40px", height: "40px",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: "8px",
              background: "var(--color-primary-soft)",
              color: "var(--color-primary)",
              margin: "0 auto 12px"
            }}>
              <IconUpload />
            </div>
            <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0 }}>
              No knowledge has been uploaded.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         SECTION 4: Additional Instructions
         ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--color-border)"
        }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text-primary)" }}>
            Additional Instructions
          </h3>
          <p style={{
            margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)"
          }}>
            Describe how your APIs relate to each other and any business context.
          </p>
        </div>
        <div style={{ padding: "16px" }}>
          <label style={{
            display: "block", fontSize: "12px", fontWeight: 600,
            color: "var(--color-text-muted)", textTransform: "uppercase",
            marginBottom: "6px"
          }}>
            Instructions
          </label>
          <textarea
            id="additional-instructions-editor"
            placeholder="For example: The token from generate-token is used as Bearer Authorization for login. The user profile API requires the session cookie from the login response..."
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              setInstructionsDirty(true);
              setInstructionsSaved(false);
            }}
            rows={5}
            style={{
              width: "100%", padding: "10px 12px", fontSize: "14px",
              border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)",
              background: "var(--color-bg-surface)", color: "var(--color-text-primary)",
              resize: "vertical", fontFamily: "inherit", boxSizing: "border-box"
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
                background: (!instructionsDirty || instructionsLoading)
                  ? "var(--color-border)"
                  : "var(--color-primary)",
                border: "none", borderRadius: "var(--radius-sm)",
                cursor: (!instructionsDirty || instructionsLoading) ? "not-allowed" : "pointer",
                display: "inline-flex", alignItems: "center", gap: "6px"
              }}
            >
              {instructionsLoading ? "Saving..." : "Save Instructions"}
            </button>

            {instructionsSaved && (
              <span style={{
                fontSize: "12px", fontWeight: 600, color: "var(--color-success)",
                display: "inline-flex", alignItems: "center", gap: "4px"
              }}>
                <IconCheck /> Saved
              </span>
            )}

            {instructionsDirty && !instructionsLoading && (
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 600 }}>
                Unsaved changes
              </span>
            )}

            {knowledge?.updatedAt && (
              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                Last updated: {formatDateTime(knowledge.updatedAt)}
              </span>
            )}
          </div>
          {instructionsError && (
            <p style={{ color: "var(--color-info-text)", fontSize: "13px", marginTop: "8px" }}>
              {instructionsError}
            </p>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
         SECTION 5: Knowledge Status
         ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)", overflow: "hidden"
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--color-border)"
        }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text-primary)" }}>
            Knowledge Status
          </h3>
          <p style={{
            margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)"
          }}>
            No AI analysis yet. These reflect what you have provided.
          </p>
        </div>
        <div style={{ padding: "16px" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px"
          }}>
            {statusCategories.map((category) => {
              const status = getReadinessStatus(
                category.id, hasCatalog, hasInstructions
              );
              const label = getReadinessLabel(status);
              return (
                <div
                  key={category.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 12px", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                    background: getReadinessBg(status)
                  }}
                >
                  <span style={{
                    width: "24px", height: "24px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: "50%",
                    background: getReadinessColor(status),
                    color: "#fff", fontSize: "12px", fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {status === "complete" ? "✓" : "—"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {category.label}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                      {label}
                    </div>
                  </div>
                  <span style={{
                    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
                    padding: "2px 6px", borderRadius: "4px",
                    background: getReadinessBadgeBg(status),
                    color: getReadinessColor(status),
                    flexShrink: 0
                  }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
