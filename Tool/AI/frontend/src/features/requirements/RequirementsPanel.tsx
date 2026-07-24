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
  const [isExpanded, setIsExpanded] = useState(false);

  const handleJiraRequirementConfirmed = (requirement: JiraRequirement) => {
    onActiveRequirementChange({ source: "jira", requirement });
    setIsExpanded(false);
  };

  const handleManualRequirementConfirmed = (requirement: ManualRequirement) => {
    onActiveRequirementChange({ source: "manual", requirement });
    setIsExpanded(false);
  };

  const isConfigured = Boolean(activeRequirement && activeRequirement.requirement);

  const requirement = activeRequirement?.requirement;
  const acCount = Array.isArray(requirement?.acceptanceCriteria) ? requirement.acceptanceCriteria.length : 0;

  return (
    <section className="panel span-12 panel-requirements" data-view-section="workspace">
      <div className="panel-head" onClick={() => setIsExpanded(!isExpanded)} style={{
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
          <span className="step-indicator requirements">1</span>
          <div>
            <h2 style={{ margin: 0, fontSize: "17px", color: "var(--violet)" }}>Requirement</h2>
            {isConfigured && (
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {requirement?.key || requirement?.summary || "Loaded"}
                {acCount > 0 && ` · ${acCount} acceptance criteria`}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {isConfigured && (
            <span className="status-badge loaded">Ready</span>
          )}
          <button
            type="button"
            className="expand-toggle"
            aria-label="Toggle section"
            title={isExpanded ? "Collapse" : "Expand"}
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
            {isExpanded ? "−" : "+"}
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="panel-body">
          {!isConfigured ? (
            <>
              <RequirementSourceTabs source={source} onSourceChange={setSource} />
              <div style={{ marginTop: "12px", display: source === "jira" ? "block" : "none" }}>
                <JiraRequirementForm onRequirementConfirmed={handleJiraRequirementConfirmed} />
              </div>
              <div style={{ marginTop: "12px", display: source === "manual" ? "block" : "none" }}>
                <ManualRequirementForm onRequirementConfirmed={handleManualRequirementConfirmed} />
              </div>
            </>
          ) : (
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsExpanded(true)}
              >
                Edit Requirement
              </button>
              <span style={{ fontSize: "12px", color: "var(--muted)", alignSelf: "center" }}>
                Generate tests from this requirement to continue.
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
