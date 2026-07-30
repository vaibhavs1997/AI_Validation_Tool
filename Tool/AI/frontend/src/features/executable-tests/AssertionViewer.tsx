/**
 * AssertionViewer
 *
 * Displays a list of assertions for a generated test.
 */

interface Assertion {
  type: string;
  field?: string;
  expected?: any;
  operator?: string;
}

interface AssertionViewerProps {
  assertions: Assertion[];
}

export function AssertionViewer({ assertions }: AssertionViewerProps) {
  if (!assertions.length) return null;

  return (
    <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)" }}>Assertions</div>
      {assertions.map((a, idx) => (
        <div key={idx} style={{ fontSize: "12px", color: "var(--color-text-secondary)", background: "var(--color-bg-subtle)", padding: "8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
          <strong>{a.type}</strong>
          {a.field && <span> on <code>{a.field}</code></span>}
          {a.operator && <span> {a.operator}</span>}
          {a.expected !== undefined && <span> {JSON.stringify(a.expected)}</span>}
        </div>
      ))}
    </div>
  );
}