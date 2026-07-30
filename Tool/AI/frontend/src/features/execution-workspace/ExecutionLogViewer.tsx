/**
 * ExecutionLogViewer
 *
 * Displays execution logs for a run.
 */

import type { ExecutionRun } from "./ExecutionWorkspaceService";

interface ExecutionLogViewerProps {
  run: ExecutionRun | null;
}

export function ExecutionLogViewer({ run }: ExecutionLogViewerProps) {
  const logs = run?.logs || [];

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
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
          Execution Log
        </h2>
        <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
          {logs.length} {logs.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div
        style={{
          padding: "12px",
          maxHeight: "320px",
          overflow: "auto",
          fontFamily: "monospace",
          fontSize: "12px",
          lineHeight: 1.5,
          backgroundColor: "var(--color-bg-subtle)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        {logs.length === 0 ? (
          <div style={{ padding: "16px", color: "var(--color-text-muted)", textAlign: "center" }}>
            No logs available. Execute the run to generate logs.
          </div>
        ) : (
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", padding: "8px" }}>
            {logs.map((log, i) => (
              <div key={i} style={{ marginBottom: "4px", color: "var(--color-text-secondary)" }}>
                <span style={{ color: "var(--color-text-muted)" }}>[{i + 1}]</span> {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
