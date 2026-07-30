/**
 * ImplementationMappingsPage
 *
 * Main page for managing implementation mappings.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ImplementationMapping, MappingAnalysisResult } from "./ImplementationMappingService";
import {
  listImplementationMappings,
  getImplementationMappingStats,
  createImplementationMapping,
  analyzeImplementationMappings,
} from "./ImplementationMappingService";
import { MappingCard } from "./MappingCard";
import { MappingToolbar } from "./MappingToolbar";
import { MappingReviewPanel } from "./MappingReviewPanel";
import { ExecutionFlowCard } from "./ExecutionFlowCard";

interface ImplementationMappingsPageProps {
  activeProjectId: string | null;
}

export function ImplementationMappingsPage({ activeProjectId }: ImplementationMappingsPageProps) {
  const [mappings, setMappings] = useState<ImplementationMapping[]>([]);
  const [stats, setStats] = useState<{ total: number; ready: number; draft: number; needsReview: number; approved: number; rejected: number; lastUpdated: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedMapping, setSelectedMapping] = useState<ImplementationMapping | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisResult, setAnalysisResult] = useState<MappingAnalysisResult | null>(null);

  const loadAll = useCallback(async (projectId: string) => {
    setLoading(true);
    setError("");
    try {
      const [mappingsList, mappingStats] = await Promise.all([
        listImplementationMappings(projectId, { sort: sortField, order: sortOrder, status: statusFilter || undefined, search: searchQuery || undefined }),
        getImplementationMappingStats(projectId),
      ]);
      setMappings(mappingsList);
      setStats(mappingStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load implementation mappings.");
    } finally {
      setLoading(false);
    }
  }, [sortField, sortOrder, statusFilter, searchQuery]);

  useEffect(() => {
    if (activeProjectId) {
      loadAll(activeProjectId);
    } else {
      setMappings([]);
      setStats(null);
      setSelectedMapping(null);
    }
  }, [activeProjectId, loadAll]);

  const handleCreateManual = async () => {
    if (!activeProjectId) return;
    setError("");
    try {
      const mapping = await createImplementationMapping(activeProjectId, {
        title: "New Mapping",
        description: "",
        candidateApis: [],
        executionOrder: "sequential",
        authenticationRequired: false,
        authenticationDetails: "",
        requestDependencies: [],
        variablesRequired: [],
        executionFlow: [],
        confidence: 0.5,
        reasoning: "",
        status: "draft",
        source: "manual",
      });
      setMappings((prev) => [mapping, ...prev]);
      setSelectedMapping(mapping);
      if (activeProjectId) {
        const mappingStats = await getImplementationMappingStats(activeProjectId);
        setStats(mappingStats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create mapping.");
    }
  };

  const handleAnalyze = async () => {
    if (!activeProjectId) return;
    setAnalyzing(true);
    setAnalysisError("");
    setAnalysisResult(null);
    try {
      const result = await analyzeImplementationMappings(activeProjectId);
      setAnalysisResult(result);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Failed to analyze mappings.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClearAnalysis = () => {
    setAnalysisResult(null);
    setAnalysisError("");
  };

  const handleRefresh = () => {
    if (activeProjectId) loadAll(activeProjectId);
  };

  const filteredMappings = useMemo(() => mappings, [mappings]);

  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Total Mappings", value: stats.total },
      { label: "Ready", value: stats.ready },
      { label: "Draft", value: stats.draft },
      { label: "Approved", value: stats.approved },
      { label: "Rejected", value: stats.rejected },
    ];
  }, [stats]);

  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "var(--color-text-primary)" }}>Implementation Mappings</h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Select a project to view its implementation mappings.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
      <section style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "18px" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>Implementation Mappings</h1>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>Map validation scenarios to API implementations.</p>
          </div>
          <button type="button" onClick={handleRefresh} style={{ padding: "6px 12px", fontSize: "13px", fontWeight: 600, border: "1px solid var(--color-border)", borderRadius: "4px", background: "var(--color-bg-surface)", cursor: "pointer", color: "var(--color-text-primary)", display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            Refresh
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "24px" }}>
          {statsCards.map((stat) => (
            <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "2px" }}>{stat.label}</div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>{loading ? "…" : stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "24px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-surface)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>Mapping Library</h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>{mappings.length > 0 ? "Select a mapping to view details." : "Add your first mapping to get started."}</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={handleCreateManual} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
              Create Mapping
            </button>
            <button type="button" onClick={handleAnalyze} disabled={analyzing} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: analyzing ? "var(--color-border)" : "var(--color-info)", border: "none", borderRadius: "var(--radius-sm)", cursor: analyzing ? "not-allowed" : "pointer" }}>
              {analyzing ? "Analyzing..." : "Analyze Mappings"}
            </button>
          </div>
        </div>

        {mappings.length > 0 && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)" }}>
            <MappingToolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} sortField={sortField} onSortChange={setSortField} sortOrder={sortOrder} onOrderChange={setSortOrder} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} totalCount={filteredMappings.length} />
          </div>
        )}

        <div style={{ padding: "16px" }}>
          {analysisError && <p style={{ fontSize: "13px", color: "var(--color-error)", marginBottom: "12px" }}>{analysisError}</p>}

          {(analysisResult || analyzing) && (
            <MappingReviewPanel result={analysisResult} projectId={activeProjectId} onClear={handleClearAnalysis} onRefresh={handleRefresh} />
          )}

          {loading && !mappings.length ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>Loading mappings...</p>
          ) : error && !mappings.length ? (
            <p style={{ fontSize: "13px", color: "var(--color-error)" }}>{error}</p>
          ) : !mappings.length ? (
            <div style={{ padding: "32px 24px", border: "1px dashed var(--color-border-strong)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)", textAlign: "center" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>No mappings yet.</p>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>Create a mapping manually or analyze requirements and scenarios.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
              {filteredMappings.map((mapping) => (
                <MappingCard key={mapping.id} mapping={mapping} selected={selectedMapping?.id === mapping.id} onSelect={setSelectedMapping} />
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedMapping && (
        <section style={{ marginBottom: "24px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-surface)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>Mapping Details</h2>
          </div>
          <div style={{ padding: "16px" }}>
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{selectedMapping.title}</h3>
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{selectedMapping.description}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                <div><strong>Status:</strong> {selectedMapping.status}</div>
                <div><strong>Confidence:</strong> {Math.round(selectedMapping.confidence * 100)}%</div>
                <div><strong>Execution Order:</strong> {selectedMapping.executionOrder}</div>
                <div><strong>Auth Required:</strong> {selectedMapping.authenticationRequired ? "Yes" : "No"}</div>
                <div><strong>APIs:</strong> {selectedMapping.candidateApis.length}</div>
                <div><strong>Variables:</strong> {selectedMapping.variablesRequired.length}</div>
              </div>
            </div>
            {selectedMapping.reasoning && (
              <div style={{ marginBottom: "16px", padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "4px" }}>Reasoning</div>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{selectedMapping.reasoning}</p>
              </div>
            )}
            {selectedMapping.executionFlow.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <ExecutionFlowCard executionFlow={selectedMapping.executionFlow} executionOrder={selectedMapping.executionOrder} />
              </div>
            )}
            <button type="button" onClick={() => setSelectedMapping(null)} style={{ padding: "8px 14px", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Close</button>
          </div>
        </section>
      )}

      <section style={{ marginBottom: "24px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-surface)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>Workflow</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>Next step after mappings are ready.</p>
        </div>
        <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>Continue to Executable Tests</div>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Generate executable tests from approved implementation mappings.</div>
          </div>
          <button 
            type="button" 
            onClick={() => { window.location.hash = "#executable-tests"; }}
            style={{ 
              padding: "8px 16px", 
              fontSize: "13px", 
              fontWeight: 600, 
              color: "#fff", 
              background: "var(--color-primary)", 
              border: "none", 
              borderRadius: "var(--radius-sm)", 
              cursor: "pointer" 
            }}
          >
            Continue →
          </button>
        </div>
      </section>
    </div>
  );
}