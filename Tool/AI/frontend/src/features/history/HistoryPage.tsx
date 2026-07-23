/**
 * HistoryPage
 *
 * STEP 5.8 — Project-scoped run history for the active TestCase-first workflow.
 *
 * Shows newest runs first.
 * Clicking a run navigates to Results page with runId in URL.
 */

import { useState, useEffect } from "react";
import { listRuns, type RunSummary } from "../runs/RunService";

interface HistoryPageProps {
  activeProjectId: string | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Today, ${timeStr}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeStr}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + `, ${timeStr}`;
}

function renderRunRow(run: RunSummary) {
  const isPassed = run.status === "passed";
  const targetStr = run.targetServiceId && run.targetOperationId
    ? `${run.targetServiceId}::${run.targetOperationId}`
    : "";

  const handleClick = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("runId", run.id);
    window.location.href = `#results?runId=${encodeURIComponent(run.id)}`;
    // Trigger a navigation by changing the hash
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  return (
    <div
      key={run.id}
      onClick={handleClick}
      style={{
        padding: "12px 14px",
        border: `1px solid ${isPassed ? "var(--green)" : "var(--red)"}`,
        borderRadius: "8px",
        background: isPassed ? "var(--green-soft)" : "var(--red-soft)",
        cursor: "pointer",
        marginBottom: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{
          width: "36px",
          height: "36px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: 800,
          color: "#fff",
          background: isPassed ? "var(--green)" : "var(--red)",
          flexShrink: 0,
        }}>
          {isPassed ? "P" : "F"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "2px" }}>
            {run.title}
          </div>
          {targetStr && (
            <div style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "monospace", marginBottom: "2px" }}>
              {targetStr}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "4px" }}>
            <span style={{
              fontSize: "12px",
              fontWeight: 700,
              color: isPassed ? "var(--green-deep)" : "var(--red-deep)",
            }}>
              {run.passedSteps}/{run.stepCount} steps passed
            </span>
            {run.failedSteps > 0 && (
              <span style={{ fontSize: "12px", color: "var(--red-deep)" }}>
                {run.failedSteps} failed
              </span>
            )}
            {run.blockedSteps > 0 && (
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {run.blockedSteps} blocked
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            {formatDateTime(run.completedAt || run.startedAt)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
            {formatDuration(run.durationMs)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryPage({ activeProjectId }: HistoryPageProps) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeProjectId) {
      setRuns([]);
      return;
    }

    setLoading(true);
    setError("");

    listRuns(activeProjectId)
      .then(setRuns)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load history"))
      .finally(() => setLoading(false));
  }, [activeProjectId]);

  if (!activeProjectId) {
    return (
      <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ marginBottom: "20px" }}>Run History</h2>
        <p style={{ color: "var(--muted)" }}>Select a project to view run history.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
        <p style={{ color: "var(--muted)" }}>Loading run history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ marginBottom: "20px" }}>Run History</h2>
        <div style={{
          padding: "10px 12px",
          background: "var(--red-soft)",
          border: "1px solid var(--red)",
          borderRadius: "6px",
          fontSize: "13px",
          color: "var(--red-deep)",
        }}>
          {error}
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
        <h2 style={{ marginBottom: "20px" }}>Run History</h2>
        <p style={{ color: "var(--muted)" }}>
          No test runs yet for this project. Execute a test in the Workspace to see results here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "22px", maxWidth: "800px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "20px" }}>Run History</h2>
      <div style={{ marginBottom: "12px", fontSize: "13px", color: "var(--muted)" }}>
        {runs.length} run{runs.length !== 1 ? "s" : ""} for project "{activeProjectId}"
      </div>
      {runs.map(renderRunRow)}
    </div>
  );
}