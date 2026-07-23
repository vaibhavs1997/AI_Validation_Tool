import { useState } from "react";
import { fetchJiraRequirement } from "./JiraRequirementService";
import type { JiraRequirement } from "./RequirementTypes";

interface JiraRequirementFormProps {
  onRequirementConfirmed?: (requirement: JiraRequirement) => void;
}

export function JiraRequirementForm({ onRequirementConfirmed }: JiraRequirementFormProps) {
  const [ticketKey, setTicketKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [fetchedRequirement, setFetchedRequirement] = useState<JiraRequirement | null>(null);
  const [failedTicketKey, setFailedTicketKey] = useState<string>("");

  const handleFetch = async () => {
    const trimmedKey = ticketKey.trim();
    if (!trimmedKey) return;

    setLoading(true);
    setStatus(null);

    try {
      const req = await fetchJiraRequirement(trimmedKey);
      setFetchedRequirement(req);
      setFailedTicketKey("");
      setStatus("success");
      // Only set active requirement on successful fetch
      onRequirementConfirmed?.(req);
    } catch {
      setFailedTicketKey(trimmedKey);
      setStatus("error");
      // Do NOT clear fetchedRequirement - keep previous valid requirement
      // Do NOT update activeRequirement on failure
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleFetch();
    }
  };

  // Determine what to show - show requirement if success OR if we have one but error occurred
  const hasValidRequirement = fetchedRequirement !== null;
  const showRequirement = status === "success" || (status === "error" && hasValidRequirement);

  return (
    <div className="source-panel source-jira" style={{ marginTop: "12px" }}>
      <label style={{ display: "grid", gap: "6px", marginBottom: "12px" }}>
        Ticket Key
        <div className="input-row" style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
          <input
            id="jiraKey"
            type="text"
            placeholder="e.g. PROJ-1234"
            value={ticketKey}
            onChange={(e) => setTicketKey(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "7px 12px",
              border: "1px solid var(--line-strong)",
              borderRadius: "6px",
              background: "var(--surface)",
              color: "var(--ink)",
              fontSize: "14px"
            }}
          />
          <button
            id="fetchJiraBtn"
            type="button"
            className="primary-action"
            onClick={handleFetch}
            disabled={loading}
            style={{
              minHeight: "34px",
              border: "1px solid var(--blue)",
              background: "var(--blue)",
              color: "#fff",
              borderRadius: "6px",
              padding: "7px 12px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
              opacity: loading ? 0.62 : 1
            }}
          >
            {loading ? "Fetching..." : "Fetch"}
          </button>
        </div>
      </label>

      {/* Success/Error presentation - show requirement if valid, error if failed */}
      {showRequirement && fetchedRequirement && (
        <div className="success-indicator" style={{ color: "var(--green)", fontSize: "14px", margin: 0 }}>
          <p style={{ margin: 0, marginBottom: "6px" }}>
            <span aria-label="success">✓</span> Requirement loaded successfully.
          </p>
          <p style={{ margin: 0, fontWeight: 800 }}>{fetchedRequirement.key}</p>
          <p style={{ margin: 0, marginBottom: "10px", color: "var(--muted)" }}>
            {fetchedRequirement.summary}
          </p>
          {fetchedRequirement.description && (
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
                {fetchedRequirement.description}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error presentation - only show if no valid requirement to display */}
      {status === "error" && !hasValidRequirement && (
        <p style={{ color: "var(--red)", fontSize: "14px", margin: 0 }}>
          Unable to fetch {failedTicketKey}.<br />
          The ticket does not exist or you may not have permission to access it.
        </p>
      )}
      
      {/* Contextual error when requirement exists but new fetch failed */}
      {status === "error" && hasValidRequirement && (
        <p style={{ color: "var(--red)", fontSize: "14px", marginTop: "12px", marginBottom: 0 }}>
          Unable to fetch {failedTicketKey}.<br />
          The ticket does not exist or you may not have permission to access it.
        </p>
      )}
    </div>
  );
}