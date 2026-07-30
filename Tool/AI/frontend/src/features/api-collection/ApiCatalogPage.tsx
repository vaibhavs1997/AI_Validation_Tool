/**
 * ApiCatalogPage — API Import Hub
 *
 * A production-ready page focused on helping users register APIs into the project.
 *
 * Sections:
 * 1. Page Header — title, subtitle
 * 2. Drag & Drop Import Area — reuses ContractUploader (Idle/Drag Over/Uploading/Success/Failure)
 * 3. Recent Imports — table of previously imported collections (empty state supported)
 * 4. Bottom Workflow Card — Recommended Next Step / Continue to API Explorer
 *
 * Reuses existing services and parsers — no new backend endpoints, no duplicate logic:
 *   - parseApiContract (ApiCollectionService)
 *   - registerService / listServices / getService (ServiceRegistrationService)
 *   - ContractUploader (drag & drop + file upload)
 *   - ContractPaster (paste specification)
 */

import { useState, useEffect, useCallback } from "react";
import { ContractUploader } from "./ContractUploader";
import { ContractPaster } from "./ContractPaster";
import { ApiExplorer } from "./ApiExplorer";
import { parseApiContract } from "./ApiCollectionService";
import { listServices, registerService, getService } from "../project-setup/ServiceRegistrationService";
import type { ApiContract, ApiEndpoint } from "./ApiCollectionTypes";
import type { ServiceDefinition, ApiModel } from "../../types";
import type { ApiError } from "../../services";


const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconEmpty = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiCatalogPageProps {
  activeProjectId: string | null;
}

interface ImportHistoryEntry {
  id: string;
  fileName: string;
  type: string;
  importedAt: string;
  servicesImported: number;
  apisImported: number;
  status: "success" | "failed";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = "testforge:catalogContract:";
const HISTORY_KEY_PREFIX = "testforge:importHistory:";


// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCachedContract(projectId: string): ApiContract | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_PREFIX + projectId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheContract(projectId: string, contract: ApiContract | null) {
  try {
    if (contract) {
      sessionStorage.setItem(STORAGE_KEY_PREFIX + projectId, JSON.stringify(contract));
    } else {
      sessionStorage.removeItem(STORAGE_KEY_PREFIX + projectId);
    }
  } catch {
    // sessionStorage not available
  }
}

function getImportHistory(projectId: string): ImportHistoryEntry[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY_PREFIX + projectId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveImportHistory(projectId: string, history: ImportHistoryEntry[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY_PREFIX + projectId, JSON.stringify(history));
  } catch {
    // sessionStorage not available
  }
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function detectDisplayType(type: string): string {
  switch (type) {
    case "openapi": return "OpenAPI";
    case "swagger": return "Swagger";
    case "postman": return "Postman";
    case "har": return "HAR";
    default: return "API Collection";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ApiCatalogPage({ activeProjectId }: ApiCatalogPageProps) {
  // ─── State ───────────────────────────────────────────────────────────────
  const [activeContract, setActiveContract] = useState<ApiContract | null>(
    activeProjectId ? getCachedContract(activeProjectId) : null
  );
  const [services, setServices] = useState<ServiceDefinition[]>([]);
  const [apiModels, setApiModels] = useState<Record<string, ApiModel | null>>({});
  const [loadingEndpoints, setLoadingEndpoints] = useState(false);
  const [importMethod, setImportMethod] = useState<"openapi" | "paste">("openapi");

  // Paste-specific state
  const [pastedJsonDraft, setPastedJsonDraft] = useState<string>("");
  const [pasteLoading, setPasteLoading] = useState(false);
  const [pasteError, setPasteError] = useState<string>("");

  // Import history
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);

  // ─── Load persisted services / API models from backend on mount ──────────
  const loadServices = useCallback(async (projectId: string) => {
    setLoadingEndpoints(true);
    try {
      const svcs = await listServices(projectId);
      setServices(svcs);

      const models: Record<string, ApiModel | null> = {};
      const allEndpoints: ApiEndpoint[] = [];
      for (const svc of svcs) {
        try {
          const { apiModel } = await getService(projectId, svc.id);
          models[svc.id] = apiModel;
          if (apiModel && Array.isArray(apiModel.operations)) {
            apiModel.operations.forEach((op: any) => {
              allEndpoints.push({
                id: op.id || `${op.method}-${op.path}`,
                method: (op.method || "GET").toUpperCase() as any,
                path: op.path || "/",
                operationId: op.operationId || op.id || "",
                summary: op.summary || "",
                description: op.description || "",
                tags: op.tags || [],
                parameters: op.parameters || [],
                requestSchema: op.requestSchema || null,
                responses: op.responses || {},
                responseSchemas: op.responseSchemas || {},
              });
            });
          }
        } catch (err) {
          console.warn(`[ApiCatalog] Failed to load service ${svc.id}:`, err);
        }
      }

      setApiModels(models);

      // Restore contract from persisted data when no cached contract exists
      const cached = getCachedContract(projectId);
      if (allEndpoints.length > 0 && !cached) {
        const restored: ApiContract = {
          type: "openapi",
          title: svcs[0]?.name || "Imported API",
          version: "1.0.0",
          baseUrl: "",
          endpoints: allEndpoints,
          importedAt: new Date().toISOString(),
        };
        setActiveContract(restored);
        cacheContract(projectId, restored);
      } else if (cached) {
        setActiveContract(cached);
      }

      // Derive last import time from history or contract
      const history = getImportHistory(projectId);
      setImportHistory(history);
    } catch (err) {
      console.error("[ApiCatalog] Failed to list services:", err);
    } finally {
      setLoadingEndpoints(false);
    }
  }, []);

  useEffect(() => {
    if (!activeProjectId) {
      setServices([]);
      setImportHistory([]);
      return;
    }
    loadServices(activeProjectId);
  }, [activeProjectId, loadServices]);

  // ─── Contract confirmed handler ─────────────────────────────────────────
  const handleContractConfirmed = useCallback(
    (contract: ApiContract | null) => {
      setActiveContract(contract);
      if (activeProjectId) {
        cacheContract(activeProjectId, contract);
      }
      // Persist to backend via existing registerService
      if (contract && activeProjectId) {
        registerService(activeProjectId, contract)
          .then(() => {
            // Refresh backend data
            loadServices(activeProjectId);

            // Record in import history (UI-only)
            const entry: ImportHistoryEntry = {
              id: `${Date.now()}`,
              fileName: contract.title || "Imported API",
              type: detectDisplayType(contract.type),
              importedAt: contract.importedAt || new Date().toISOString(),
              servicesImported: 1,
              apisImported: contract.endpoints?.length || 0,
              status: "success",
            };
            const history = [entry, ...getImportHistory(activeProjectId)].slice(0, 5);
            saveImportHistory(activeProjectId, history);
            setImportHistory(history);
          })
          .catch((err: unknown) =>
            console.error("[ApiCatalog] Failed to persist API contract:", err)
          );
      }
    },
    [activeProjectId, loadServices]
  );

  // ─── Paste handler ──────────────────────────────────────────────────────
  const handleDraftChange = (value: string) => {
    setPastedJsonDraft(value);
    if (pasteError) setPasteError("");
  };

  const handleParse = async () => {
    setPasteError("");
    const trimmedDraft = pastedJsonDraft.trim();

    if (!trimmedDraft) {
      setPasteError("Enter or paste an API collection before parsing.");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmedDraft);
    } catch {
      setPasteError("Invalid JSON. Check the collection syntax and try again.");
      return;
    }

    setPasteLoading(true);
    try {
      const contract = await parseApiContract(parsed, "pasted-contract");
      handleContractConfirmed(contract);
    } catch (err) {
      const apiErr = err as ApiError;
      setPasteError(apiErr.message || "Unable to parse API collection.");
    } finally {
      setPasteLoading(false);
    }
  };

  const handleSample = () => {
    // Intentionally empty - to be implemented in later step
  };

  // ─── Derived data ────────────────────────────────────────────────────────
  const hasServices = services.length > 0;

  // ─── No project state ────────────────────────────────────────────────────
  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "var(--color-text-primary)" }}>API Catalog</h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>
          Select a project in Setup to view its API catalog.
        </p>
      </div>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: Page Header
          ═══════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: "24px" }}>
        <h1 style={{
          margin: "0 0 6px 0",
          fontSize: "24px",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          letterSpacing: "-0.01em",
        }}>
          API Catalog
        </h1>
        <p style={{
          margin: "0 0 18px 0",
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          lineHeight: 1.5,
        }}>
          Import your API definitions so TestForge can understand your application.
        </p>

      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: Drag & Drop Upload Area
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        id="import-upload-zone"
        style={{
          marginBottom: "24px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-bg-surface)",
          overflow: "hidden",
        }}
      >
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          gap: "12px",
          alignItems: "center",
        }}>
          <button
            type="button"
            onClick={() => setImportMethod("openapi")}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: 600,
              color: importMethod === "openapi" ? "#fff" : "var(--color-text-secondary)",
              background: importMethod === "openapi" ? "var(--color-primary)" : "var(--color-bg-muted)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            OpenAPI / Postman / HAR
          </button>
          <button
            type="button"
            onClick={() => setImportMethod("paste")}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              fontWeight: 600,
              color: importMethod === "paste" ? "#fff" : "var(--color-text-secondary)",
              background: importMethod === "paste" ? "var(--color-primary)" : "var(--color-bg-muted)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            Paste Specification
          </button>
        </div>
        <div style={{ padding: "18px" }}>
          {importMethod === "paste" ? (
            <ContractPaster
              jsonText={pastedJsonDraft}
              onDraftChange={handleDraftChange}
              onParse={handleParse}
              onSample={handleSample}
              loading={pasteLoading}
              error={pasteError}
              parsedContract={activeContract}
            />
          ) : (
            <ContractUploader
              onContractParsed={handleContractConfirmed}
              activeContract={activeContract}
            />
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: Recent Imports
          ═══════════════════════════════════════════════════════════════════ */}
      <section style={{
        marginBottom: "24px",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-border)",
        }}>
          <h2 style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}>
            Recent Imports
          </h2>
          <p style={{
            margin: "4px 0 0 0",
            fontSize: "12px",
            color: "var(--color-text-secondary)",
          }}>
            Previously imported collections for this project.
          </p>
        </div>
        <div style={{ padding: "16px" }}>
          {importHistory.length === 0 ? (
            // Empty state
            <div style={{
              padding: "32px 24px",
              border: "1px dashed var(--color-border-strong)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg-subtle)",
              textAlign: "center",
            }}>
              <div style={{
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--radius-md)",
                background: "var(--color-primary-soft)",
                color: "var(--color-primary)",
                margin: "0 auto 14px",
              }}>
                <IconEmpty />
              </div>
              <p style={{
                margin: "0 0 4px 0",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}>
                No imports yet
              </p>
              <p style={{
                margin: 0,
                fontSize: "13px",
                color: "var(--color-text-muted)",
              }}>
                Import an API definition above to see it listed here.
              </p>
            </div>
          ) : (
            // Imports table
            <div style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
            }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "13px",
                }}>
                  <thead>
                    <tr style={{ background: "var(--color-bg-muted)" }}>
                      {["File Name", "Type", "Imported Time", "Services", "APIs", "Status"].map((header) => (
                        <th
                          key={header}
                          scope="col"
                          style={{
                            textAlign: "left",
                            padding: "10px 14px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: "var(--color-text-muted)",
                            borderBottom: "1px solid var(--color-border)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importHistory.slice(0, 5).map((entry) => (
                      <tr
                        key={entry.id}
                        style={{ borderBottom: "1px solid var(--color-border)" }}
                      >
                        <td style={{
                          padding: "10px 14px",
                          color: "var(--color-text-primary)",
                          fontWeight: 600,
                          maxWidth: "240px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {entry.fileName}
                        </td>
                        <td style={{
                          padding: "10px 14px",
                          color: "var(--color-text-secondary)",
                          whiteSpace: "nowrap",
                        }}>
                          {entry.type}
                        </td>
                        <td style={{
                          padding: "10px 14px",
                          color: "var(--color-text-secondary)",
                          whiteSpace: "nowrap",
                        }}>
                          {formatDateTime(entry.importedAt)}
                        </td>
                        <td style={{
                          padding: "10px 14px",
                          color: "var(--color-text-secondary)",
                          whiteSpace: "nowrap",
                        }}>
                          {entry.servicesImported}
                        </td>
                        <td style={{
                          padding: "10px 14px",
                          color: "var(--color-text-secondary)",
                          whiteSpace: "nowrap",
                        }}>
                          {entry.apisImported}
                        </td>
                        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            padding: "3px 8px",
                            borderRadius: "var(--radius-pill)",
                            background: entry.status === "success"
                              ? "var(--color-success-soft)"
                              : "var(--color-error-soft)",
                            color: entry.status === "success"
                              ? "var(--color-success)"
                              : "var(--color-error)",
                          }}>
                            {entry.status === "success" ? <IconCheck /> : "⚠"}
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          API EXPLORER (shown when services exist)
          ═══════════════════════════════════════════════════════════════════ */}
      {hasServices && (
        <ApiExplorer
          services={services}
          apiModels={apiModels}
          loading={loadingEndpoints}
        />
      )}

    </div>
  );
}