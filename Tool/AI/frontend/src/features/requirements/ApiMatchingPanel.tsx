/**
 * ApiMatchingPanel
 *
 * STEP 4 - Display API matching results for selected test cases.
 * Shows matched APIs, suggested APIs, and unmatched test cases.
 */

export interface ApiMatch {
  testCaseId: string;
  testCaseTitle: string;
  matchedApi?: {
    serviceId: string;
    serviceName: string;
    operationId: string;
    operationName: string;
    method: string;
    path: string;
    confidence: number;
  };
  suggestedApi?: {
    serviceId: string;
    serviceName: string;
    operationId: string;
    operationName: string;
    method: string;
    path: string;
    confidence: number;
  };
  status: "matched" | "review-required" | "unmatched";
  authentication?: string;
  dependencies: string[];
}

interface ApiMatchingPanelProps {
  matches: ApiMatch[];
  onConfirmMappings: () => void;
  onReviewSuggestion: (testCaseId: string) => void;
  onChangeApi: (testCaseId: string) => void;
  isConfirming: boolean;
}

export function ApiMatchingPanel({
  matches,
  onConfirmMappings,
  onReviewSuggestion,
  onChangeApi,
  isConfirming,
}: ApiMatchingPanelProps) {
  const matchedCount = matches.filter((m) => m.status === "matched").length;
  const reviewCount = matches.filter((m) => m.status === "review-required").length;
  const unmatchedCount = matches.filter((m) => m.status === "unmatched").length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "matched":
        return "var(--color-success)";
      case "review-required":
        return "var(--color-warning)";
      case "unmatched":
        return "var(--color-error)";
      default:
        return "var(--color-text-secondary)";
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "var(--color-success)";
    if (confidence >= 0.5) return "var(--color-warning)";
    return "var(--color-error)";
  };

  return (
    <div style={{
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-lg)",
      background: "var(--color-bg-surface)",
      overflow: "hidden",
      marginBottom: "24px",
    }}>
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
      }}>
        <div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
            Connect APIs
          </h3>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-secondary)" }}>
            {matchedCount} Matched · {reviewCount} Need Review · {unmatchedCount} Unmatched
          </p>
        </div>
        <button
          type="button"
          onClick={onConfirmMappings}
          disabled={isConfirming || reviewCount > 0 || unmatchedCount > 0}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#fff",
            background: isConfirming || reviewCount > 0 || unmatchedCount > 0 ? "var(--color-border)" : "var(--color-primary)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: isConfirming || reviewCount > 0 || unmatchedCount > 0 ? "not-allowed" : "pointer",
          }}
        >
          {isConfirming ? "Confirming..." : "Confirm Mappings"}
        </button>
      </div>

      <div style={{ padding: "16px", maxHeight: "600px", overflowY: "auto" }}>
        {matches.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px", padding: "32px 0" }}>
            No API matches yet. Approve test cases first to see matching results.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {matches.map((match) => (
              <div
                key={match.testCaseId}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-bg-surface)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "14px 16px" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "12px",
                    flexWrap: "wrap",
                  }}>
                    <span style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      flex: 1,
                      minWidth: 0,
                    }}>
                      {match.testCaseTitle}
                    </span>
                    <span style={{
                      padding: "2px 8px",
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--color-bg-muted)",
                      color: getStatusColor(match.status),
                    }}>
                      {match.status.replace("-", " ")}
                    </span>
                  </div>

                  {match.matchedApi && (
                    <div style={{
                      padding: "12px",
                      background: "var(--color-success-soft)",
                      border: "1px solid var(--color-success)",
                      borderRadius: "var(--radius-sm)",
                      marginBottom: "8px",
                    }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "8px",
                        flexWrap: "wrap",
                      }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-success)", textTransform: "uppercase" }}>
                          Matched API
                        </span>
                        <span style={{
                          padding: "2px 8px",
                          fontSize: "11px",
                          background: "var(--color-success)",
                          color: "#fff",
                          borderRadius: "var(--radius-sm)",
                          fontWeight: 600,
                        }}>
                          {match.matchedApi.method}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--color-text-primary)", fontFamily: "monospace" }}>
                          {match.matchedApi.path}
                        </span>
                        <span style={{
                          marginLeft: "auto",
                          fontSize: "11px",
                          color: getConfidenceColor(match.matchedApi.confidence),
                          fontWeight: 600,
                        }}>
                          {Math.round(match.matchedApi.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                        {match.matchedApi.serviceName} · {match.matchedApi.operationName}
                      </div>
                    </div>
                  )}

                  {match.suggestedApi && !match.matchedApi && (
                    <div style={{
                      padding: "12px",
                      background: "var(--color-warning-soft)",
                      border: "1px solid var(--color-warning)",
                      borderRadius: "var(--radius-sm)",
                      marginBottom: "8px",
                    }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "8px",
                        flexWrap: "wrap",
                      }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-warning)", textTransform: "uppercase" }}>
                          Suggested API
                        </span>
                        <span style={{
                          padding: "2px 8px",
                          fontSize: "11px",
                          background: "var(--color-warning)",
                          color: "#fff",
                          borderRadius: "var(--radius-sm)",
                          fontWeight: 600,
                        }}>
                          {match.suggestedApi.method}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--color-text-primary)", fontFamily: "monospace" }}>
                          {match.suggestedApi.path}
                        </span>
                        <span style={{
                          marginLeft: "auto",
                          fontSize: "11px",
                          color: getConfidenceColor(match.suggestedApi.confidence),
                          fontWeight: 600,
                        }}>
                          {Math.round(match.suggestedApi.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginBottom: "8px" }}>
                        {match.suggestedApi.serviceName} · {match.suggestedApi.operationName}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => onReviewSuggestion(match.testCaseId)}
                          style={{
                            padding: "4px 12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--color-warning)",
                            background: "var(--color-bg-surface)",
                            border: "1px solid var(--color-warning)",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                          }}
                        >
                          Review Suggestion
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangeApi(match.testCaseId)}
                          style={{
                            padding: "4px 12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--color-text-primary)",
                            background: "var(--color-bg-surface)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                          }}
                        >
                          Change API
                        </button>
                      </div>
                    </div>
                  )}

                  {match.status === "unmatched" && (
                    <div style={{
                      padding: "12px",
                      background: "var(--color-error-soft)",
                      border: "1px solid var(--color-error)",
                      borderRadius: "var(--radius-sm)",
                    }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-error)", textTransform: "uppercase" }}>
                        Unmatched
                      </span>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
                        No suitable API found. Review required.
                      </p>
                    </div>
                  )}

                  {match.authentication && (
                    <div style={{
                      marginTop: "8px",
                      fontSize: "11px",
                      color: "var(--color-text-muted)",
                    }}>
                      <strong>Authentication:</strong> {match.authentication}
                    </div>
                  )}

                  {match.dependencies.length > 0 && (
                    <div style={{
                      marginTop: "4px",
                      fontSize: "11px",
                      color: "var(--color-text-muted)",
                    }}>
                      <strong>Dependencies:</strong> {match.dependencies.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}