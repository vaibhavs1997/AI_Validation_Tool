/**
 * MappingCard
 *
 * Displays a single implementation mapping in the library view.
 */

import type { ImplementationMapping } from "./ImplementationMappingService";

interface MappingCardProps {
  mapping: ImplementationMapping;
  selected?: boolean;
  onSelect?: (mapping: ImplementationMapping) => void;
  onEdit?: (mapping: ImplementationMapping) => void;
  onDelete?: (mapping: ImplementationMapping) => void;
}

export function MappingCard({ mapping, selected, onSelect, onEdit, onDelete }: MappingCardProps) {
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
      onClick={() => onSelect?.(mapping)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
          {mapping.title}
        </h3>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "2px 8px",
            borderRadius: "var(--radius-pill)",
            background: "var(--color-info-soft)",
            color: "var(--color-info)",
            flexShrink: 0,
          }}
        >
          {mapping.executionOrder}
        </span>
      </div>

      {mapping.description && (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          {mapping.description}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "11px", color: "var(--color-text-muted)" }}>
        <span>Confidence: {Math.round(mapping.confidence * 100)}%</span>
        <span>•</span>
        <span>Status: {mapping.status}</span>
        <span>•</span>
        <span>APIs: {mapping.candidateApis.length}</span>
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit?.(mapping); }}
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
          onClick={(e) => { e.stopPropagation(); onDelete?.(mapping); }}
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