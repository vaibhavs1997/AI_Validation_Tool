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

/**
 * Extracts acceptance criteria from raw text if present.
 * Looks for numbered items, bullet points, or explicit "Acceptance Criteria" sections.
 * Returns an array of AC strings, or empty array if none found.
 */
function extractAcceptanceCriteria(text: string): string[] {
  if (!text) return [];
  
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const acLines: string[] = [];
  
  // Detect lines that look like acceptance criteria
  // - Numbered items: "1.", "2.", "AC 1:", "AC1:", "Acceptance Criterion 1:"
  // - Bullet points under "Acceptance Criteria" section
  let inAcSection = false;
  
  for (const line of lines) {
    // Check for section headers
    if (/^acceptance\s*criteria/i.test(line)) {
      inAcSection = true;
      continue;
    }
    
    // Check if line looks like an AC item
    // Numbered: "1.", "1)", "AC 1:", "AC1:"
    // Bullet: "- Given...", "- When..."
    const acMatch = line.match(/^(\d+[\.\)]|AC\s*\d+[:\.]?|\-|\*)[\s]+(.+)$/i);
    if (acMatch) {
      acLines.push(acMatch[2] || line);
    } else if (inAcSection || /^(given|when|then|and|should|must)\b/i.test(line)) {
      // Continuation of AC content
      if (acLines.length > 0) {
        acLines[acLines.length - 1] += " " + line;
      } else {
        acLines.push(line);
      }
    }
  }
  
  return acLines;
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
    
    // Extract acceptance criteria from the text (optional - may be empty)
    const extractedAc = extractAcceptanceCriteria(trimmedDraft);
    
    // Create confirmed ManualRequirement
    const confirmed: ManualRequirement = {
      source: "manual",
      key: `manual-${Date.now()}`,
      summary: trimmedDraft.split("\n")[0]?.slice(0, 50) || "Manual Requirement",
      description: trimmedDraft,
      // Preserve extracted ACs if found, otherwise empty array
      // The requirement extractor will use description as fallback
      acceptanceCriteria: extractedAc,
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
            MANUAL REQUIREMENT
          </span>
          <textarea
            placeholder="Paste your requirement, user story, Jira description, acceptance criteria, business rules, or API behavior here..."
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

        <p style={{ 
          fontSize: "12px", 
          color: "var(--muted)", 
          margin: "0 0 8px 0",
          lineHeight: 1.4
        }}>
          You can paste plain text, Jira-style requirements, Given/When/Then criteria, numbered lists, or bullet points.
        </p>

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
            REQUIREMENT
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