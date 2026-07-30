/**
 * ExecutableTestsPage
 *
 * Main page for managing executable tests.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ExecutableTest, TestGenerationResult } from "./ExecutableTestService";
import {
  listExecutableTests,
  getExecutableTestStats,
  createExecutableTest,
  generateExecutableTests,
} from "./ExecutableTestService";
import { GenerationToolbar } from "./GenerationToolbar";
import { GeneratedTestReviewPanel } from "./GeneratedTestReviewPanel";

interface ExecutableTestsPageProps {
  activeProjectId: string | null;
}

export function ExecutableTestsPage({ activeProjectId }: ExecutableTestsPageProps) {
  const [tests, setTests] = useState<ExecutableTest[]>([]);
  const [stats, setStats] = useState<{ total: number; ready: number; draft: number; needsReview: number; approved: number; rejected: number; lastUpdated: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedTest, setSelectedTest] = useState<ExecutableTest | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationResult, setGenerationResult] = useState<TestGenerationResult | null>(null);

  const loadAll = useCallback(async (projectId: string) => {
    setLoading(true);
    setError("");
    try {
      const [testsList, testStats] = await Promise.all([
        listExecutableTests(projectId, { sort: sortField, order: sortOrder, status: statusFilter || undefined, search: searchQuery || undefined }),
        getExecutableTestStats(projectId),
      ]);
      setTests(testsList);
      setStats(testStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load executable tests.");
    } finally {
      setLoading(false);
    }
  }, [sortField, sortOrder, statusFilter, searchQuery]);

  useEffect(() => {
    if (activeProjectId) {
      loadAll(activeProjectId);
    } else {
      setTests([]);
      setStats(null);
      setSelectedTest(null);
    }
  }, [activeProjectId, loadAll]);

  const handleCreateManual = async () => {
    if (!activeProjectId) return;
    setError("");
    try {
      const test = await createExecutableTest(activeProjectId, {
        title: "New Test",
        description: "",
        scenario: "",
        mappedApis: [],
        executionSteps: [],
        headers: {},
        variables: {},
        requestBody: null,
        assertions: [],
        expectedStatusCode: 200,
        dependencies: [],
        priority: "medium",
        confidence: 0.5,
        status: "draft",
        source: "manual",
      });
      setTests((prev) => [test, ...prev]);
      setSelectedTest(test);
      if (activeProjectId) {
        const testStats = await getExecutableTestStats(activeProjectId);
        setStats(testStats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create test.");
    }
  };

  const handleGenerate = async () => {
    if (!activeProjectId) return;
    setGenerating(true);
    setGenerationError("");
    setGenerationResult(null);
    try {
      const result = await generateExecutableTests(activeProjectId);
      setGenerationResult(result);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Failed to generate tests.");
    } finally {
      setGenerating(false);
    }
  };

  const handleClearGeneration = () => {
    setGenerationResult(null);
    setGenerationError("");
  };

  const handleRefresh = () => {
    if (activeProjectId) loadAll(activeProjectId);
  };

  const filteredTests = useMemo(() => tests, [tests]);

  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Total Tests", value: stats.total },
      { label: "Ready", value: stats.ready },
      { label: "Draft", value: stats.draft },
      { label: "Approved", value: stats.approved },
      { label: "Rejected", value: stats.rejected },
    ];
  }, [stats]);

  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "var(--color-text-primary)" }}>Executable Tests</h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Select a project to view its executable tests.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
      <section style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "18px" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>Executable Tests</h1>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>Generated API test cases from approved mappings.</p>
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
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>Test Library</h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>{tests.length > 0 ? "Select a test to view details." : "Add your first test to get started."}</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={handleCreateManual} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>
              Create Test
            </button>
            <button type="button" onClick={handleGenerate} disabled={generating} style={{ padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff", background: generating ? "var(--color-border)" : "var(--color-info)", border: "none", borderRadius: "var(--radius-sm)", cursor: generating ? "not-allowed" : "pointer" }}>
              {generating ? "Generating..." : "Generate Tests"}
            </button>
          </div>
        </div>

        {tests.length > 0 && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)" }}>
            <GenerationToolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} sortField={sortField} onSortChange={setSortField} sortOrder={sortOrder} onOrderChange={setSortOrder} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} totalCount={filteredTests.length} />
          </div>
        )}

        <div style={{ padding: "16px" }}>
          {generationError && <p style={{ fontSize: "13px", color: "var(--color-error)", marginBottom: "12px" }}>{generationError}</p>}

          {(generationResult || generating) && (
            <GeneratedTestReviewPanel result={generationResult} projectId={activeProjectId} onClear={handleClearGeneration} onRefresh={handleRefresh} />
          )}

          {loading && !tests.length ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>Loading tests...</p>
          ) : error && !tests.length ? (
            <p style={{ fontSize: "13px", color: "var(--color-error)" }}>{error}</p>
          ) : !tests.length ? (
            <div style={{ padding: "32px 24px", border: "1px dashed var(--color-border-strong)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)", textAlign: "center" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>No tests yet.</p>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>Create a test manually or generate from approved mappings.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
              {filteredTests.map((test) => (
                <div key={test.id} style={{ padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", cursor: "pointer" }} onClick={() => setSelectedTest(test)}>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{test.title}</h3>
                  <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>{test.description}</p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "11px", color: "var(--color-text-muted)" }}>
                    <span>Priority: {test.priority}</span>
                    <span>•</span>
                    <span>Status: {test.status}</span>
                    <span>•</span>
                    <span>Confidence: {Math.round(test.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedTest && (
        <section style={{ marginBottom: "24px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-surface)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>Test Details</h2>
          </div>
          <div style={{ padding: "16px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>{selectedTest.title}</h3>
            <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "var(--color-text-secondary)" }}>{selectedTest.description}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "12px", color: "var(--color-text-secondary)" }}>
              <div><strong>Scenario:</strong> {selectedTest.scenario}</div>
              <div><strong>Status:</strong> {selectedTest.status}</div>
              <div><strong>Priority:</strong> {selectedTest.priority}</div>
              <div><strong>Expected Status:</strong> {selectedTest.expectedStatusCode}</div>
              <div><strong>APIs:</strong> {selectedTest.mappedApis.length}</div>
              <div><strong>Assertions:</strong> {selectedTest.assertions.length}</div>
            </div>
            <button type="button" onClick={() => setSelectedTest(null)} style={{ marginTop: "12px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Close</button>
          </div>
        </section>
      )}

      <section style={{ marginBottom: "24px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-surface)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>Workflow</h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>Next step after executable tests are ready.</p>
        </div>
        <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>Continue to Execution Workspace</div>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Review approved executable tests and run them.</div>
          </div>
          <button 
            type="button" 
            onClick={() => { window.location.hash = "#execution-workspace"; }}
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