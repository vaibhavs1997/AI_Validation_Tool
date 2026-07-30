/**
 * DependencyTree
 *
 * Displays the dependency tree for execution steps.
 */

import type { ExecutionPlan, ExecutionStep } from "./ExecutionWorkspaceService";

interface DependencyTreeProps {
  plan: ExecutionPlan | null;
}

export function DependencyTree({ plan }: DependencyTreeProps) {
  if (!plan || !plan.steps || plan.steps.length === 0) {
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
            Dependency Tree
          </h2>
        </div>
        <div style={{ padding: "24px", textAlign: "center", background: "var(--color-bg-subtle)" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>
            No dependencies to display. Build a plan to see the dependency tree.
          </p>
        </div>
      </section>
    );
  }

  const steps = plan.steps;

  // Find root steps (no dependencies)
  const rootSteps = steps.filter((s) => s.dependencies.length === 0);

  // Build tree structure
  function buildChildren(step: ExecutionStep): ExecutionStep[] {
    return steps.filter((s) => s.dependencies.includes(step.id) || s.dependencies.includes(step.testId));
  }

  function renderNode(step: ExecutionStep, depth: number) {
    const children = buildChildren(step);
    const hasChildren = children.length > 0;
    const paddingLeft = depth * 20 + 12;

    return (
      <div key={step.id} style={{ marginBottom: "4px" }}>
        <div
          style={{
            paddingLeft: `${paddingLeft}px`,
            padding: "6px 8px",
            fontSize: "12px",
            color: "var(--color-text-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            borderLeft: depth > 0 ? "1px solid var(--color-border)" : "none",
            marginLeft: depth > 0 ? "8px" : "0",
          }}
        >
          {depth > 0 && <span style={{ color: "var(--color-text-muted)", fontSize: "10px" }}>└─</span>}
          <span style={{ fontWeight: depth === 0 ? 600 : 400, color: "var(--color-text-primary)" }}>
            {step.title || step.testId}
          </span>
          <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
            ({step.order})
          </span>
        </div>
        {hasChildren && (
          <div>
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

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
          Dependency Tree
        </h2>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
          {rootSteps.length} root step{rootSteps.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div style={{ padding: "12px" }}>
        {rootSteps.length === 0 ? (
          <div style={{ padding: "16px", color: "var(--color-text-muted)", textAlign: "center" }}>
            No root steps found. All steps have dependencies.
          </div>
        ) : (
          <div>
            {rootSteps.map((root) => renderNode(root, 0))}
          </div>
        )}

        {/* Flat dependency list */}
        <div style={{ marginTop: "16px", borderTop: "1px solid var(--color-border)", paddingTop: "12px" }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            All Dependencies
          </h3>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
            {steps.map((step) => (
              <div key={step.id} style={{ marginBottom: "4px" }}>
                <strong style={{ color: "var(--color-text-primary)" }}>{step.title || step.testId}</strong>
                {step.dependencies.length > 0
                  ? ` → depends on: ${step.dependencies.join(", ")}`
                  : " (no dependencies)"}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}