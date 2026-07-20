import { useState } from "react";
import type { ManualRequirement } from "./RequirementTypes";

const sampleRequirement = `User Story:
As a new user, I want to create an account so that I can securely access the application.

Acceptance Criteria:

1. Successful Account Creation
- Given valid username, email, and password
- When the user submits the registration request
- Then the account should be created successfully

2. Mandatory Field Validation
- Username is required
- Email is required
- Password is required

3. Email Validation
- Invalid email formats must be rejected

4. Password Policy
- Password must contain at least 8 characters
- At least one uppercase letter
- At least one number
- At least one special character

5. Duplicate User Validation
- Existing username or email must not be allowed`;

interface ManualRequirementFormProps {
  onRequirementConfirmed?: (requirement: ManualRequirement) => void;
}

export function ManualRequirementForm({ onRequirementConfirmed }: ManualRequirementFormProps) {
  // Draft state - editable textarea content
  const [manualDraft, setManualDraft] = useState<string>("");
  // Confirmed requirement - separate from draft
  const [confirmedManualRequirement, setConfirmedManualRequirement] = useState<ManualRequirement | null>(null);
  // Validation error state
  const [validationError, setValidationError] = useState<string>("");

  const handleUseRequirement = () => {
    // Clear any previous error
    setValidationError("");
    
    const trimmedDraft = manualDraft.trim();
    
    // Validate - reject empty or whitespace-only content
    if (!trimmedDraft) {
      setValidationError("Enter a requirement description before continuing.");
      return;
    }
    
    // Create confirmed ManualRequirement
    const confirmed: ManualRequirement = {
      source: "manual",
      key: `manual-${Date.now()}`,
      summary: trimmedDraft.split("\n")[0]?.slice(0, 50) || "Manual Requirement",
      description: trimmedDraft,
      acceptanceCriteria: [],
      fetchedAt: new Date().toISOString()
    };
    
    setConfirmedManualRequirement(confirmed);
    // Notify parent to set active requirement
    onRequirementConfirmed?.(confirmed);
  };

  const handleEdit = () => {
    // Prefill draft with confirmed requirement and allow editing
    if (confirmedManualRequirement) {
      setManualDraft(confirmedManualRequirement.description);
    }
    setConfirmedManualRequirement(null);
  };

  // Edit mode: show textarea and buttons
  if (!confirmedManualRequirement) {
    return (
      <div className="source-panel source-manual" style={{ marginTop: "12px" }}>
        <label style={{ display: "grid", gap: "6px", marginBottom: "12px" }}>
          <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--muted)", textTransform: "uppercase" }}>
            REQUIREMENT DESCRIPTION
          </span>
          <textarea
            placeholder="Paste or enter the requirement description, user story, acceptance criteria, and any relevant business rules..."
            value={manualDraft}
            onChange={(e) => setManualDraft(e.target.value)}
            style={{
              width: "100%",
              minHeight: "120px",
              maxHeight: "300px",
              padding: "10px 12px",
              border: "1px solid var(--line-strong)",
              borderRadius: "6px",
              background: "var(--surface)",
              color: "var(--ink)",
              fontSize: "14px",
              lineHeight: 1.5,
              resize: "vertical",
              overflowY: "auto",
              fontFamily: "inherit"
            }}
          />
        </label>

        {/* Inline validation error */}
        {validationError && (
          <p style={{ color: "var(--red)", fontSize: "13px", margin: "0 0 8px 0" }}>
            {validationError}
          </p>
        )}

        <div className="button-row" style={{ display: "flex", gap: "8px", justifyContent: "flex-start" }}>
          <button
            type="button"
            className="primary-action"
            onClick={handleUseRequirement}
            style={{
              minHeight: "34px",
              border: "1px solid var(--blue)",
              background: "var(--blue)",
              color: "#fff",
              borderRadius: "6px",
              padding: "7px 12px",
              cursor: "pointer",
              fontWeight: 700
            }}
          >
            Use Requirement
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setManualDraft(sampleRequirement)}
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
            Sample
          </button>
        </div>
      </div>
    );
  }

  // Confirmed state: show read-only requirement with Edit button
  return (
    <div className="source-panel source-manual" style={{ marginTop: "12px" }}>
      <div className="success-indicator" style={{ color: "var(--green)", fontSize: "14px", margin: 0 }}>
        <p style={{ margin: 0, marginBottom: "6px" }}>
          <span aria-label="success">✓</span> Requirement loaded successfully.
        </p>
        <div>
          <strong style={{ fontSize: "12px", textTransform: "uppercase", color: "var(--muted)" }}>
            DESCRIPTION
          </strong>
          <div
            style={{
              marginTop: "6px",
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: "6px",
              background: "var(--surface)",
              color: "var(--ink)",
              fontSize: "13px",
              lineHeight: 1.5,
              maxHeight: "200px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word"
            }}
          >
            {confirmedManualRequirement.description}
          </div>
        </div>
      </div>

      <div className="button-row" style={{ display: "flex", gap: "8px", justifyContent: "flex-start", marginTop: "12px" }}>
        <button
          type="button"
          className="secondary-action"
          onClick={handleEdit}
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
          Edit
        </button>
      </div>
    </div>
  );
}