/**
 * TestCaseReviewPanel
 *
 * STEP 3 - Review generated test cases before API matching.
 * Displays AI-generated test cases with selection UI.
 */

import { useState } from "react";

export interface GeneratedTestCase {
  id: string;
  title: string;
  description: string;
  type: "positive" | "negative";
  priority: "low" | "medium" | "high" | "critical";
  acceptanceCriteriaRef: string[];
  expectedStatusCode?: number;
  tags: string[];
}

interface TestCaseReviewPanelProps {
  testCases: GeneratedTestCase[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  onRegenerate: () => void;
  onApprove: () => void;
  isGenerating: boolean;
  isApproving: boolean;
}

export function TestCaseReviewPanel({
  testCases,
  selectedIds,
  onSelectionChange,
  onRegenerate,
  onApprove,
  isGenerating,
  isApproving,
}: TestCaseReviewPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allSelected = testCases.length > 0 && selectedIds.length === testCases.length;
  const noneSelected = selectedIds.length === 0;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(testCases.map((tc) => tc.id));
    }
  };

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((tcId) => tcId !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "var(--color-error)";
      case "high":
        return "var(--color-warning)";
      case "medium":
        return "var(--color-info)";
      case "low":
        return "var(--color-text-muted)";
      default:
        return "var(--color-text-secondary)";
    }
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
            Review Generated Test Cases
          </h3>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-secondary)" }}>
            {testCases.length} Generated · {selectedIds.length} Selected
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isGenerating}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              cursor: isGenerating ? "not-allowed" : "pointer",
              opacity: isGenerating ? 0.7 : 1,
            }}
          >
            {isGenerating ? "Generating..." : "Regenerate"}
          </button>
          <button
            type="button"
            onClick={handleSelectAll}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            {allSelected ? "Exclude All" : "Select All"}
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={isApproving || noneSelected}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              background: isApproving || noneSelected ? "var(--color-border)" : "var(--color-primary)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: isApproving || noneSelected ? "not-allowed" : "pointer",
            }}
          >
            {isApproving ? "Approving..." : `Approve Selected (${selectedIds.length})`}
          </button>
        </div>
      </div>

      <div style={{ padding: "16px", maxHeight: "600px", overflowY: "auto" }}>
        {testCases.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px", padding: "32px 0" }}>
            No test cases generated yet. Click "Generate Test Cases" to start.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {testCases.map((testCase) => {
              const isExpanded = expandedId === testCase.id;
              const isSelected = selectedIds.includes(testCase.id);

              return (
                <div
                  key={testCase.id}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-bg-surface)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      cursor: "pointer",
                      background: isSelected ? "var(--color-primary-soft)" : "transparent",
                    }}
                    onClick={() => handleToggle(testCase.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(testCase.id)}
                      style={{
                        marginTop: "2px",
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                        accentColor: "var(--color-primary)",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "6px",
                        flexWrap: "wrap",
                      }}>
                        <span style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "var(--color-text-primary)",
                        }}>
                          {testCase.title}
                        </span>
                        <span style={{
                          padding: "2px 8px",
                          fontSize: "10px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          borderRadius: "var(--radius-pill)",
                          background: testCase.type === "positive" ? "var(--color-success-soft)" : "var(--color-error-soft)",
                          color: testCase.type === "positive" ? "var(--color-success)" : "var(--color-error)",
                        }}>
                          {testCase.type}
                        </span>
                        <span style={{
                          padding: "2px 8px",
                          fontSize: "10px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          borderRadius: "var(--radius-pill)",
                          background: "var(--color-bg-muted)",
                          color: getPriorityColor(testCase.priority),
                        }}>
                          {testCase.priority}
                        </span>
                      </div>
                      <p style={{
                        margin: "0 0 8px 0",
                        fontSize: "13px",
                        color: "var(--color-text-secondary)",
                        lineHeight: 1.5,
                      }}>
                        {testCase.description}
                      </p>
                      {testCase.acceptanceCriteriaRef.length > 0 && (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>AC Ref:</span>
                          {testCase.acceptanceCriteriaRef.map((ref, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: "2px 6px",
                                fontSize: "11px",
                                background: "var(--color-info-soft)",
                                color: "var(--color-info)",
                                borderRadius: "var(--radius-sm)",
                              }}
                            >
                              {ref}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : testCase.id);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-text-muted)",
                        cursor: "pointer",
                        padding: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <polyline points={isExpanded ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                      </svg>
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{
                      padding: "14px 16px",
                      borderTop: "1px solid var(--color-border)",
                      background: "var(--color-bg-subtle)",
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                        <div>
                          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>
                            Expected Status Code
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
                            {testCase.expectedStatusCode || "Not specified"}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>
                            Priority
                          </div>
                          <div style={{ fontSize: "13px", color: getPriorityColor(testCase.priority), textTransform: "capitalize" }}>
                            {testCase.priority}
                          </div>
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "4px" }}>
                            Tags
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {testCase.tags.length > 0 ? (
                              testCase.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    padding: "2px 8px",
                                    fontSize: "11px",
                                    background: "var(--color-bg-muted)",
                                    color: "var(--color-text-secondary)",
                                    borderRadius: "var(--radius-sm)",
                                  }}
                                >
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>No tags</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}