/**
 * DependencyViewer
 *
 * Displays dependencies for a generated test.
 */

interface DependencyViewerProps {
  dependencies: string[];
}

export function DependencyViewer({ dependencies }: DependencyViewerProps) {
  if (!dependencies.length) return null;

  return (
    <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)" }}>Dependencies</div>
      {dependencies.map((dep, idx) => (
        <div key={idx} style={{ fontSize: "12px", color: "var(--color-text-secondary)", background: "var(--color-bg-subtle)", padding: "8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
          {dep}
        </div>
      ))}
    </div>
  );
}