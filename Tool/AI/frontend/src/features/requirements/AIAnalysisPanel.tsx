/**
 * AIAnalysisPanel
 *
 * Section 2 - AI Requirement Analysis panel.
 * Displays AI-extracted analysis with editable cards.
 * User can accept, reject, edit, and regenerate analysis.
 */

import { useState } from "react";

export interface AIAnalysis {
  acceptanceCriteria: string[];
  businessRules: string[];
  positivePaths: string[];
  negativePaths: string[];
  edgeCases: string[];
  preconditions: string[];
  postconditions: string[];
  dependencies: string[];
  assumptions: string[];
  missingInformation: string[];
  ambiguities: string[];
  completed: boolean;
  analyzedAt: string | null;
}

interface AIAnalysisPanelProps {
  analysis: AIAnalysis;
  onAccept: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  onUpdate: (field: keyof AIAnalysis, values: string[]) => void;
  isAnalyzing: boolean;
  aiConfigured: boolean;
}

type AnalysisSection = {
  key: keyof AIAnalysis;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
};

const SECTIONS: AnalysisSection[] = [
  { key: "acceptanceCriteria", label: "Acceptance Criteria", icon: "✓", color: "var(--color-success)", bgColor: "var(--color-success-soft)" },
  { key: "businessRules", label: "Business Rules", icon: "⚙", color: "var(--color-info)", bgColor: "var(--color-info-soft)" },
  { key: "preconditions", label: "Preconditions", icon: "▶", color: "var(--color-primary)", bgColor: "var(--color-primary-soft)" },
  { key: "postconditions", label: "Postconditions", icon: "⏹", color: "var(--color-primary)", bgColor: "var(--color-primary-soft)" },
  { key: "positivePaths", label: "Positive Flows", icon: "✓", color: "var(--color-success)", bgColor: "var(--color-success-soft)" },
  { key: "negativePaths", label: "Negative Flows", icon: "✗", color: "var(--color-error)", bgColor: "var(--color-error-soft)" },
  { key: "edgeCases", label: "Edge Cases", icon: "⚠", color: "var(--color-warning)", bgColor: "var(--color-warning-soft)" },
  { key: "dependencies", label: "Dependencies", icon: "🔗", color: "var(--color-text-secondary)", bgColor: "var(--color-bg-muted)" },
  { key: "assumptions", label: "Assumptions", icon: "💡", color: "var(--color-text-secondary)", bgColor: "var(--color-bg-muted)" },
  { key: "missingInformation", label: "Missing Information", icon: "❓", color: "var(--color-error)", bgColor: "var(--color-error-soft)" },
  { key: "ambiguities", label: "Ambiguities", icon: "⚡", color: "var(--color-warning)", bgColor: "var(--color-warning-soft)" },
];

export function AIAnalysisPanel({
  analysis,
  onAccept,
  onReject,
  onRegenerate,
  onUpdate,
  isAnalyzing,
  aiConfigured,
}: AIAnalysisPanelProps) {
  const [editingField, setEditingField] = useState<keyof AIAnalysis | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (field: keyof AIAnalysis) => {
    const values = analysis[field] as string[];
    setEditValue(values.join("\n"));
    setEditingField(field);
  };

  const saveEdit = () => {
    if (editingField) {
      const values = editValue.split("\n").map((s) => s.trim()).filter(Boolean);
      onUpdate(editingField, values);
      setEditingField(null);
      setEditValue("");
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const totalItems = SECTIONS.reduce((sum, section) => {
    const values = analysis[section.key] as string[];
    return sum + (Array.isArray(values) ? values.length : 0);
  }, 0);

  return (
    <div style={{
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-lg)",
      background: "var(--color-bg-surface)",
      overflow: "hidden",
    }}>
      {/* Header */}
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
            AI Analysis Results
          </h3>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-secondary)" }}>
            {totalItems} items extracted · {aiConfigured ? "AI Powered" : "AI Not Configured"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isAnalyzing}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              cursor: isAnalyzing ? "not-allowed" : "pointer",
              opacity: isAnalyzing ? 0.7 : 1,
            }}
          >
            {isAnalyzing ? "Analyzing..." : "Regenerate"}
          </button>
          <button
            type="button"
            onClick={onReject}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-error)",
              background: "var(--color-error-soft)",
              border: "1px solid var(--color-error)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            Reject All
          </button>
          <button
            type="button"
            onClick={onAccept}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              background: "var(--color-success)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
            }}
          >
            Accept All
          </button>
        </div>
      </div>

      {/* Analysis Cards */}
      <div style={{ padding: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "12px" }}>
          {SECTIONS.map((section) => {
            const values = analysis[section.key] as string[];
            const count = Array.isArray(values) ? values.length : 0;
            const isEmpty = count === 0;

            return (
              <div
                key={section.key}
                style={{
                  border: `1px solid ${isEmpty ? "var(--color-border)" : section.color}`,
                  borderRadius: "var(--radius-md)",
                  background: isEmpty ? "var(--color-bg-subtle)" : "var(--color-bg-surface)",
                  overflow: "hidden",
                  opacity: isEmpty ? 0.6 : 1,
                }}
              >
                {/* Section header */}
                <div style={{
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: isEmpty ? "none" : `1px solid var(--color-border)`,
                  background: isEmpty ? "transparent" : section.bgColor,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px" }}>{section.icon}</span>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}>
                      {section.label}
                    </span>
                    <span style={{
                      padding: "1px 6px",
                      fontSize: "10px",
                      fontWeight: 700,
                      borderRadius: "var(--radius-pill)",
                      background: section.bgColor,
                      color: section.color,
                    }}>
                      {count}
                    </span>
                  </div>
                  {!isEmpty && (
                    <button
                      type="button"
                      onClick={() => startEdit(section.key)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--color-text-muted)",
                        cursor: "pointer",
                        padding: "2px 4px",
                        fontSize: "12px",
                      }}
                      title="Edit"
                    >
                      ✏️
                    </button>
                  )}
                </div>

                {/* Section content */}
                <div style={{ padding: "8px 12px" }}>
                  {editingField === section.key ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        rows={Math.max(3, count + 1)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          fontSize: "12px",
                          border: "1px solid var(--color-border)",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--color-bg-surface)",
                          color: "var(--color-text-primary)",
                          fontFamily: "monospace",
                          resize: "vertical",
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={saveEdit}
                          style={{
                            padding: "4px 12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#fff",
                            background: "var(--color-primary)",
                            border: "none",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
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
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : isEmpty ? (
                    <div style={{ fontSize: "12px", color: "var(--color-text-muted)", fontStyle: "italic", padding: "4px 0" }}>
                      No items detected
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {(values as string[]).map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: "12px",
                            color: "var(--color-text-secondary)",
                            padding: "4px 8px",
                            background: "var(--color-bg-subtle)",
                            borderRadius: "var(--radius-sm)",
                            lineHeight: 1.4,
                          }}
                        >
                          • {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}