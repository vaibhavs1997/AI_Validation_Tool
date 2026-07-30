/**
 * ProjectKnowledgePage
 *
 * Redesigned page around Knowledge Sources architecture.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { KnowledgeSourceCard } from "./KnowledgeSourceCard";
import { ConfluenceConfigWizard } from "./ConfluenceConfigWizard";
import {
  listKnowledgeSources as apiListKnowledgeSources,
  createKnowledgeSource as apiCreateKnowledgeSource,
  updateKnowledgeSource as apiUpdateKnowledgeSource,
  syncConfluenceSource,
  uploadDocument,
} from "./KnowledgeSourceService";

// Types
interface KnowledgeSource {
  id: string;
  projectId: string;
  type: "confluence" | "local-documents" | "project-notes";
  name: string;
  description: string;
  status: "available" | "connected" | "not-connected" | "syncing" | "error";
  config: Record<string, unknown>;
  syncConfig: { autoSync: boolean; interval: number };
  lastSync: {
    status: string;
    timestamp: string | null;
    pagesIndexed: number;
    pagesChanged: number;
    errors: string[];
  };
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeRepositoryItem {
  id: string;
  projectId: string;
  sourceId: string;
  sourceType: string;
  title: string;
  content: string;
  contentType: string;
  knowledgeType: string;
  version: number;
  lastUpdated: string;
  status: string;
  metadata: Record<string, unknown>;
  syncVersion: string;
  createdAt: string;
  updatedAt: string;
  sourceName?: string;
  sourceStatus?: string;
}

interface ReadinessMetrics {
  totalSources: number;
  connectedSources: number;
  totalDocuments: number;
  sourceBreakdown: Array<{
    id: string;
    type: string;
    name: string;
    status: string;
    itemCount: number;
  }>;
  knowledgeTypes: Record<string, number>;
  coveragePercentage: number;
}

interface ProjectKnowledgePageProps {
  activeProjectId: string | null;
}

// Icons
const IconSync = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconDatabase = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34-9-3V5" />
  </svg>
);

// Helpers
function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "—";
  }
}

export function ProjectKnowledgePage({ activeProjectId }: ProjectKnowledgePageProps) {
  // State
  const [knowledge, setKnowledge] = useState<any>(null);
  const [instructions, setInstructions] = useState("");
  const [instructionsDirty, setInstructionsDirty] = useState(false);
  const [instructionsLoading, setInstructionsLoading] = useState(false);
  const [instructionsError, setInstructionsError] = useState("");
  const [instructionsSaved, setInstructionsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [showConfluenceWizard, setShowConfluenceWizard] = useState(false);

  const [repository, setRepository] = useState<{
    sources: KnowledgeSource[];
    items: KnowledgeRepositoryItem[];
    stats: {
      totalSources: number;
      connectedSources: number;
      totalItems: number;
      bySource: any[];
    };
  } | null>(null);

  const [readiness, setReadiness] = useState<ReadinessMetrics | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all data
  const loadAll = useCallback(async (projectId: string) => {
    setLoading(true);
    setError("");

    try {
      // Load knowledge (instructions)
      const { getProjectKnowledge } = await import("./KnowledgeService");
      const kn = await getProjectKnowledge(projectId).catch(() => null);
      setKnowledge(kn);
      setInstructions(kn?.instructions || "");

      // Try loading real data from API first
      let realSources: KnowledgeSource[] = [];
      let realRepository: any = null;
      let realReadiness: any = null;

      try {
        realSources = await apiListKnowledgeSources(projectId);
        const repoData = await fetch(`/api/knowledge-repository?projectId=${encodeURIComponent(projectId)}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null);
        if (repoData?.repository) {
          realRepository = repoData.repository;
        }
        const readinessData = await fetch(`/api/knowledge-repository/readiness?projectId=${encodeURIComponent(projectId)}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null);
        if (readinessData?.readiness) {
          realReadiness = readinessData.readiness;
        }
      } catch (e) {
        console.warn("API not available");
      }

      // Use real data from API, or show default empty source cards
      if (realSources.length > 0) {
        setSources(realSources);
      } else {
        // Show default source types even when not configured
        const defaultSources: KnowledgeSource[] = [
          {
            id: `confluence-${projectId}`,
            projectId,
            type: "confluence",
            name: "Confluence",
            description: "Enterprise documentation - Engineering Wiki",
            status: "not-connected",
            config: {},
            syncConfig: { autoSync: false, interval: 3600 },
            lastSync: {
              status: "never",
              timestamp: null,
              pagesIndexed: 0,
              pagesChanged: 0,
              errors: [],
            },
            metadata: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: `local-documents-${projectId}`,
            projectId,
            type: "local-documents",
            name: "Local Documents",
            description: "Upload PDF, DOCX, Markdown, architecture diagrams, or system design documents.",
            status: "available",
            config: {},
            syncConfig: { autoSync: false, interval: 3600 },
            lastSync: {
              status: "never",
              timestamp: null,
              pagesIndexed: 0,
              pagesChanged: 0,
              errors: [],
            },
            metadata: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: `project-notes-${projectId}`,
            projectId,
            type: "project-notes",
            name: "Project Notes",
            description: "Paste notes about your APIs, workflows, and business context.",
            status: "available",
            config: {},
            syncConfig: { autoSync: false, interval: 3600 },
            lastSync: {
              status: "never",
              timestamp: null,
              pagesIndexed: 0,
              pagesChanged: 0,
              errors: [],
            },
            metadata: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
        setSources(defaultSources);
      }
      if (realRepository) {
        setRepository(realRepository);
      }
      if (realReadiness) {
        setReadiness(realReadiness);
      }
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
      setSources([]);
      setRepository(null);
      setReadiness(null);
    }
  }, [activeProjectId, loadAll]);

  // Handlers
  const handleSaveInstructions = async () => {
    if (!activeProjectId) return;
    setInstructionsLoading(true);
    setInstructionsError("");
    setInstructionsSaved(false);
    try {
      const { updateInstructions } = await import("./KnowledgeService");
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeProjectId) return;
    
    for (const file of Array.from(files)) {
      try {
        setLoading(true);
        await uploadDocument(activeProjectId, file);
        // Refresh repository to show newly indexed document
        await loadAll(activeProjectId);
      } catch (err) {
        console.error("Failed to upload document:", err);
        alert(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfluenceConfigure = () => {
    setShowConfluenceWizard(true);
  };

  const handleConfluenceComplete = async (config: any) => {
    if (!activeProjectId) return;

    try {
      const sourceData: Partial<KnowledgeSource> = {
        type: "confluence",
        name: "Confluence",
        description: "Enterprise documentation",
        status: "connected",
        config,
        syncConfig: {
          autoSync: config.autoSync || false,
          interval: config.syncInterval || 3600,
        },
      };

      const existingSource = sources.find((s) => s.type === "confluence");
      if (existingSource) {
        await apiUpdateKnowledgeSource(activeProjectId, existingSource.id, sourceData);
      } else {
        await apiCreateKnowledgeSource(activeProjectId, sourceData);
      }

      const updatedSources = await apiListKnowledgeSources(activeProjectId);
      setSources(updatedSources);
      setShowConfluenceWizard(false);
    } catch (err) {
      console.error("Failed to save Confluence configuration:", err);
      alert("Failed to save Confluence configuration");
    }
  };

  const handleLocalDocumentsUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleProjectNotesEdit = () => {
    const instructionsEl = document.getElementById("additional-instructions-editor");
    if (instructionsEl) {
      instructionsEl.scrollIntoView({ behavior: "smooth" });
      instructionsEl.focus();
    }
  };

  const handleSyncSource = async (sourceId: string) => {
    if (!activeProjectId) return;

    try {
      const source = sources.find(s => s.id === sourceId);
      if (source && source.type === "confluence") {
        await syncConfluenceSource(activeProjectId, sourceId);
      }
      await loadAll(activeProjectId);
    } catch (err) {
      console.error("Failed to sync source:", err);
    }
  };

  // Render states
  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
          Select a project to view its knowledge hub.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
          Loading project knowledge...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <div
          style={{
            padding: "10px 12px",
            background: "var(--color-info-bg)",
            border: "1px solid var(--color-info-border)",
            borderRadius: "6px",
            fontSize: "13px",
            color: "var(--color-info-text)",
            marginBottom: "12px",
          }}
        >
          {error}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          style={{
            padding: "6px 12px",
            fontSize: "13px",
            fontWeight: 600,
            border: "1px solid var(--color-border)",
            borderRadius: "4px",
            background: "var(--color-bg-surface)",
            cursor: "pointer",
            color: "var(--color-text-primary)",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <IconSync /> Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
      {/* Knowledge Sources Section */}
      <section
        style={{
          marginBottom: "24px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-bg-surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text-primary)" }}>
              Knowledge Sources
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
              Connect documentation sources to feed the Knowledge Repository
            </p>
          </div>
        </div>
        <div style={{ padding: "16px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
            }}
          >
            {sources.map((source) => (
              <KnowledgeSourceCard
                key={source.id}
                source={source}
                onConfigure={source.type === "confluence" ? handleConfluenceConfigure : undefined}
                onUpload={source.type === "local-documents" ? handleLocalDocumentsUpload : undefined}
                onEdit={source.type === "project-notes" ? handleProjectNotesEdit : undefined}
                onSync={
                  source.status === "connected" || source.status === "available"
                    ? () => handleSyncSource(source.id)
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </section>

      {/* Knowledge Repository Section */}
      <section
        style={{
          marginBottom: "24px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-bg-surface)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text-primary)" }}>
            Knowledge Repository
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
            Aggregated view from all enabled sources
          </p>
        </div>
        <div style={{ padding: "16px" }}>
          {!repository || repository.items.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--color-text-muted)" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "10px",
                  background: "var(--color-primary-soft)",
                  color: "var(--color-primary)",
                  margin: "0 auto 12px",
                }}
              >
                <IconDatabase />
              </div>
              <p style={{ fontSize: "13px", margin: 0 }}>No knowledge items in the repository yet.</p>
              <p style={{ fontSize: "12px", margin: "4px 0 0 0" }}>
                Connect a source to start building your knowledge base.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {repository.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-bg-surface)",
                  }}
                >
                  <span
                    style={{
                      width: "40px",
                      height: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "8px",
                      background: "var(--color-primary-soft)",
                      color: "var(--color-primary)",
                      fontSize: "10px",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {item.sourceType === "confluence" ? "CONF" : item.sourceType === "local-documents" ? "LOC" : "NOTE"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--color-text-muted)",
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          padding: "1px 6px",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--color-info-soft)",
                          color: "var(--color-info)",
                          border: "1px solid var(--color-info-border)",
                          fontSize: "10px",
                          fontWeight: 600,
                        }}
                      >
                        {item.sourceName || item.sourceType}
                      </span>
                      <span>•</span>
                      <span>Version {item.version}</span>
                      <span>•</span>
                      <span>Updated {formatDateTime(item.lastUpdated)}</span>
                      <span>•</span>
                      <span>{item.knowledgeType}</span>
                    </div>
                  </div>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: "var(--color-success-soft)",
                      color: "var(--color-success)",
                      border: "1px solid var(--color-success-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Synchronization Status */}
      {readiness && (
        <section
          style={{
            marginBottom: "24px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-bg-surface)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
            <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text-primary)" }}>
              Synchronization Status
            </h3>
          </div>
          <div style={{ padding: "16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
              }}
            >
              <div style={{ padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px", fontWeight: 600 }}>
                  Connected Sources
                </div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {readiness.connectedSources} / {readiness.totalSources}
                </div>
              </div>
              <div style={{ padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px", fontWeight: 600 }}>
                  Total Documents
                </div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {readiness.totalDocuments}
                </div>
              </div>
              <div style={{ padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
                <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "4px", fontWeight: 600 }}>
                  Knowledge Types
                </div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {Object.keys(readiness.knowledgeTypes).length}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}


      {/* AI Readiness */}
      {readiness && (
        <section
          style={{
            marginBottom: "24px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-bg-surface)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
            <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text-primary)" }}>
              AI Readiness
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
              How prepared your project is for AI analysis
            </p>
          </div>
          <div style={{ padding: "16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              <div
                style={{
                  padding: "24px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-bg-subtle)",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    border: "4px solid var(--color-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "var(--color-primary)",
                  }}
                >
                  {readiness.coveragePercentage}%
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "4px" }}>
                    Readiness Score
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                    Based on connected sources and indexed documents
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: "16px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-bg-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {readiness.sourceBreakdown.map((source) => (
                  <div
                    key={source.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ color: "var(--color-text-primary)" }}>{source.name}</span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-bg-surface)",
                        border: "1px solid var(--color-border)",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {source.itemCount} items
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Additional Instructions */}
      <section
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-bg-surface)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <h3 style={{ margin: 0, fontSize: "15px", color: "var(--color-text-primary)" }}>
            Additional Instructions
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
            Describe how your APIs relate to each other and any business context.
          </p>
        </div>
        <div style={{ padding: "16px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-text-muted)",
              textTransform: "uppercase",
              marginBottom: "6px",
            }}
          >
            Instructions
          </label>
          <textarea
            id="additional-instructions-editor"
            placeholder="For example: The token from generate-token is used as Bearer Authorization for login..."
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              setInstructionsDirty(true);
              setInstructionsSaved(false);
            }}
            rows={5}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: "14px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-bg-surface)",
              color: "var(--color-text-primary)",
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleSaveInstructions}
              disabled={!instructionsDirty || instructionsLoading}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: 600,
                color: "#fff",
                background: (!instructionsDirty || instructionsLoading)
                  ? "var(--color-border)"
                  : "var(--color-primary)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: (!instructionsDirty || instructionsLoading) ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {instructionsLoading ? "Saving..." : "Save Instructions"}
            </button>
            {instructionsSaved && (
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-success)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
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

      {/* Hidden file input - accept all file types */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        onChange={handleFileUpload}
        style={{ display: "none" }}
      />

      {/* Confluence Wizard */}
      <ConfluenceConfigWizard
        isOpen={showConfluenceWizard}
        onClose={() => setShowConfluenceWizard(false)}
        onComplete={handleConfluenceComplete}
      />
    </div>
  );
}