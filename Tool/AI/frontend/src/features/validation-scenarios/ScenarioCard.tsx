/**
 * ScenarioCard
 *
 * Displays a single validation scenario in the library view.
 */

import type { ValidationScenario } from "./ValidationScenarioService";

interface ScenarioCardProps {
  scenario: ValidationScenario;
  selected?: boolean;
  onSelect?: (scenario: ValidationScenario) => void;
  onEdit?: (scenario: ValidationScenario) => void;
  onDelete?: (scenario: ValidationScenario) => void;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: "var(--color-bg-muted)", text: "var(--color-text-muted)" },
  medium: { bg: "var(--color-info-soft)", text: "var(--color-info)" },
  high: { bg: "var(--color-warning-soft)", text: "var(--color-warning)" },
  critical: { bg: "var(--color-error-soft)", text: "var(--color-error)" },
};

function getPriorityColor(priority: string, type: "bg" | "text"): string {
  const colors = (PRIORITY_COLORS[priority] || PRIORITY_COLORS["medium"]) as { bg: string; text: string };
  return type === "bg" ? colors.bg : colors.text;
}

export function ScenarioCard({ scenario, selected, onSelect, onEdit, onDelete }: ScenarioCardProps) {
  return (
    <div
      style={{
        padding: "16px",
        border: selected ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-bg-surface)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        position: "relative",
        cursor: "pointer",
      }}
      onClick={() => onSelect?.(scenario)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
          {scenario.title}
        </h3>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "2px 8px",
            borderRadius: "var(--radius-pill)",
            background: getPriorityColor(scenario.priority, "bg"),
            color: getPriorityColor(scenario.priority, "text"),
            flexShrink: 0,
          }}
        >
          {scenario.priority}
        </span>
      </div>

      {scenario.description && (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          {scenario.description}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "11px", color: "var(--color-text-muted)" }}>
        <span>Confidence: {Math.round(scenario.confidence * 100)}%</span>
        <span>•</span>
        <span>Status: {scenario.status}</span>
        <span>•</span>
        <span>Source: {scenario.source}</span>
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit?.(scenario); }}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
          }}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete?.(scenario); }}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--color-error-text)",
            background: "var(--color-error-soft)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}