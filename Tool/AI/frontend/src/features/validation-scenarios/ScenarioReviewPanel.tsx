/**
 * ScenarioReviewPanel
 *
 * AI Review Panel for extracted validation scenario proposals.
 */

import { useState, useMemo, useCallback } from "react";
import type { ScenarioProposal, ScenarioGenerationResult } from "./ValidationScenarioService";
import { createValidationScenario } from "./ValidationScenarioService";

interface ReviewPanelProps {
  result: ScenarioGenerationResult | null;
  projectId: string;
  onClear?: () => void;
  onRefresh?: () => void;
}

interface ProposalCardProps {
  proposal: ScenarioProposal;
  requirementId: string;
  onApprove: (proposal: ScenarioProposal, requirementId: string) => void;
  onReject: (proposal: ScenarioProposal, requirementId: string) => void;
  onEdit: (proposal: ScenarioProposal, updates: Partial<ScenarioProposal>) => void;
}

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

function ProposalCard({ proposal, requirementId, onApprove, onReject, onEdit }: ProposalCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(proposal.title);
  const [editDescription, setEditDescription] = useState(proposal.description);
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high" | "critical">(proposal.priority as "low" | "medium" | "high" | "critical");

  const handleSaveEdit = () => {
    onEdit(proposal, {
      title: editTitle.trim() || proposal.title,
      description: editDescription.trim(),
      priority: editPriority,
    });
    setEditing(false);
  };

  return (
    <div style={{ padding: "16px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-surface)", display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.3 }}>{proposal.title}</h3>
        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 8px", borderRadius: "var(--radius-pill)", background: getPriorityColor(proposal.priority, "bg"), color: getPriorityColor(proposal.priority, "text"), flexShrink: 0 }}>{proposal.priority}</span>
      </div>

      {proposal.description && (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>{proposal.description}</p>
      )}

      <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Confidence: {Math.round(proposal.confidence * 100)}%</div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => onApprove(proposal, requirementId)} style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "#fff", background: "var(--color-success)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Approve</button>
        <button type="button" onClick={() => setEditing(true)} style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Edit</button>
        <button type="button" onClick={() => onReject(proposal, requirementId)} style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "var(--color-error-text)", background: "var(--color-error-soft)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Reject</button>
      </div>

      {editing && (
        <div style={{ marginTop: "8px", padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)", display: "flex", flexDirection: "column", gap: "8px" }}>
          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }} />
          <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", resize: "vertical" }} />
          <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as "low" | "medium" | "high" | "critical")} style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={handleSaveEdit} style={{ padding: "8px 12px", fontSize: "13px", fontWeight: 600, color: "#fff", background: "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Save</button>
            <button type="button" onClick={() => setEditing(false)} style={{ padding: "8px 12px", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScenarioReviewPanel({ result, projectId, onClear, onRefresh }: ReviewPanelProps) {
  const [proposals, setProposals] = useState<ScenarioProposal[]>(result?.proposals || []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [warning, setWarning] = useState<string | undefined>(result?.warning || undefined);
  const [analysisLabel, setAnalysisLabel] = useState<string>("Analyzing requirements...");

  useMemo(() => {
    setProposals(result?.proposals || []);
    setSelectedIds(new Set());
    setWarning(result?.warning || undefined);
    setAnalysisLabel(result && result.proposals.length > 0 ? "Analysis complete" : "Analyzing requirements...");
  }, [result]);

  const toggleSelected = useCallback((p: ScenarioProposal, requirementId: string) => {
    const key = p.title + (requirementId || "");
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allSelected = proposals.length > 0 && selectedIds.size === proposals.length;

  const handleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(proposals.map((p) => p.title + (p.requirementId || ""))));
  };

  const handleApprove = async (p: ScenarioProposal, requirementId: string) => {
    if (!projectId) return;
    setSaving(true);
    setSaveError("");
    try {
      await createValidationScenario(projectId, { requirementId, title: p.title, description: p.description, priority: p.priority, confidence: p.confidence, status: "ready", source: "ai-generated" });
      setProposals((prev) => prev.filter((x) => x.title + (x.requirementId || "") !== p.title + (requirementId || "")));
      onRefresh?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to create scenario.");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = (p: ScenarioProposal, requirementId: string) => {
    const key = p.title + (requirementId || "");
    setProposals((prev) => prev.filter((x) => x.title + (x.requirementId || "") !== key));
  };

  const handleEdit = (p: ScenarioProposal, updates: Partial<ScenarioProposal>) => {
    setProposals((prev) => prev.map((x) => (x.title + (x.requirementId || "") === p.title + (p.requirementId || "") ? { ...x, ...updates } : x)));
  };

  const handleApproveSelected = async () => {
    if (!projectId) return;
    setSaving(true);
    setSaveError("");
    try {
      const toApprove = proposals.filter((p) => selectedIds.has(p.title + (p.requirementId || "")));
      await Promise.all(toApprove.map((p) => createValidationScenario(projectId, { requirementId: p.requirementId, title: p.title, description: p.description, priority: p.priority, confidence: p.confidence, status: "ready", source: "ai-generated" })));
      setProposals((prev) => prev.filter((p) => !selectedIds.has(p.title + (p.requirementId || ""))));
      setSelectedIds(new Set());
      onRefresh?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to create scenarios.");
    } finally {
      setSaving(false);
    }
  };

  const handleRejectAll = () => {
    setProposals([]);
    setSelectedIds(new Set());
  };

  const summary = useMemo(() => {
    const docsProcessed = result ? 1 : 0;
    const requirementsFound = new Set(proposals.map((p) => p.requirementId)).size;
    return { documentsProcessed: docsProcessed, requirementsFound, scenariosGenerated: proposals.length, approved: 0, rejected: 0, warnings: warning ? 1 : 0 };
  }, [proposals, result, warning]);

  return (
    <section style={{ marginBottom: "24px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-surface)", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
        <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>AI Scenario Generation</h2>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>{analysisLabel}</p>
      </div>
      <div style={{ padding: "16px" }}>
        {warning && <div style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "var(--color-warning-soft)", border: "1px solid var(--color-warning)", marginBottom: "12px", fontSize: "13px", color: "var(--color-warning)" }}>{warning}</div>}
        {saveError && <div style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "var(--color-error-soft)", border: "1px solid var(--color-error)", marginBottom: "12px", fontSize: "13px", color: "var(--color-error)" }}>{saveError}</div>}
        {analysisLabel.includes("Analyzing") && proposals.length === 0 && <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>Analyzing requirements...</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          {[
            { label: "Requirements Analyzed", value: summary.requirementsFound },
            { label: "Scenarios Generated", value: summary.scenariosGenerated },
            { label: "Approved", value: summary.approved },
            { label: "Rejected", value: summary.rejected },
            { label: "Warnings", value: summary.warnings },
          ].map((item) => (
            <div key={item.label} style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "4px" }}>{item.label}</div>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text-primary)" }}>{item.value}</div>
            </div>
          ))}
        </div>
        {proposals.length > 0 && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
            <button type="button" onClick={handleSelectAll} style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }} aria-pressed={allSelected}>{allSelected ? "Deselect All" : "Select All"}</button>
            <button type="button" onClick={handleApproveSelected} disabled={selectedIds.size === 0 || saving} style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "#fff", background: selectedIds.size === 0 || saving ? "var(--color-border)" : "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: selectedIds.size === 0 || saving ? "not-allowed" : "pointer" }}>Approve Selected ({selectedIds.size})</button>
            <button type="button" onClick={handleRejectAll} disabled={saving} style={{ padding: "8px 12px", fontSize: "12px", fontWeight: 600, color: "var(--color-error-text)", background: "var(--color-error-soft)", border: "none", borderRadius: "var(--radius-sm)", cursor: saving ? "not-allowed" : "pointer" }}>Reject All</button>
            <div style={{ marginLeft: "auto", fontSize: "12px", color: "var(--color-text-muted)" }}>{proposals.length} scenario{proposals.length !== 1 ? "s" : ""}</div>
          </div>
        )}
        {proposals.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
            {proposals.map((p, idx) => {
              const requirementId = p.requirementId || "";
              const key = `${requirementId}-${idx}`;
              return (
                <div key={key} style={{ position: "relative" }}>
                  <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 1 }}>
                    <input type="checkbox" checked={selectedIds.has(p.title + requirementId)} onChange={() => toggleSelected(p, requirementId)} style={{ width: "16px", height: "16px", cursor: "pointer" }} aria-label={`Select ${p.title}`} />
                  </div>
                  <ProposalCard proposal={p} requirementId={requirementId} onApprove={handleApprove} onReject={handleReject} onEdit={handleEdit} />
                </div>
              );
            })}
          </div>
        )}
        {proposals.length === 0 && !analysisLabel.includes("Analyzing") && (
          <div style={{ padding: "32px 24px", border: "1px dashed var(--color-border-strong)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)", textAlign: "center" }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>No scenarios generated.</p>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>Try selecting different requirements or adjust your inputs.</p>
            {onClear && <button type="button" onClick={onClear} style={{ marginTop: "12px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Clear</button>}
          </div>
        )}
        {result && proposals.length === 0 && onClear && (
          <div style={{ marginTop: "12px" }}>
            <button type="button" onClick={onClear} style={{ padding: "8px 14px", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Clear Extraction</button>
          </div>
        )}
      </div>
    </section>
  );
}