/**
 * ExecutionTimeline
 *
 * Displays the execution timeline with steps showing Running, Passed,
 * Failed, Blocked, and Skipped statuses.
 */

import type { ExecutionRun, ExecutionStep, ExecutionStatus } from "./ExecutionWorkspaceService";

interface ExecutionTimelineProps {
  run: ExecutionRun | null;
}

const statusColors: Record<string, string> = {
  pending: "var(--color-text-muted)",
  planned: "var(--color-info)",
  running: "var(--color-primary)",
  passed: "var(--color-success)",
  failed: "var(--color-error)",
  blocked: "var(--color-error)",
  skipped: "var(--color-text-muted)",
  cancelled: "var(--color-text-muted)",
  completed: "var(--color-success)",
};

const statusIcons: Record<string, string> = {
  pending: "○",
  planned: "◯",
  running: "◐",
  passed: "✓",
  failed: "✗",
  blocked: "⛔",
  skipped: "⊘",
  cancelled: "⭕",
  completed: "✓",
};

function formatTime(ms?: number): string {
  if (ms === undefined || ms === 0) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export function ExecutionTimeline({ run }: ExecutionTimelineProps) {
  if (!run || !run.steps || run.steps.length === 0) {
    return (
      <section
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-bg-surface)",
          overflow: "hidden",
          marginBottom: "24px",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            Execution Timeline
          </h2>
        </div>
        <div style={{ padding: "32px 24px", textAlign: "center", background: "var(--color-bg-subtle)" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>
            No steps to display. Build a plan to see the execution timeline.
          </p>
        </div>
      </section>
    );
  }

  const steps = run.steps;
  const statusCounts = steps.reduce(
    (acc, step) => {
      acc[step.status] = (acc[step.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const statusLabels: Record<ExecutionStatus, string> = {
    pending: "Pending",
    planned: "Planned",
    running: "Running",
    passed: "Passed",
    failed: "Failed",
    blocked: "Blocked",
    skipped: "Skipped",
    cancelled: "Cancelled",
    completed: "Completed",
  };

  return (
    <section
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-bg-surface)",
        overflow: "hidden",
        marginBottom: "24px",
      }}
    >
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
        <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
          Execution Timeline
        </h2>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
          {steps.length} steps • {statusCounts.running || 0} running • {statusCounts.passed || 0} passed • {statusCounts.failed || 0} failed • {statusCounts.blocked || 0} blocked • {statusCounts.skipped || 0} skipped
        </p>
      </div>

      <div style={{ padding: "16px 20px" }}>
        {/* Status Summary */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
          {(["running", "passed", "failed", "blocked", "skipped", "pending", "planned", "completed", "cancelled"] as ExecutionStatus[]).map(
            (status) => {
              const count = statusCounts[status] || 0;
              if (count === 0) return null;
              const color = statusColors[status] || "var(--color-text-muted)";
              return (
                <div
                  key={status}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-bg-subtle)",
                  }}
                >
                  <span style={{ fontSize: "14px" }}>{statusIcons[status] || "○"}</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color }}>{statusLabels[status]}:</span>
                  <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{count}</span>
                </div>
              );
            }
          )}
        </div>

        {/* Timeline */}
        <div style={{ position: "relative", paddingLeft: "24px" }}>
          {/* Vertical line */}
          <div
            style={{
              position: "absolute",
              left: "8px",
              top: "0",
              bottom: "0",
              width: "2px",
              background: "var(--color-border)",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {steps.map((step: ExecutionStep) => {
              const color = statusColors[step.status] || "var(--color-text-muted)";
              const icon = statusIcons[step.status] || "○";
              return (
                <div key={step.id} style={{ position: "relative" }}>
                  {/* Node */}
                  <div
                    style={{
                      position: "absolute",
                      left: "-16px",
                      top: "2px",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#fff",
                      border: "2px solid var(--color-bg-surface)",
                      boxShadow: "0 0 0 2px var(--color-border)",
                    }}
                    aria-label={`Step ${step.order}: ${step.status}`}
                  >
                    {icon}
                  </div>

                  {/* Content */}
                  <div
                    style={{
                      padding: "12px 16px",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      background: step.status === "running" ? "var(--color-bg-subtle)" : "var(--color-bg-surface)",
                      marginLeft: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "6px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "2px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "var(--color-text-muted)",
                              minWidth: "24px",
                            }}
                          >
                            #{step.order}
                          </span>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "var(--color-text-primary)",
                            }}
                          >
                            {step.title}
                          </span>
                        </div>
                        {step.description && (
                          <p
                            style={{
                              margin: "2px 0 0 0",
                              fontSize: "12px",
                              color: "var(--color-text-secondary)",
                              lineHeight: 1.4,
                            }}
                          >
                            {step.description}
                          </p>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          padding: "2px 8px",
                          borderRadius: "10px",
                          background: `${color}20`,
                          color: color,
                          border: `1px solid ${color}40`,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                        aria-label={`Status: ${step.status}`}
                      >
                        {step.status}
                      </span>
                    </div>

                    {/* Timing */}
                    {(step.executionTime || step.startedAt || step.completedAt) && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--color-text-muted)",
                          display: "flex",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        {step.startedAt && <span>Started: {formatDate(step.startedAt)}</span>}
                        {step.completedAt && <span>Completed: {formatDate(step.completedAt)}</span>}
                        {step.executionTime && <span>Duration: {formatTime(step.executionTime)}</span>}
                      </div>
                    )}

                    {/* Error */}
                    {step.error && (
                      <div
                        style={{
                          marginTop: "6px",
                          padding: "6px 8px",
                          fontSize: "11px",
                          color: "var(--color-error)",
                          background: "var(--color-error-bg)",
                          border: "1px solid var(--color-error-border)",
                          borderRadius: "var(--radius-sm)",
                          fontFamily: "monospace",
                          wordBreak: "break-all",
                        }}
                      >
                        {step.error}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
