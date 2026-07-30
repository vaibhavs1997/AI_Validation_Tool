/**
 * ApiExplorer
 *
 * Displays imported services and their endpoints with search, filters, and
 * a catalog overview. Reuses the existing parsed API models (ApiModel) and
 * ServiceDefinition — no new backend endpoints, no parser changes.
 *
 * Sections:
 * 1. Catalog Overview — Total Services, Total APIs, REST, GraphQL, Auth Types, Warnings
 * 2. Search — by service name, endpoint path, HTTP method (instant filtering)
 * 3. Filters — All / REST / GraphQL / Authenticated / Public
 * 4. Service Explorer — expandable cards, one per service, with endpoint rows
 */

import { useState, useMemo } from "react";
import type { ServiceDefinition, ApiModel, ApiOperation } from "../../types";

// ─── SVG Icon Components ─────────────────────────────────────────────────────

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconServer = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <path d="M6 6h.01M6 18h.01" />
  </svg>
);

const IconApi = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const IconRest = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </svg>
);

const IconGraphql = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="12" cy="4" r="2" />
    <circle cx="5" cy="18" r="2" />
    <circle cx="19" cy="18" r="2" />
    <line x1="12" y1="6" x2="5" y2="16" />
    <line x1="12" y1="6" x2="19" y2="16" />
    <line x1="5" y1="18" x2="19" y2="18" />
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconWarning = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconChevron = ({ expanded }: { expanded: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="16"
    height="16"
    style={{
      transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
      transition: "transform var(--transition-fast)",
    }}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiExplorerProps {
  services: ServiceDefinition[];
  apiModels: Record<string, ApiModel | null>;
  loading?: boolean;
}

type FilterType = "all" | "rest" | "graphql" | "authenticated" | "public";

interface ServiceWithOps {
  service: ServiceDefinition;
  model: ApiModel | null;
  operations: ApiOperation[];
  isGraphql: boolean;
  isRest: boolean;
  hasAuth: boolean;
  baseUrl: string;
  authType: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  GET: { bg: "var(--color-success-soft)", text: "var(--color-success)" },
  POST: { bg: "var(--color-info-soft)", text: "var(--color-info)" },
  PUT: { bg: "var(--color-warning-soft)", text: "var(--color-warning)" },
  PATCH: { bg: "var(--violet-soft)", text: "var(--violet)" },
  DELETE: { bg: "var(--color-error-soft)", text: "var(--color-error)" },
  HEAD: { bg: "var(--color-bg-muted)", text: "var(--color-text-muted)" },
  OPTIONS: { bg: "var(--color-bg-muted)", text: "var(--color-text-muted)" },
};

function getMethodColor(method: string) {
  return METHOD_COLORS[method.toUpperCase()] || { bg: "var(--color-bg-muted)", text: "var(--color-text-muted)" };
}

/**
 * Detects whether a service is GraphQL based on protocol or path patterns.
 * Reuses existing parsed data — no new parsing.
 */
function detectIsGraphql(service: ServiceDefinition, model: ApiModel | null): boolean {
  const protocol = (service.protocol || model?.service?.protocol || "").toLowerCase();
  if (protocol.includes("graphql")) return true;
  if (model?.baseUrl && model.baseUrl.toLowerCase().includes("graphql")) return true;
  // Check if all operations hit a /graphql path
  if (model?.operations?.length) {
    const allGraphql = model.operations.every(
      (op) => (op.path || "").toLowerCase().includes("graphql")
    );
    if (allGraphql && model.operations.length > 0) return true;
  }
  return false;
}

/**
 * Detects authentication type from service description or protocol.
 * Reuses existing parsed data — no new parsing.
 */
function detectAuthType(service: ServiceDefinition, model: ApiModel | null): string {
  const desc = (service.description || model?.service?.description || "").toLowerCase();
  if (desc.includes("bearer") || desc.includes("jwt")) return "Bearer";
  if (desc.includes("api key") || desc.includes("apikey")) return "API Key";
  if (desc.includes("basic auth") || desc.includes("basic authentication")) return "Basic";
  if (desc.includes("oauth")) return "OAuth";
  if (desc.includes("session") || desc.includes("cookie")) return "Session";
  return "None";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ApiExplorer({ services, apiModels, loading }: ApiExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  // ─── Build service list with operations and metadata ─────────────────────
  const serviceList: ServiceWithOps[] = useMemo(() => {
    return services.map((service) => {
      const model = apiModels[service.id] || null;
      const operations = model?.operations || [];
      const isGraphql = detectIsGraphql(service, model);
      const isRest = !isGraphql;
      const authType = detectAuthType(service, model);
      const hasAuth = authType !== "None";
      const baseUrl = model?.baseUrl || "";
      return {
        service,
        model,
        operations,
        isGraphql,
        isRest,
        hasAuth,
        authType,
        baseUrl,
      };
    });
  }, [services, apiModels]);

  // ─── Catalog Overview stats ──────────────────────────────────────────────
  const overview = useMemo(() => {
    const totalServices = serviceList.length;
    const allOps = serviceList.flatMap((s) => s.operations);
    const totalApis = allOps.length;
    const restApis = serviceList
      .filter((s) => s.isRest)
      .reduce((sum, s) => sum + s.operations.length, 0);
    const graphqlApis = serviceList
      .filter((s) => s.isGraphql)
      .reduce((sum, s) => sum + s.operations.length, 0);
    const authTypes = new Set(
      serviceList.filter((s) => s.hasAuth).map((s) => s.authType)
    );
    const warnings: string[] = [];
    serviceList.forEach((s) => {
      if (s.operations.length === 0) {
        warnings.push(`${s.service.name} has no operations.`);
      }
    });
    return {
      totalServices,
      totalApis,
      restApis,
      graphqlApis,
      authTypes: Array.from(authTypes),
      warnings,
    };
  }, [serviceList]);

  // ─── Filtering logic ─────────────────────────────────────────────────────
  const filteredServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return serviceList.filter((svc) => {
      // Filter by type
      if (activeFilter === "rest" && !svc.isRest) return false;
      if (activeFilter === "graphql" && !svc.isGraphql) return false;
      if (activeFilter === "authenticated" && !svc.hasAuth) return false;
      if (activeFilter === "public" && svc.hasAuth) return false;

      // Search by service name, endpoint path, or HTTP method
      if (query) {
        const nameMatch = svc.service.name.toLowerCase().includes(query);
        const opMatch = svc.operations.some(
          (op) =>
            (op.path || "").toLowerCase().includes(query) ||
            (op.method || "").toLowerCase().includes(query) ||
            (op.summary || "").toLowerCase().includes(query)
        );
        if (!nameMatch && !opMatch) return false;
      }
      return true;
    });
  }, [serviceList, searchQuery, activeFilter]);

  // ─── Expand/collapse handlers ────────────────────────────────────────────
  const toggleService = (serviceId: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedServices(new Set(filteredServices.map((s) => s.service.id)));
  };

  const collapseAll = () => {
    setExpandedServices(new Set());
  };

  // ─── Overview stat cards ─────────────────────────────────────────────────
  const overviewStats = [
    { label: "Total Services", value: overview.totalServices, icon: IconServer },
    { label: "Total APIs", value: overview.totalApis, icon: IconApi },
    { label: "REST APIs", value: overview.restApis, icon: IconRest },
    { label: "GraphQL APIs", value: overview.graphqlApis, icon: IconGraphql },
  ];

  // ─── Filter options ──────────────────────────────────────────────────────
  const filters: Array<{ id: FilterType; label: string }> = [
    { id: "all", label: "All" },
    { id: "rest", label: "REST" },
    { id: "graphql", label: "GraphQL" },
    { id: "authenticated", label: "Authenticated" },
    { id: "public", label: "Public" },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ═══════════════════════════════════════════════════════════════════
          API EXPLORER SECTION 1: Catalog Overview
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
            Catalog Overview
          </h2>
          <p style={{
            margin: "4px 0 0 0",
            fontSize: "12px",
            color: "var(--color-text-secondary)",
          }}>
            Summary of all imported services and APIs.
          </p>
        </div>
        <div style={{ padding: "16px" }}>
          {/* Stat cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "12px",
            marginBottom: "16px",
          }}>
            {overviewStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 14px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-bg-surface)",
                  }}
                >
                  <div style={{
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-primary-soft)",
                    color: "var(--color-primary)",
                    flexShrink: 0,
                  }}>
                    <Icon />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "var(--color-text-muted)",
                    }}>
                      {stat.label}
                    </div>
                    <div style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                    }}>
                      {loading ? "…" : stat.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Auth types + warnings row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "12px",
          }}>
            {/* Authentication types */}
            <div style={{
              padding: "12px 14px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg-subtle)",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}>
                <span style={{ color: "var(--color-info)", display: "inline-flex" }}>
                  <IconShield />
                </span>
                <span style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--color-text-muted)",
                }}>
                  Authentication Types
                </span>
              </div>
              {overview.authTypes.length === 0 ? (
                <span style={{
                  fontSize: "13px",
                  color: "var(--color-text-muted)",
                }}>
                  None detected
                </span>
              ) : (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {overview.authTypes.map((auth) => (
                    <span
                      key={auth}
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: "var(--radius-pill)",
                        background: "var(--color-info-soft)",
                        color: "var(--color-info)",
                      }}
                    >
                      {auth}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Import warnings */}
            <div style={{
              padding: "12px 14px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              background: overview.warnings.length > 0 ? "var(--color-warning-soft)" : "var(--color-bg-subtle)",
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}>
                <span style={{ color: overview.warnings.length > 0 ? "var(--color-warning)" : "var(--color-text-muted)", display: "inline-flex" }}>
                  <IconWarning />
                </span>
                <span style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--color-text-muted)",
                }}>
                  Import Warnings
                </span>
              </div>
              {overview.warnings.length === 0 ? (
                <span style={{
                  fontSize: "13px",
                  color: "var(--color-text-muted)",
                }}>
                  No warnings
                </span>
              ) : (
                <ul style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}>
                  {overview.warnings.map((w, i) => (
                    <li key={i} style={{
                      fontSize: "12px",
                      color: "var(--color-warning)",
                      lineHeight: 1.4,
                    }}>
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          API EXPLORER SECTION 2 & 3: Search + Filters
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
            Service Explorer
          </h2>
          <p style={{
            margin: "4px 0 0 0",
            fontSize: "12px",
            color: "var(--color-text-secondary)",
          }}>
            Browse imported services and their endpoints.
          </p>
        </div>
        <div style={{ padding: "16px" }}>
          {/* Search input */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}>
              <span style={{
                position: "absolute",
                left: "12px",
                display: "inline-flex",
                color: "var(--color-text-muted)",
                pointerEvents: "none",
              }}>
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder="Search by service name, endpoint path, or HTTP method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search services and endpoints"
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 40px",
                  fontSize: "13px",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-bg-surface)",
                  color: "var(--color-text-primary)",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Filter chips */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}>
            {filters.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  aria-pressed={isActive}
                  style={{
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: isActive ? "#fff" : "var(--color-text-secondary)",
                    background: isActive ? "var(--color-primary)" : "var(--color-bg-subtle)",
                    border: `1px solid ${isActive ? "var(--color-primary)" : "var(--color-border)"}`,
                    borderRadius: "var(--radius-pill)",
                    cursor: "pointer",
                    transition: "background var(--transition-fast), color var(--transition-fast)",
                  }}
                >
                  {filter.label}
                </button>
              );
            })}

            {/* Expand/Collapse all */}
            <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={expandAll}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Result count */}
          <div style={{
            fontSize: "12px",
            color: "var(--color-text-muted)",
            marginBottom: "12px",
          }}>
            {filteredServices.length} service{filteredServices.length !== 1 ? "s" : ""} found
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              API EXPLORER SECTION 4: Service Explorer cards
              ═══════════════════════════════════════════════════════════════ */}
          {filteredServices.length === 0 ? (
            <div style={{
              padding: "32px 24px",
              border: "1px dashed var(--color-border-strong)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg-subtle)",
              textAlign: "center",
            }}>
              <p style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}>
                No services match your search
              </p>
              <p style={{
                margin: "4px 0 0 0",
                fontSize: "13px",
                color: "var(--color-text-muted)",
              }}>
                Try a different search term or filter.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredServices.map((svc) => {
                const isExpanded = expandedServices.has(svc.service.id);
                return (
                  <div
                    key={svc.service.id}
                    style={{
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--color-bg-surface)",
                      overflow: "hidden",
                    }}
                  >
                    {/* Service header (clickable to expand) */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => toggleService(svc.service.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleService(svc.service.id);
                        }
                      }}
                      style={{
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        cursor: "pointer",
                        transition: "background var(--transition-fast)",
                        outline: "none",
                      }}
                    >
                      <span style={{
                        color: "var(--color-text-muted)",
                        display: "inline-flex",
                        flexShrink: 0,
                      }}>
                        <IconChevron expanded={isExpanded} />
                      </span>
                      <div style={{
                        width: "36px",
                        height: "36px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--color-primary-soft)",
                        color: "var(--color-primary)",
                        flexShrink: 0,
                      }}>
                        <IconServer />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}>
                          <span style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "var(--color-text-primary)",
                          }}>
                            {svc.service.name}
                          </span>
                          {/* REST / GraphQL badge */}
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-pill)",
                            background: svc.isGraphql ? "var(--color-violet-soft, var(--violet-soft))" : "var(--color-info-soft)",
                            color: svc.isGraphql ? "var(--violet)" : "var(--color-info)",
                          }}>
                            {svc.isGraphql ? "GraphQL" : "REST"}
                          </span>
                          {/* Auth badge */}
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-pill)",
                            background: svc.hasAuth ? "var(--color-warning-soft)" : "var(--color-bg-muted)",
                            color: svc.hasAuth ? "var(--color-warning)" : "var(--color-text-muted)",
                          }}>
                            {svc.hasAuth ? svc.authType : "Public"}
                          </span>
                        </div>
                        {/* Description + base URL */}
                        <div style={{
                          fontSize: "12px",
                          color: "var(--color-text-secondary)",
                          marginTop: "2px",
                          display: "flex",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}>
                          {svc.service.description && (
                            <span style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "400px",
                            }}>
                              {svc.service.description}
                            </span>
                          )}
                          {svc.baseUrl && (
                            <span style={{
                              fontFamily: "monospace",
                              color: "var(--color-text-muted)",
                            }}>
                              {svc.baseUrl}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* API count */}
                      <div style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                      }}>
                        {svc.operations.length} API{svc.operations.length !== 1 ? "s" : ""}
                      </div>
                    </div>

                    {/* Expanded endpoint list */}
                    {isExpanded && (
                      <div style={{
                        borderTop: "1px solid var(--color-border)",
                        background: "var(--color-bg-subtle)",
                      }}>
                        {svc.operations.length === 0 ? (
                          <div style={{
                            padding: "16px",
                            fontSize: "13px",
                            color: "var(--color-text-muted)",
                            textAlign: "center",
                          }}>
                            No endpoints in this service.
                          </div>
                        ) : (
                          <div>
                            {svc.operations.map((op, idx) => {
                              const mc = getMethodColor(op.method || "GET");
                              return (
                                <div
                                  key={op.id || idx}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "8px 16px",
                                    borderBottom: idx < svc.operations.length - 1 ? "1px solid var(--color-border)" : "none",
                                    fontSize: "13px",
                                  }}
                                >
                                  {/* HTTP Method badge */}
                                  <span style={{
                                    display: "inline-block",
                                    minWidth: "60px",
                                    padding: "2px 6px",
                                    borderRadius: "var(--radius-xs)",
                                    fontWeight: 700,
                                    fontSize: "11px",
                                    textAlign: "center",
                                    textTransform: "uppercase",
                                    fontFamily: "monospace",
                                    background: mc.bg,
                                    color: mc.text,
                                    flexShrink: 0,
                                  }}>
                                    {op.method || "GET"}
                                  </span>
                                  {/* Path */}
                                  <span style={{
                                    fontFamily: "monospace",
                                    fontSize: "12px",
                                    color: "var(--color-text-primary)",
                                    flexShrink: 0,
                                  }}>
                                    {op.path || "/"}
                                  </span>
                                  {/* Operation name / summary */}
                                  <span style={{
                                    color: "var(--color-text-secondary)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    minWidth: 0,
                                    flex: 1,
                                  }}>
                                    {op.summary || op.description || op.id || "—"}
                                  </span>
                                  {/* Auth badge per endpoint */}
                                  <span style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    padding: "2px 6px",
                                    borderRadius: "var(--radius-pill)",
                                    background: svc.hasAuth ? "var(--color-warning-soft)" : "var(--color-bg-muted)",
                                    color: svc.hasAuth ? "var(--color-warning)" : "var(--color-text-muted)",
                                    flexShrink: 0,
                                  }}>
                                    {svc.hasAuth ? svc.authType : "Public"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}