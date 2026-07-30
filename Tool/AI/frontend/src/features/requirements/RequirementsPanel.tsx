import { useState } from "react";
import type { JiraRequirement, ManualRequirement, ActiveRequirement, RequirementSource } from "./RequirementTypes";
import { RequirementSourceTabs } from "./RequirementSourceTabs";
import { JiraRequirementForm } from "./JiraRequirementForm";
import { ManualRequirementForm } from "./ManualRequirementForm";

interface RequirementsPanelProps {
  activeRequirement: ActiveRequirement | null;
  onActiveRequirementChange: (requirement: ActiveRequirement) => void;
}

export function RequirementsPanel({ activeRequirement, onActiveRequirementChange }: RequirementsPanelProps) {
  const [source, setSource] = useState<RequirementSource>("jira");
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const handleJiraRequirementConfirmed = (requirement: JiraRequirement) => {
    onActiveRequirementChange({ source: "jira", requirement });
    setIsEditing(false);
    setIsExpanded(false);
  };

  const handleManualRequirementConfirmed = (requirement: ManualRequirement) => {
    onActiveRequirementChange({ source: "manual", requirement });
    setIsEditing(false);
    setIsExpanded(false);
  };

  const handleEditClick = () => {
    // Switch the source tab to match the current requirement's source
    if (activeRequirement?.source) {
      setSource(activeRequirement.source);
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const isConfigured = Boolean(activeRequirement && activeRequirement.requirement);
  // Show the input forms when there is no requirement yet, or when the user is editing
  const showForms = !isConfigured || isEditing;

  const requirement = activeRequirement?.requirement;
  const acCount = Array.isArray(requirement?.acceptanceCriteria) ? requirement.acceptanceCriteria.length : 0;

  // Key used to force the forms to remount when entering edit mode so they
  // pick up the initialRequirement pre-fill values.
  const formKey = isEditing ? `edit-${requirement?.key ?? "new"}` : "new";

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
          {showForms ? (
            <>
              <RequirementSourceTabs source={source} onSourceChange={setSource} />
              <div style={{ marginTop: "12px", display: source === "jira" ? "block" : "none" }}>
                <JiraRequirementForm
                  key={`jira-${formKey}`}
                  initialRequirement={isEditing && activeRequirement?.source === "jira" ? (activeRequirement.requirement as JiraRequirement) : undefined}
                  onRequirementConfirmed={handleJiraRequirementConfirmed}
                />
              </div>
              <div style={{ marginTop: "12px", display: source === "manual" ? "block" : "none" }}>
                <ManualRequirementForm
                  key={`manual-${formKey}`}
                  initialRequirement={isEditing && activeRequirement?.source === "manual" ? (activeRequirement.requirement as ManualRequirement) : undefined}
                  onRequirementConfirmed={handleManualRequirementConfirmed}
                />
              </div>
              {isEditing && (
                <div style={{ marginTop: "12px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCancelEdit}
                    style={{
                      minHeight: "34px",
                      border: "1px solid var(--line-strong)",
                      background: "var(--surface)",
                      color: "var(--ink)",
                      borderRadius: "6px",
                      padding: "7px 12px",
                      cursor: "pointer",
                      fontWeight: 700
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleEditClick}
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