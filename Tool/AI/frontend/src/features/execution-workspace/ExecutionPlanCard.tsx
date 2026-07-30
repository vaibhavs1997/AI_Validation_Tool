/**
 * ExecutionPlanCard
 *
 * Displays the execution plan: execution order, dependencies, variables,
 * authentication, warnings, and estimated steps.
 */

import type { ExecutionPlan, ExecutionStep } from "./ExecutionWorkspaceService";

interface ExecutionPlanCardProps {
  plan: ExecutionPlan | null;
  onBuildPlan: () => void;
  onRebuildPlan: () => void;
  building: boolean;
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

function StatusBadge({ status }: { status: string }) {
  const bg = statusColors[status] || "var(--color-text-muted)";
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "2px 8px",
        borderRadius: "10px",
        background: `${bg}20`,
        color: bg,
        border: `1px solid ${bg}40`,
      }}
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  );
}

export function ExecutionPlanCard({ plan, onBuildPlan, onRebuildPlan, building }: ExecutionPlanCardProps) {
  if (!plan) {
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
            Execution Plan
          </h2>
          <button
            type="button"
            onClick={onBuildPlan}
            disabled={building}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              background: building ? "var(--color-border)" : "var(--color-primary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: building ? "not-allowed" : "pointer",
            }}
            aria-label="Build execution plan"
          >
            {building ? "Building…" : "Build Plan"}
          </button>
        </div>
        <div style={{ padding: "32px 24px", textAlign: "center", background: "var(--color-bg-subtle)" }}>
          <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            No execution plan yet.
          </p>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>
            Build a plan from approved executable tests to see the execution order.
          </p>
        </div>
      </section>
    );
  }

  const { steps, executionOrder, warnings, variables, authentication, environment, estimatedSteps, dependencies } = plan;

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
          Execution Plan
        </h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={onRebuildPlan}
            disabled={building}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              cursor: building ? "not-allowed" : "pointer",
            }}
            aria-label="Rebuild execution plan"
          >
            {building ? "Rebuilding…" : "Rebuild Plan"}
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        {/* Preview: Estimated Steps, Warnings */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
          <div
            style={{
              padding: "12px 16px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg-subtle)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "2px" }}>
              Estimated Steps
            </div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--color-text-primary)" }}>
              {estimatedSteps}
            </div>
          </div>
          <div
            style={{
              padding: "12px 16px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg-subtle)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "2px" }}>
              Total Steps
            </div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--color-text-primary)" }}>
              {steps.length}
            </div>
          </div>
          <div
            style={{
              padding: "12px 16px",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg-subtle)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "2px" }}>
              Warnings
            </div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: warnings.length > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
              {warnings.length}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
              Warnings
            </h3>
            <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Execution Order */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            Execution Order
          </h3>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              alignItems: "center",
              fontSize: "12px",
              color: "var(--color-text-secondary)",
            }}
          >
            {executionOrder.map((stepId, idx) => {
              const step = steps.find((s) => s.id === stepId || s.testId === stepId);
              const label = step ? step.title : stepId;
              return (
                <span key={stepId} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{idx + 1}.</span>
                  <span>{label}</span>
                  {idx < executionOrder.length - 1 && <span style={{ color: "var(--color-text-muted)" }}>→</span>}
                </span>
              );
            })}
          </div>
        </div>

        {/* Variables */}
        {Object.keys(variables).length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
              Variables
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: "12px" }}>
              {Object.entries(variables).map(([key, value]) => (
                <>
                  <span style={{ color: "var(--color-text-muted)" }}>{key}</span>
                  <span style={{ color: "var(--color-text-secondary)", fontFamily: "monospace", wordBreak: "break-all" }}>{value}</span>
                </>
              ))}
            </div>
          </div>
        )}

        {/* Authentication */}
        {Object.keys(authentication).length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
              Authentication
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: "12px" }}>
              {Object.entries(authentication).map(([key, value]) => (
                <>
                  <span style={{ color: "var(--color-text-muted)" }}>{key}</span>
                  <span style={{ color: "var(--color-text-secondary)", fontFamily: "monospace", wordBreak: "break-all" }}>
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                </>
              ))}
            </div>
          </div>
        )}

        {/* Environment */}
        {environment && Object.keys(environment).length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
              Environment
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: "12px" }}>
              {Object.entries(environment).map(([key, value]) => (
                <>
                  <span style={{ color: "var(--color-text-muted)" }}>{key}</span>
                  <span style={{ color: "var(--color-text-secondary)", fontFamily: "monospace", wordBreak: "break-all" }}>
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                </>
              ))}
            </div>
          </div>
        )}

        {/* Steps Table */}
        <div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            Steps ({steps.length})
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>#</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>Title</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>Dependencies</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step: ExecutionStep) => (
                  <tr key={step.id}>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}>{step.order}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}>{step.title}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}>
                      {step.dependencies.length > 0 ? step.dependencies.join(", ") : "—"}
                    </td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--color-border)" }}>
                      <StatusBadge status={step.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dependencies Graph (text-based) */}
        {Object.keys(dependencies).length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
              Dependency Graph
            </h3>
            <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              {Object.entries(dependencies).map(([stepId, deps]) => (
                <div key={stepId} style={{ marginBottom: "4px" }}>
                  <strong style={{ color: "var(--color-text-primary)" }}>{stepId}</strong>
                  {deps.length > 0 ? ` → depends on: ${deps.join(", ")}` : " (no dependencies)"}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
