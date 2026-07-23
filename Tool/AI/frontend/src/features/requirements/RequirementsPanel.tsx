import { useState } from "react";
import type { JiraRequirement, ManualRequirement, ActiveRequirement } from "./RequirementTypes";
import { RequirementSourceTabs } from "./RequirementSourceTabs";
import { JiraRequirementForm } from "./JiraRequirementForm";
import { ManualRequirementForm } from "./ManualRequirementForm";

interface RequirementsPanelProps {
  activeRequirement: ActiveRequirement | null;
  onActiveRequirementChange: (requirement: ActiveRequirement) => void;
}

export function RequirementsPanel({ activeRequirement, onActiveRequirementChange }: RequirementsPanelProps) {
  const [source, setSource] = useState<"jira" | "manual">("jira");

  const handleJiraRequirementConfirmed = (requirement: JiraRequirement) => {
    onActiveRequirementChange({ source: "jira", requirement });
  };

  const handleManualRequirementConfirmed = (requirement: ManualRequirement) => {
    onActiveRequirementChange({ source: "manual", requirement });
  };

  // Status follows activeRequirement, NOT the selected tab
  const statusText = activeRequirement && activeRequirement.requirement ? "Configured" : "Not configured";
  const statusColor = activeRequirement && activeRequirement.requirement ? "var(--green)" : "var(--muted)";

  return (
    <section className="panel span-12 panel-requirements" data-view-section="workspace">
      <div className="panel-head" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        padding: "12px 16px",
        borderBottom: "1px solid var(--line)",
        background: "var(--violet-soft)",
        cursor: "pointer"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="step" style={{
            width: "30px",
            height: "30px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "8px",
            fontWeight: 800,
            background: "var(--violet)",
            color: "#fff"
          }}>
            [1]
          </span>
          <h2 style={{ margin: 0, fontSize: "17px", color: "var(--violet)" }}>
            Requirements
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="step-status" style={{
            fontSize: "12px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: statusColor
          }}>
            {statusText}
          </span>
          <button
            type="button"
            className="expand-toggle"
            aria-label="Toggle section"
            title="Collapse/Expand"
            style={{
              width: "28px",
              height: "28px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--line)",
              borderRadius: "50%",
              background: "var(--surface)",
              color: "var(--muted)",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            −
          </button>
        </div>
      </div>
      <div className="panel-body" style={{ padding: "18px" }}>
        <RequirementSourceTabs source={source} onSourceChange={setSource} />
        {/* Both forms mounted to preserve independent state per tab */}
        <div style={{ display: source === "jira" ? "block" : "none" }}>
          <JiraRequirementForm onRequirementConfirmed={handleJiraRequirementConfirmed} />
        </div>
        <div style={{ display: source === "manual" ? "block" : "none" }}>
          <ManualRequirementForm onRequirementConfirmed={handleManualRequirementConfirmed} />
        </div>
      </div>
    </section>
  );
}