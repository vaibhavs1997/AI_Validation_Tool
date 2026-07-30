/**
 * ExecutionWorkspacePage
 *
 * Main page for reviewing and executing approved Executable Tests.
 * Allows users to build execution plans, review dependencies, and run tests.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ExecutionRun, RunStats } from "./ExecutionWorkspaceService";
import {
  listExecutionRuns,
  getExecutionRunStats,
  getExecutionRun,
  createExecutionRun,
  deleteExecutionRun,
  buildExecutionPlan,
  rebuildExecutionPlan,
  executeExecutionRun,
  dryRunExecutionRun,
  cancelExecutionRun,
} from "./ExecutionWorkspaceService";
import { ExecutionToolbar } from "./ExecutionToolbar";
import { ExecutionPlanCard } from "./ExecutionPlanCard";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { ExecutionLogViewer } from "./ExecutionLogViewer";
import { DependencyTree } from "./DependencyTree";

interface ExecutionWorkspacePageProps {
  activeProjectId: string | null;
}

export function ExecutionWorkspacePage({ activeProjectId }: ExecutionWorkspacePageProps) {
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [selectedRun, setSelectedRun] = useState<ExecutionRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollIntervalRef = useRef<number | null>(null);

  const loadAll = useCallback(async (projectId: string) => {
    setLoading(true);
    setError("");
    try {
      const [runsList, runStats] = await Promise.all([
        listExecutionRuns(projectId),
        getExecutionRunStats(projectId),
      ]);
      setRuns(runsList);
      setStats(runStats);
      if (runsList.length > 0 && !selectedRun) {
        setSelectedRun(runsList[0] ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load execution runs.");
    } finally {
      setLoading(false);
    }
  }, [selectedRun]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeProjectId) {
      loadAll(activeProjectId);
    } else {
      setRuns([]);
      setStats(null);
      setSelectedRun(null);
    }
  }, [activeProjectId]);

  // Polling for running executions
  useEffect(() => {
    if (polling && activeProjectId && selectedRun) {
      pollIntervalRef.current = window.setInterval(async () => {
        try {
          const updated = await getExecutionRun(activeProjectId, selectedRun.id);
          setSelectedRun(updated);
          if (updated.status !== "running" && updated.status !== "pending") {
            setPolling(false);
          }
        } catch {
          // Ignore polling errors
        }
      }, 2000);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [polling, activeProjectId, selectedRun]);

  const handleCreateRun = async () => {
    if (!activeProjectId) return;
    setError("");
    try {
      const run = await createExecutionRun(activeProjectId, {
        name: `Run ${new Date().toLocaleString()}`,
      });
      setRuns((prev) => [run, ...prev]);
      setSelectedRun(run);
      if (activeProjectId) {
        const runStats = await getExecutionRunStats(activeProjectId);
        setStats(runStats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run.");
    }
  };

  const handleBuildPlan = async () => {
    if (!activeProjectId || !selectedRun) return;
    setLoadingAction("build-plan");
    try {
      const run = await buildExecutionPlan(activeProjectId, selectedRun.id, {});
      setSelectedRun(run);
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build plan.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRebuildPlan = async () => {
    if (!activeProjectId || !selectedRun) return;
    setLoadingAction("rebuild-plan");
    try {
      const run = await rebuildExecutionPlan(activeProjectId, selectedRun.id, {});
      setSelectedRun(run);
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rebuild plan.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRun = async () => {
    if (!activeProjectId || !selectedRun) return;
    setLoadingAction("execute");
    setPolling(true);
    try {
      const run = await executeExecutionRun(activeProjectId, selectedRun.id, {});
      setSelectedRun(run);
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute run.");
      setPolling(false);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDryRun = async () => {
    if (!activeProjectId || !selectedRun) return;
    setLoadingAction("dry-run");
    try {
      const run = await dryRunExecutionRun(activeProjectId, selectedRun.id, {});
      setSelectedRun(run);
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dry run.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancel = async () => {
    if (!activeProjectId || !selectedRun) return;
    setLoadingAction("cancel");
    try {
      const run = await cancelExecutionRun(activeProjectId, selectedRun.id);
      setSelectedRun(run);
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
      setPolling(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel run.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteRun = async (runId: string) => {
    if (!activeProjectId) return;
    if (!window.confirm("Delete this execution run? This cannot be undone.")) return;
    try {
      await deleteExecutionRun(activeProjectId, runId);
      setRuns((prev) => prev.filter((r) => r.id !== runId));
      if (selectedRun?.id === runId) {
        setSelectedRun(runs.length > 1 ? (runs[1] ?? null) : null);
      }
      const runStats = await getExecutionRunStats(activeProjectId);
      setStats(runStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete run.");
    }
  };

  const handleSelectRun = async (run: ExecutionRun) => {
    if (!activeProjectId) return;
    setSelectedRun(run);
    try {
      const updated = await getExecutionRun(activeProjectId, run.id);
      setSelectedRun(updated);
    } catch {
      // Use cached version
    }
  };

  const handleRefresh = () => {
    if (activeProjectId) loadAll(activeProjectId);
  };

  // Compute action availability
  const canRun = !!selectedRun?.plan && selectedRun.status === "planned";
  const canDryRun = !!selectedRun?.plan && (selectedRun.status === "planned" || selectedRun.status === "pending");
  const canCancel = selectedRun?.status === "running";
  const canRebuild = !!selectedRun;

  // Keyboard shortcuts
  useEffect(() => {
    if (!activeProjectId || !selectedRun) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey) return;

      switch (e.key.toLowerCase()) {
        case "r":
          if (canRun && !loading) { e.preventDefault(); handleRun(); }
          break;
        case "d":
          if (canDryRun && !loading) { e.preventDefault(); handleDryRun(); }
          break;
        case "b":
          if (canRebuild && !loading) { e.preventDefault(); handleRebuildPlan(); }
          break;
        case "Escape":
          if (canCancel && !loading) { e.preventDefault(); handleCancel(); }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeProjectId, selectedRun, canRun, canDryRun, canCancel, canRebuild, loading]);

  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "var(--color-text-primary)" }}>Execution Workspace</h2>
        <p style={{ color: "var(--color-text-muted)", fontSize: "13px" }}>Select a project to review and execute tests.</p>
      </div>
    );
  }

  const statsCards = stats
    ? [
        { label: "Total Runs", value: stats.total },
        { label: "Running", value: stats.running },
        { label: "Passed", value: stats.passed },
        { label: "Failed", value: stats.failed },
        { label: "Blocked", value: stats.blocked },
        { label: "Skipped", value: stats.skipped },
      ]
    : [];

  return (
    <div style={{ padding: "22px", maxWidth: "1520px", margin: "0 auto" }}>
      {/* Header */}
      <section style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "18px",
          }}
        >
          <div>
            <h1
              style={{
                margin: "0 0 6px 0",
                fontSize: "24px",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              Execution Workspace
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                color: "var(--color-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              Review approved executable tests, build execution plans, and run tests.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
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
              aria-label="Refresh execution runs"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleCreateRun}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#fff",
                background: "var(--color-primary)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}
              aria-label="Create new execution run"
            >
              New Run
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          {statsCards.map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 16px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-bg-surface)",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--color-text-muted)",
                    marginBottom: "2px",
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {loading ? "…" : stat.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            fontSize: "13px",
            color: "var(--color-error)",
            background: "var(--color-error-bg)",
            border: "1px solid var(--color-error-border)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {error}
        </div>
      )}

      {/* Runs List / Selected Run */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "16px", marginBottom: "24px" }}>
        {/* Runs List */}
        <aside>
          <h2
            style={{
              margin: "0 0 12px 0",
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            Execution Runs
          </h2>
          {loading && !runs.length ? (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>Loading runs…</p>
          ) : !runs.length ? (
            <div
              style={{
                padding: "24px",
                border: "1px dashed var(--color-border-strong)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-bg-subtle)",
                textAlign: "center",
              }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                No execution runs yet.
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>
                Create a new run to get started.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {runs.map((run) => (
                <div
                  key={run.id}
                  onClick={() => handleSelectRun(run)}
                  style={{
                    padding: "12px 14px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    background:
                      selectedRun?.id === run.id
                        ? "var(--color-bg-subtle)"
                        : "var(--color-bg-surface)",
                    cursor: "pointer",
                    borderWidth: selectedRun?.id === run.id ? "2px" : "1px",
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select run: ${run.name}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectRun(run);
                    }
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {run.name}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        padding: "2px 6px",
                        borderRadius: "8px",
                        background: `${"var(--color-text-muted)"}20`,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {run.status}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {new Date(run.createdAt).toLocaleString()}
                  </div>
                  {run.plan && (
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "11px",
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {run.plan.steps.length} steps
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRun(run.id);
                    }}
                    style={{
                      marginTop: "6px",
                      padding: "4px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--color-error)",
                      background: "transparent",
                      border: "1px solid var(--color-error)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                    }}
                    aria-label={`Delete run: ${run.name}`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Selected Run Detail */}
        <main>
          {selectedRun ? (
            <>
              {/* Toolbar */}
              <div
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--color-bg-surface)",
                  overflow: "hidden",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    padding: "12px 20px",
                    borderBottom: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {selectedRun.name}
                  </h2>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      background: "var(--color-info)20",
                      color: "var(--color-info)",
                      border: "1px solid var(--color-info)40",
                    }}
                  >
                    {selectedRun.status}
                  </span>
                </div>
                <ExecutionToolbar
                  run={selectedRun}
                  canRun={canRun}
                  canDryRun={canDryRun}
                  canCancel={canCancel}
                  canRebuild={canRebuild}
                  onRun={handleRun}
                  onDryRun={handleDryRun}
                  onCancel={handleCancel}
                  onRebuild={handleRebuildPlan}
                  loading={!!loadingAction}
                  loadingAction={loadingAction}
                />
              </div>

              {/* Execution Plan Card */}
              <ExecutionPlanCard
                plan={selectedRun.plan}
                onBuildPlan={handleBuildPlan}
                onRebuildPlan={handleRebuildPlan}
                building={loadingAction === "build-plan" || loadingAction === "rebuild-plan"}
              />

              {/* Dependency Tree */}
              <DependencyTree plan={selectedRun.plan} />

              {/* Execution Timeline */}
              <ExecutionTimeline run={selectedRun} />

              {/* Execution Log */}
              <ExecutionLogViewer run={selectedRun} />

              {/* Bottom Card: Execution Complete */}
              {(selectedRun.status === "completed" ||
                selectedRun.status === "passed" ||
                selectedRun.status === "failed" ||
                selectedRun.status === "cancelled") && (
                <section
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-bg-surface)",
                    overflow: "hidden",
                    marginBottom: "24px",
                  }}
                >
                  <div
                    style={{
                      padding: "16px 20px",
                      borderBottom: "1px solid var(--color-border)",
                    }}
                  >
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      Execution Complete
                    </h2>
                  </div>
                  <div style={{ padding: "16px 20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "var(--color-text-primary)",
                          }}
                        >
                          Continue to Validation Report
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          Review execution results and generate validation reports.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.hash = "#results";
                        }}
                        style={{
                          padding: "8px 16px",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#fff",
                          background: "var(--color-primary)",
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                        }}
                        aria-label="Continue to validation report"
                      >
                        View Report
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </>
          ) : (
            <div
              style={{
                padding: "32px 24px",
                border: "1px dashed var(--color-border-strong)",
                borderRadius: "var(--radius-lg)",
                background: "var(--color-bg-subtle)",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                No run selected.
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "var(--color-text-muted)",
                }}
              >
                Select a run from the list or create a new one.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
