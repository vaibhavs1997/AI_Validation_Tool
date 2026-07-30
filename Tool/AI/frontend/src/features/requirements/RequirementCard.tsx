/**
 * RequirementCard
 *
 * Displays a single requirement as a card in the Requirement Library.
 * Shows: ID, title, short description, status, created date, updated date.
 */

import type { Requirement } from "./RequirementService";

interface RequirementCardProps {
  requirement: Requirement;
  selected: boolean;
  onSelect: (req: Requirement) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "var(--color-text-muted)", bg: "var(--color-bg-muted)" },
  "needs-review": { label: "Needs Review", color: "var(--color-warning)", bg: "var(--color-warning-soft)" },
  ready: { label: "Ready", color: "var(--color-success)", bg: "var(--color-success-soft)" },
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function truncate(text: string, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function RequirementCard({ requirement, selected, onSelect }: RequirementCardProps) {
  const status = (STATUS_CONFIG[requirement.status] || STATUS_CONFIG.draft) as { label: string; color: string; bg: string };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(requirement)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(requirement);
        }
      }}
      style={{
        padding: "16px",
        border: `1px solid ${selected ? "var(--color-primary-border)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-md)",
        background: selected ? "var(--color-primary-soft)" : "var(--color-bg-surface)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        transition: "border-color var(--transition-fast), background var(--transition-fast)",
        outline: "none",
      }}
    >
      {/* Top row: ID + Status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{
          fontSize: "11px",
          fontWeight: 700,
          fontFamily: "monospace",
          color: "var(--color-text-muted)",
          letterSpacing: "0.02em",
        }}>
          {requirement.id}
        </span>
        <span style={{
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          padding: "2px 8px",
          borderRadius: "var(--radius-pill)",
          background: status.bg,
          color: status.color,
          flexShrink: 0,
        }}>
          {status.label}
        </span>
      </div>

      {/* Title */}
      <h3 style={{
        margin: 0,
        fontSize: "14px",
        fontWeight: 600,
        color: "var(--color-text-primary)",
        lineHeight: 1.3,
      }}>
        {requirement.title}
      </h3>

      {/* Description */}
      <p style={{
        margin: 0,
        fontSize: "12px",
        color: "var(--color-text-secondary)",
        lineHeight: 1.5,
      }}>
        {truncate(requirement.description, 120)}
      </p>

      {/* Bottom row: Dates */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        fontSize: "11px",
        color: "var(--color-text-muted)",
        marginTop: "auto",
      }}>
        <span>Created: {formatDate(requirement.createdAt)}</span>
        <span>Updated: {formatDate(requirement.updatedAt)}</span>
      </div>
    </div>
  );
}