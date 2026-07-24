/**
 * ResultsPage
 *
 * STEP 5.8 — Displays a persisted run from the active TestCase-first workflow.
 *
 * Reuses presentation patterns from ExecutionPanel.
 * Renders only persisted evidence — does NOT recompute TestCases, matching, or plans.
 */

import { useState, useEffect } from "react";
import { getRun, type RunDetail } from "../runs/RunService";

interface ResultsPageProps {
  activeProjectId: string | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

function renderStepResult(
  result: {
    step: number;
    operation: { serviceId: string; operationId: string; method?: string; path?: string };
    status: "passed" | "failed" | "blocked";
    request?: unknown;
    response?: unknown;
    validation?: unknown;
    error?: string;
  },
  index: number
) {
  const isBlocked = result.status === "blocked";
  const isFailed = result.status === "failed";
  const isPassed = result.status === "passed";

  const getStatusStyle = () => {
    if (isPassed) return { bg: "var(--green-soft)", border: "var(--green)", text: "var(--green-deep)", icon: "✓" };
    if (isFailed) return { bg: "var(--red-soft)", border: "var(--red)", text: "var(--red-deep)", icon: "✕" };
    if (isBlocked) return { bg: "#f0f0f0", border: "var(--line)", text: "var(--muted)", icon: "⊘" };
    return { bg: "var(--surface)", border: "var(--line)", text: "var(--muted)", icon: "?" };
  };

  const st = getStatusStyle();

  return (
    <div key={index} style={{
      border: `1px solid ${st.border}`,
      borderRadius: "6px",
      padding: "10px 12px",
      marginBottom: "6px",
      background: st.bg,
      opacity: isBlocked ? 0.75 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{
          width: "22px",
          height: "22px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "4px",
          fontSize: "12px",
          fontWeight: 700,
          color: "#fff",
          background: isPassed ? "var(--green)" : isFailed ? "var(--red)" : "var(--line)",
        }}>
          {st.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
            {result.operation.serviceId}::{result.operation.operationId}
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "monospace" }}>
            {result.operation.method} {result.operation.path}
          </div>
        </div>
        <span style={{
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          background: st.bg,
          color: st.text,
          border: `1px solid ${st.border}`,
        }}>
          {result.status.toUpperCase()}
        </span>
      </div>

      {!isPassed && result.error && (
        <div style={{
          marginTop: "4px",
          padding: "6px 8px",
          background: "var(--surface)",
          borderRadius: "4px",
          fontSize: "12px",
          color: isFailed ? "var(--red-deep)" : "var(--muted)",
        }}>
          {result.error}
        </div>
      )}

      {(!!result.request || !!result.response) && (
        <details style={{ marginTop: "6px" }}>
          <summary style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--muted)",
            cursor: "pointer",
            padding: "4px 0",
          }}>
            Technical Details
          </summary>
          <div style={{ padding: "8px", background: "var(--surface)", borderRadius: "4px", marginTop: "4px" }}>
            {(!!result.request) && (
              <div style={{ marginBottom: "8px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>Request</div>
                <pre style={{ margin: 0, fontSize: "11px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", color: "var(--ink)" }}>
                  {JSON.stringify(result.request as Record<string, unknown>, null, 2)}
                </pre>
              </div>
            )}
            {(!!result.response) && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "4px" }}>Response</div>
                <pre style={{ margin: 0, fontSize: "11px", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace", color: "var(--ink)" }}>
                  {JSON.stringify(result.response as Record<string, unknown>, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

export function ResultsPage({ activeProjectId }: ResultsPageProps) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryRunId, setRetryRunId] = useState<string | null>(null);

  // Check URL hash for runId parameter and reload when hash changes
  useEffect(() => {
    if (!activeProjectId) {
      setRun(null);
      return;
    }

    let ignore = false;

    function loadFromHash() {
      const hash = window.location.hash;
      const searchStr = hash.includes("?") ? hash.substring(hash.indexOf("?")) : "";
      const params = new URLSearchParams(searchStr);
      const runId = params.get("runId");
      if (!runId) return;

      setLoading(true);
      setError("");
      setRetryRunId(runId);

      getRun(String(activeProjectId), String(runId))
        .then((r) => {
          if (!ignore) setRun(r);
        })
        .catch((err) => {
          if (!ignore) setError(err instanceof Error ? err.message : "Failed to load run");
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }

    loadFromHash();

    const onHashChange = () => {
      loadFromHash();
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      ignore = true;
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [activeProjectId]);

  const handleRetry = async () => {
    if (!activeProjectId || !retryRunId) return;
    setLoading(true);
    setError("");
    try {
      const r = await getRun(activeProjectId, String(retryRunId));
      setRun(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    if (!run) return;
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test-run-${run.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printStyles = `
    @media print {
      body * {
        visibility: hidden;
      }
      .print-area, .print-area * {
        visibility: visible;
      }
      .print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
  `;

  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ marginBottom: "20px" }}>Results</h2>
        <p style={{ color: "var(--muted)" }}>Select a project to view results.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
        <p style={{ color: "var(--muted)" }}>Loading test result...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ marginBottom: "20px" }}>Results</h2>
        <div style={{
          padding: "10px 12px",
          background: "var(--red-soft)",
          border: "1px solid var(--red)",
          borderRadius: "6px",
          fontSize: "13px",
          color: "var(--red-deep)",
          marginBottom: "12px",
        }}>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>Could not load this result.</div>
          <div>{error}</div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={handleRetry}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--red-deep)",
              background: "var(--surface)",
              border: "1px solid var(--red)",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => { window.location.hash = "#workspace"; }}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--ink)",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ marginBottom: "20px" }}>Results</h2>
        <p style={{ color: "var(--muted)" }}>
          No run selected. Execute a test in the Workspace, then view its results here.
        </p>
      </div>
    );
  }

  const total = run.results.length;
  const passed = run.results.filter(r => r.status === "passed").length;
  const failed = run.results.filter(r => r.status === "failed").length;
  const blocked = run.results.filter(r => r.status === "blocked").length;
  const isSuccess = run.status === "passed";

  return (
    <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
      <style>{printStyles}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }} className="no-print">
        <h2 style={{ margin: 0 }}>Results</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => { window.location.hash = "#workspace"; }}
            style={{
              padding: "6px 12px", fontSize: "13px", fontWeight: 600,
              border: "1px solid var(--line)", borderRadius: "6px",
              background: "var(--surface)", color: "var(--ink)", cursor: "pointer"
            }}
          >
            Back to Workspace
          </button>
          <button
            type="button"
            onClick={() => { window.location.hash = "#history"; }}
            style={{
              padding: "6px 12px", fontSize: "13px", fontWeight: 600,
              border: "1px solid var(--line)", borderRadius: "6px",
              background: "var(--surface)", color: "var(--ink)", cursor: "pointer"
            }}
          >
            Run History
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: "6px 12px", fontSize: "13px", fontWeight: 600,
              border: "1px solid var(--line)", borderRadius: "6px",
              background: "var(--surface)", color: "var(--ink)", cursor: "pointer"
            }}
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadJson}
            style={{
              padding: "6px 12px", fontSize: "13px", fontWeight: 600,
              border: "1px solid var(--line)", borderRadius: "6px",
              background: "var(--surface)", color: "var(--ink)", cursor: "pointer"
            }}
          >
            Download JSON
          </button>
        </div>
      </div>

      <div className="print-area">
      {/* Overall result */}
        <div style={{
        padding: "14px 16px",
        border: `2px solid ${isSuccess ? "var(--green)" : "var(--red)"}`,
        borderRadius: "8px",
        background: isSuccess ? "var(--green-soft)" : "var(--red-soft)",
        marginBottom: "14px",
      }}>
        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)", marginBottom: "6px" }}>
          {run.title}
        </div>
        {run.description && (
          <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px" }}>
            {run.description}
          </div>
        )}
        <div style={{
          fontSize: "24px",
          fontWeight: 800,
          color: isSuccess ? "var(--green-deep)" : "var(--red-deep)",
          marginBottom: "4px",
        }}>
          {isSuccess ? "PASSED" : "FAILED"}
        </div>
        <div style={{ fontSize: "13px", color: "var(--muted)" }}>
          {total} step{total !== 1 ? "s" : ""} · {passed} passed · {failed} failed · {blocked} blocked
        </div>
        <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
          Duration: {formatDuration(run.durationMs)} · {formatDateTime(run.completedAt)}
        </div>
        {run.targetOperation?.serviceId && (
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
            Target: {run.targetOperation.serviceId}::{run.targetOperation.operationId}
          </div>
        )}
      </div>

      {/* Execution flow */}
      {run.executionPlanSummary && run.executionPlanSummary.stepCount > 1 && (
        <div style={{
          padding: "10px 12px",
          background: "var(--surface-alt)",
          borderRadius: "6px",
          border: "1px solid var(--line)",
          marginBottom: "14px",
        }}>
          <div style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--muted)",
            marginBottom: "8px",
            textTransform: "uppercase",
          }}>
            Execution Flow ({run.executionPlanSummary.stepCount} steps)
          </div>
          {run.executionPlanSummary.operations.map((op, idx) => {
            const isTarget = idx === run.executionPlanSummary.operations.length - 1;
            const resultForStep = run.results[idx];
            const stepStatus = resultForStep?.status || "unknown";
            const statusIcon = stepStatus === "passed" ? "✓" : stepStatus === "failed" ? "✕" : stepStatus === "blocked" ? "⊘" : "?";

            return (
              <div key={idx} style={{ marginBottom: idx < run.executionPlanSummary.operations.length - 1 ? "4px" : 0 }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 8px",
                  background: isTarget ? "var(--violet-soft)" : "var(--surface)",
                  border: `1px solid ${isTarget ? "var(--violet)" : "var(--line)"}`,
                  borderRadius: "4px",
                  fontSize: "12px",
                }}>
                  <span style={{
                    width: "20px",
                    height: "20px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#fff",
                    background: stepStatus === "passed" ? "var(--green)" : stepStatus === "failed" ? "var(--red)" : "var(--muted)",
                  }}>
                    {statusIcon}
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                    {op.serviceId}::{op.operationId}
                  </span>
                  <span style={{ color: "var(--muted)", fontFamily: "monospace", fontSize: "11px" }}>
                    {op.method} {op.path}
                  </span>
                  {isTarget && (
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--violet)" }}>TARGET</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Step details */}
      <div style={{ marginBottom: "12px" }}>
        <h3 style={{
          margin: "0 0 8px 0",
          fontSize: "13px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "var(--muted)",
        }}>
          Step Details
        </h3>
        {run.results.map((r, idx) => renderStepResult(r, idx))}
      </div>
      </div>
    </div>
  );
}
