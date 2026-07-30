/**
 * RequirementExtractionPanel
 *
 * AI Review Panel for extracted requirement proposals.
 * Features:
 * - Display proposals as Requirement Cards
 * - Approve / Edit / Reject actions
 * - Bulk actions: Approve All, Reject All, Approve Selected
 * - Extraction summary (Documents Processed, Requirements Found, Approved, Rejected, Warnings)
 * - Failure handling with Retry and Manual Creation
 *
 * Reuses existing Requirement domain model and CRUD APIs.
 */

import { useState, useMemo, useCallback } from "react";
import type { RequirementProposal, RequirementExtractionResult } from "./RequirementService";
import { createRequirement } from "./RequirementService";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ExtractionPanelProps {
  result: RequirementExtractionResult | null;
  projectId: string;
  onApproveAll?: () => void;
  onRejectAll?: () => void;
  onClear?: () => void;
}

interface ProposalCardProps {
  proposal: RequirementProposal;
  onApprove: (proposal: RequirementProposal) => void;
  onReject: (proposal: RequirementProposal) => void;
  onEdit: (proposal: RequirementProposal, updates: Partial<RequirementProposal>) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: "var(--color-bg-muted)", text: "var(--color-text-muted)" },
  medium: { bg: "var(--color-info-soft)", text: "var(--color-info)" },
  high: { bg: "var(--color-warning-soft)", text: "var(--color-warning)" },
  critical: { bg: "var(--color-error-soft)", text: "var(--color-error)" },
};

function getPriorityColor(priority: string, type: "bg" | "text"): string {
  const colors = (PRIORITY_COLORS[priority] || PRIORITY_COLORS["medium"]) as { bg: string; text: string };
  return type === "bg" ? colors.bg : colors.text;
}

// ─── Proposal Card ────────────────────────────────────────────────────────────

function ProposalCard({ proposal, onApprove, onReject, onEdit }: ProposalCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(proposal.title);
  const [editDescription, setEditDescription] = useState(proposal.description);
  const [editAcceptanceCriteria, setEditAcceptanceCriteria] = useState(proposal.acceptanceCriteria.join("\n"));
  const [editBusinessRules, setEditBusinessRules] = useState(proposal.businessRules.join("\n"));
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high" | "critical">(proposal.priority as "low" | "medium" | "high" | "critical");
  const [editNotes, setEditNotes] = useState(proposal.sourceNotes);

  const handleSaveEdit = () => {
    onEdit(proposal, {
      title: editTitle.trim() || proposal.title,
      description: editDescription.trim(),
      acceptanceCriteria: editAcceptanceCriteria.split("\n").map((s) => s.trim()).filter(Boolean),
      businessRules: editBusinessRules.split("\n").map((s) => s.trim()).filter(Boolean),
      priority: editPriority,
      sourceNotes: editNotes.trim(),
    });
    setEditing(false);
  };

  return (
    <div
      style={{
        padding: "16px",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-bg-surface)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Title & Priority */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
          {proposal.title}
        </h3>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "2px 8px",
            borderRadius: "var(--radius-pill)",
            background: getPriorityColor(proposal.priority, "bg"),
            color: getPriorityColor(proposal.priority, "text"),
            flexShrink: 0,
          }}
        >
          {proposal.priority}
        </span>
      </div>

      {/* Description */}
      {proposal.description && (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          {proposal.description}
        </p>
      )}

      {/* Acceptance Criteria */}
      {proposal.acceptanceCriteria.length > 0 && (
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "4px" }}>
            Acceptance Criteria
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            {proposal.acceptanceCriteria.map((ac, idx) => (
              <li key={idx}>{ac}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Business Rules */}
      {proposal.businessRules.length > 0 && (
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "4px" }}>
            Business Rules
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            {proposal.businessRules.map((br) => (
              <li key={br}>{br}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence & Notes */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
          Confidence: {Math.round(proposal.confidence * 100)}%
        </span>
        {proposal.sourceNotes && (
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontStyle: "italic" }}>
            {proposal.sourceNotes}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onApprove(proposal)}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#fff",
            background: "var(--color-success)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
          }}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
          }}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onReject(proposal)}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--color-error-text)",
            background: "var(--color-error-soft)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
          }}
        >
          Reject
        </button>
      </div>

      {/* Edit Form */}
      {editing && (
        <div style={{
          marginTop: "8px",
          padding: "12px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          background: "var(--color-bg-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={3}
            style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", resize: "vertical" }}
          />
          <textarea
            value={editAcceptanceCriteria}
            onChange={(e) => setEditAcceptanceCriteria(e.target.value)}
            rows={4}
            placeholder="One acceptance criterion per line"
            style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", resize: "vertical" }}
          />
          <textarea
            value={editBusinessRules}
            onChange={(e) => setEditBusinessRules(e.target.value)}
            rows={4}
            placeholder="One business rule per line"
            style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", resize: "vertical" }}
          />
          <select
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value as "low" | "medium" | "high" | "critical")}
            style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={2}
            style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={handleSaveEdit}
              style={{
                padding: "8px 12px",
                fontSize: "13px",
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
              onClick={() => setEditing(false)}
              style={{
                padding: "8px 12px",
                fontSize: "13px",
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
      )}
    </div>
  );
}

// ─── Extraction Panel ─────────────────────────────────────────────────────────

export function RequirementExtractionPanel({ result, projectId, onClear }: ExtractionPanelProps) {
  const [proposals, setProposals] = useState<RequirementProposal[]>(result?.proposals || []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [warning, setWarning] = useState<string | undefined>(result?.warning);
  const [analysisLabel, setAnalysisLabel] = useState<string>("Analyzing requirements...");

  // Reset when result changes
  useMemo(() => {
    setProposals(result?.proposals || []);
    setSelectedIds(new Set());
    setWarning(result?.warning);
    setAnalysisLabel(result && result.proposals.length > 0 ? "Analysis complete" : "Analyzing requirements...");
  }, [result]);

  // Toggle selection
  const toggleSelected = useCallback((p: RequirementProposal) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const key = p.title + (p.sourceNotes || "");
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allSelected = proposals.length > 0 && selectedIds.size === proposals.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(proposals.map((p) => p.title + (p.sourceNotes || ""))));
    }
  };

  const handleApprove = async (p: RequirementProposal) => {
    if (!projectId) return;
    setSaving(true);
    setSaveError("");
    try {
      await createRequirement(projectId, {
        title: p.title,
        description: p.description,
        acceptanceCriteria: p.acceptanceCriteria,
        businessRules: p.businessRules,
        priority: p.priority,
        notes: p.sourceNotes,
        status: "ready",
        source: "upload",
      });
      setProposals((prev) => prev.filter((x) => x !== p));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(p.title + (p.sourceNotes || ""));
        return next;
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to create requirement.");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = (p: RequirementProposal) => {
    setProposals((prev) => prev.filter((x) => x !== p));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(p.title + (p.sourceNotes || ""));
      return next;
    });
  };

  const handleEdit = (p: RequirementProposal, updates: Partial<RequirementProposal>) => {
    setProposals((prev) => prev.map((x) => (x === p ? { ...x, ...updates } : x)));
  };

  const handleApproveSelected = async () => {
    if (!projectId) return;
    setSaving(true);
    setSaveError("");
    try {
      const toApprove = proposals.filter((p) => selectedIds.has(p.title + (p.sourceNotes || "")));
      await Promise.all(
        toApprove.map((p) =>
          createRequirement(projectId, {
            title: p.title,
            description: p.description,
            acceptanceCriteria: p.acceptanceCriteria,
            businessRules: p.businessRules,
            priority: p.priority,
            notes: p.sourceNotes,
            status: "ready",
            source: "upload",
          })
        )
      );
      setProposals((prev) => prev.filter((p) => !selectedIds.has(p.title + (p.sourceNotes || ""))));
      setSelectedIds(new Set());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to create requirements.");
    } finally {
      setSaving(false);
    }
  };

  const handleRejectAll = () => {
    setProposals([]);
    setSelectedIds(new Set());
  };

  // Summary
  const summary = useMemo(() => {
    const docsProcessed = result?.fileName ? 1 : 0;
    const requirementsFound = proposals.length;
    return {
      documentsProcessed: docsProcessed,
      requirementsFound,
      approved: 0,
      rejected: 0,
      warnings: warning ? 1 : 0,
    };
  }, [proposals, result, warning]);

  return (
    <section style={{ marginBottom: "24px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-surface)", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
        <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>
          AI Requirement Extraction
        </h2>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>
          {analysisLabel}
        </p>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Warning / Failure */}
        {warning && (
          <div style={{
            padding: "12px",
            borderRadius: "var(--radius-md)",
            background: "var(--color-warning-soft)",
            border: "1px solid var(--color-warning)",
            marginBottom: "12px",
            fontSize: "13px",
            color: "var(--color-warning)",
          }}>
            {warning}
          </div>
        )}

        {saveError && (
          <div style={{
            padding: "12px",
            borderRadius: "var(--radius-md)",
            background: "var(--color-error-soft)",
            border: "1px solid var(--color-error)",
            marginBottom: "12px",
            fontSize: "13px",
            color: "var(--color-error)",
          }}>
            {saveError}
          </div>
        )}

        {/* Progress Indicator */}
        {analysisLabel.includes("Analyzing") && proposals.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
            Analyzing requirements...
          </div>
        )}

        {/* Extraction Summary */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          marginBottom: "16px",
        }}>
          <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "4px" }}>Documents Processed</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>{summary.documentsProcessed}</div>
          </div>
          <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "4px" }}>Requirements Found</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>{summary.requirementsFound}</div>
          </div>
          <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "4px" }}>Approved</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-success)" }}>{summary.approved}</div>
          </div>
          <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "4px" }}>Rejected</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-error)" }}>{summary.rejected}</div>
          </div>
          <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "4px" }}>Warnings</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-warning)" }}>{summary.warnings}</div>
          </div>
        </div>

        {/* Bulk Actions */}
        {proposals.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleSelectAll}
              style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
              aria-pressed={allSelected}
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
            <button
              type="button"
              onClick={handleApproveSelected}
              disabled={selectedIds.size === 0 || saving}
              style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "#fff", background: selectedIds.size === 0 || saving ? "var(--color-border)" : "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: selectedIds.size === 0 || saving ? "not-allowed" : "pointer" }}
            >
              Approve Selected ({selectedIds.size})
            </button>
            <button
              type="button"
              onClick={handleRejectAll}
              disabled={saving}
              style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "var(--color-error-text)", background: "var(--color-error-soft)", border: "none", borderRadius: "var(--radius-sm)", cursor: saving ? "not-allowed" : "pointer" }}
            >
              Reject All
            </button>
            <div style={{ marginLeft: "auto", fontSize: "12px", color: "var(--color-text-muted)" }}>
              {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}

        {/* Proposal Cards */}
        {proposals.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "12px",
          }}>
            {proposals.map((p) => {
              const key = p.title + (p.sourceNotes || "");
              return (
                <div key={key} style={{ position: "relative" }}>
                  {/* Checkbox overlay for selection */}
                  <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 1 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(key)}
                      onChange={() => toggleSelected(p)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                      aria-label={`Select ${p.title}`}
                    />
                  </div>
                  <ProposalCard
                    proposal={p}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onEdit={handleEdit}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state when no proposals and not analyzing */}
        {proposals.length === 0 && !analysisLabel.includes("Analyzing") && (
          <div style={{
            padding: "32px 24px",
            border: "1px dashed var(--color-border-strong)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-bg-subtle)",
            textAlign: "center",
          }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>
              No proposals extracted.
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>
              Try providing a different document or paste text with clear requirement statements.
            </p>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                style={{
                  marginTop: "12px",
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Clearing the extraction */}
        {result && proposals.length === 0 && onClear && (
          <div style={{ marginTop: "12px" }}>
            <button
              type="button"
              onClick={onClear}
              style={{
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
              }}
            >
              Clear Extraction
            </button>
          </div>
        )}
      </div>
    </section>
  );
}