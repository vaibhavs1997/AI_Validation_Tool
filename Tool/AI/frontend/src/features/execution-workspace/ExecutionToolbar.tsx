/**
 * ExecutionToolbar
 *
 * Action toolbar with Run, Dry Run, Cancel, and Rebuild Plan buttons.
 */

import type { ExecutionRun } from "./ExecutionWorkspaceService";

interface ExecutionToolbarProps {
  run: ExecutionRun | null;
  canRun: boolean;
  canDryRun: boolean;
  canCancel: boolean;
  canRebuild: boolean;
  onRun: () => void;
  onDryRun: () => void;
  onCancel: () => void;
  onRebuild: () => void;
  loading: boolean;
  loadingAction: string | null;
}

export function ExecutionToolbar({
  run,
  canRun,
  canDryRun,
  canCancel,
  canRebuild,
  onRun,
  onDryRun,
  onCancel,
  onRebuild,
  loading,
  loadingAction,
}: ExecutionToolbarProps) {
  const isRunning = run?.status === "running";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        alignItems: "center",
        padding: "16px 20px",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-bg-surface)",
      }}
      role="toolbar"
      aria-label="Execution actions"
    >
      {/* Primary Actions */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun || loading || isRunning}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#fff",
            background: canRun && !loading && !isRunning ? "var(--color-success)" : "var(--color-border)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: canRun && !loading && !isRunning ? "pointer" : "not-allowed",
            opacity: canRun && !loading && !isRunning ? 1 : 0.7,
            minWidth: "80px",
          }}
          aria-label="Run execution"
        >
          {loadingAction === "execute" ? "Running…" : "Run"}
        </button>

        <button
          type="button"
          onClick={onDryRun}
          disabled={!canDryRun || loading || isRunning}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#fff",
            background: canDryRun && !loading && !isRunning ? "var(--color-info)" : "var(--color-border)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: canDryRun && !loading && !isRunning ? "pointer" : "not-allowed",
            opacity: canDryRun && !loading && !isRunning ? 1 : 0.7,
            minWidth: "80px",
          }}
          aria-label="Dry run execution"
        >
          {loadingAction === "dry-run" ? "Dry Running…" : "Dry Run"}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={!canCancel || loading}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#fff",
            background: canCancel && !loading ? "var(--color-warning)" : "var(--color-border)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: canCancel && !loading ? "pointer" : "not-allowed",
            opacity: canCancel && !loading ? 1 : 0.7,
            minWidth: "80px",
          }}
          aria-label="Cancel execution"
        >
          {loadingAction === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
      </div>

      {/* Secondary Actions */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginLeft: "auto" }}>
        <button
          type="button"
          onClick={onRebuild}
          disabled={!canRebuild || loading}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            cursor: canRebuild && !loading ? "pointer" : "not-allowed",
            opacity: canRebuild && !loading ? 1 : 0.7,
          }}
          aria-label="Rebuild execution plan"
        >
          {loadingAction === "rebuild-plan" ? "Rebuilding…" : "Rebuild Plan"}
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div
        style={{
          fontSize: "11px",
          color: "var(--color-text-muted)",
          whiteSpace: "nowrap",
          marginLeft: "auto",
        }}
        aria-hidden="true"
      >
        Shortcuts: Run (R), Dry Run (D), Cancel (Esc), Rebuild (B)
      </div>
    </div>
  );
}
