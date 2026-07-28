import { useState, useEffect } from "react";
import { ApiCollectionPanel } from "./ApiCollectionPanel";
import { listServices, registerService } from "../project-setup/ServiceRegistrationService";
import { getService } from "../project-setup/ServiceRegistrationService";
import type { ApiContract, ApiEndpoint } from "./ApiCollectionTypes";

interface ApiCatalogPageProps {
  activeProjectId: string | null;
}

/**
 * Preserve the active contract across component re-mounts by caching it
 * in sessionStorage. This prevents blank API Catalog when navigating away
 * and back to the page.
 */
const STORAGE_KEY_PREFIX = "testforge:catalogContract:";

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

export function ApiCatalogPage({ activeProjectId }: ApiCatalogPageProps) {
  // Restore contract from cache when component mounts (navigating back)
  const [activeContract, setActiveContract] = useState<ApiContract | null>(
    activeProjectId ? getCachedContract(activeProjectId) : null
  );
  const [persistedEndpoints, setPersistedEndpoints] = useState<ApiEndpoint[]>([]);
  const [loadingEndpoints, setLoadingEndpoints] = useState(false);

  // Load persisted services / API models from backend on mount
  useEffect(() => {
    if (!activeProjectId) {
      setPersistedEndpoints([]);
      return;
    }

    setLoadingEndpoints(true);
    listServices(activeProjectId)
      .then(async (services) => {
        const allEndpoints: ApiEndpoint[] = [];
        for (const svc of services) {
          try {
            const { apiModel } = await getService(activeProjectId, svc.id);
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
            } else {
              console.warn(`[ApiCatalog] No API model found for service: ${svc.id}`);
            }
          } catch (err) {
            console.warn(`[ApiCatalog] Failed to load service ${svc.id}:`, err);
          }
        }
        setPersistedEndpoints(allEndpoints);
        // Restore contract representation from persisted data when no cached contract exists
        const cached = getCachedContract(activeProjectId);
        if (allEndpoints.length > 0 && !cached) {
          const restored: ApiContract = {
            type: "openapi",
            title: services[0]?.name || "Imported API",
            version: "1.0.0",
            baseUrl: "",
            endpoints: allEndpoints,
            importedAt: new Date().toISOString(),
          };
          setActiveContract(restored);
          cacheContract(activeProjectId, restored);
        } else if (cached) {
          // Bring back cached contract so UI shows endpoints
          setActiveContract(cached);
        }
      })
      .catch((err) => {
        console.error("[ApiCatalog] Failed to list services:", err);
      })
      .finally(() => setLoadingEndpoints(false));
  }, [activeProjectId]);

  const handleContractConfirmed = (contract: ApiContract | null) => {
    setActiveContract(contract);
    if (activeProjectId) {
      cacheContract(activeProjectId, contract);
    }
    // Persist to backend
    if (contract && activeProjectId) {
      registerService(activeProjectId, contract)
        .then(() => {
          // Refresh endpoints from persisted data
          setPersistedEndpoints(contract.endpoints || []);
        })
        .catch((err: unknown) => console.error("[ApiCatalog] Failed to persist API contract:", err));
    }
  };

  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "var(--color-text-primary)" }}>API Catalog</h2>
        <p style={{ color: "var(--muted)", fontSize: "13px" }}>
          Select a project in Setup to view its API catalog.
        </p>
      </div>
    );
  }

  const hasConfiguredContract = activeContract !== null || persistedEndpoints.length > 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: "18px", padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
      {/* ─── First-Time Onboarding Message ───────────────────────────────── */}
      {!hasConfiguredContract && !loadingEndpoints && (
        <div style={{
          gridColumn: "span 12",
          padding: "24px",
          marginBottom: "0",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-info-bg)",
          overflow: "hidden"
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <span style={{ fontSize: "24px", flexShrink: 0 }}>📡</span>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "var(--color-info-text)" }}>
                Welcome to the API Catalog
              </h2>
              <p style={{ margin: "0 0 6px 0", fontSize: "13px", color: "var(--color-info-text)", lineHeight: 1.6 }}>
                <strong>Importing an API contract is the required first step.</strong> Before you can generate tests,
                run executions, or view reports, you need to import your API collection into this project.
              </p>
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "var(--color-info-text)", lineHeight: 1.6 }}>
                Supported formats: OpenAPI 3.0/3.1, Swagger 2.0, Postman Collection, and HAR files.
                Upload a file or paste your collection JSON below to get started.
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "4px",
                  background: "rgba(109, 93, 251, 0.15)",
                  color: "var(--color-info-text)"
                }}>
                  OpenAPI 3.0 / 3.1
                </span>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "4px",
                  background: "rgba(109, 93, 251, 0.15)",
                  color: "var(--color-info-text)"
                }}>
                  Swagger 2.0
                </span>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "4px",
                  background: "rgba(109, 93, 251, 0.15)",
                  color: "var(--color-info-text)"
                }}>
                  Postman Collection
                </span>
                <span style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "4px",
                  background: "rgba(109, 93, 251, 0.15)",
                  color: "var(--color-info-text)"
                }}>
                  HAR
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Existing API Collection Panel (reused) ─────────────────────── */}
      <ApiCollectionPanel
        activeContract={activeContract}
        onContractConfirmed={handleContractConfirmed}
      />
    </div>
  );
}
