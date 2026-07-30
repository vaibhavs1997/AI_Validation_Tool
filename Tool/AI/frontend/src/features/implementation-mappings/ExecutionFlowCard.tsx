/**
 * ExecutionFlowCard
 *
 * Visualizes the execution order for an implementation mapping.
 */

interface ExecutionFlowCardProps {
  executionFlow: Array<{
    step: number;
    description: string;
    operationRef?: {
      serviceId?: string;
      operationId?: string;
    };
  }>;
  executionOrder: "sequential" | "parallel";
}

export function ExecutionFlowCard({ executionFlow, executionOrder }: ExecutionFlowCardProps) {
  const sorted = [...executionFlow].sort((a, b) => a.step - b.step);

  return (
    <div style={{ padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
      <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>Execution Flow</h3>
      <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px" }}>
        Order: <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{executionOrder}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {sorted.map((step, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--color-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>
              {step.step}
            </div>
            <div style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-subtle)" }}>
              <div style={{ fontSize: "13px", color: "var(--color-text-primary)", lineHeight: 1.4 }}>{step.description}</div>
              {step.operationRef && (
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
                  {step.operationRef.serviceId && <span>Service: {step.operationRef.serviceId}</span>}
                  {step.operationRef.serviceId && step.operationRef.operationId && <span> • </span>}
                  {step.operationRef.operationId && <span>Operation: {step.operationRef.operationId}</span>}
                </div>
              )}
            </div>
            {idx < sorted.length - 1 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "var(--color-text-muted)", fontSize: "12px" }}>
                ↓
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}