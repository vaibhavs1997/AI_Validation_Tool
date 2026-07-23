import type { RequirementSource } from "./RequirementTypes";

interface RequirementSourceTabsProps {
  source: RequirementSource;
  onSourceChange: (source: RequirementSource) => void;
}

export function RequirementSourceTabs({ source, onSourceChange }: RequirementSourceTabsProps) {
  return (
    <div className="source-selector" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
      <label style={{ fontSize: "12px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
        Source
      </label>
      <div className="source-options" style={{ display: "flex", gap: "4px", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden" }}>
        <span
          className={`source-chip ${source === "jira" ? "active" : ""}`}
          data-source="jira"
          onClick={() => onSourceChange("jira")}
          style={{
            padding: "6px 14px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            color: source === "jira" ? "#fff" : "var(--muted)",
            background: source === "jira" ? "var(--violet)" : "var(--surface)"
          }}
        >
          Jira
        </span>
        <span
          className={`source-chip ${source === "manual" ? "active" : ""}`}
          data-source="manual"
          onClick={() => onSourceChange("manual")}
          style={{
            padding: "6px 14px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            color: source === "manual" ? "#fff" : "var(--muted)",
            background: source === "manual" ? "var(--violet)" : "var(--surface)"
          }}
        >
          Manual
        </span>
      </div>
    </div>
  );
}