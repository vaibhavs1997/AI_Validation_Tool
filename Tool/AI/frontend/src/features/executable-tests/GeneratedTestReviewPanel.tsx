/**
 * GeneratedTestReviewPanel
 *
 * AI Review Panel for generated executable test proposals.
 */

import { useState, useMemo, useCallback } from "react";
import type { TestProposal, TestGenerationResult } from "./ExecutableTestService";
import { createExecutableTest } from "./ExecutableTestService";
import { AssertionViewer } from "./AssertionViewer";
import { DependencyViewer } from "./DependencyViewer";

interface ReviewPanelProps {
  result: TestGenerationResult | null;
  projectId: string;
  onClear?: () => void;
  onRefresh?: () => void;
}

interface ProposalCardProps {
  proposal: TestProposal;
  onApprove: (proposal: TestProposal) => void;
  onReject: (proposal: TestProposal) => void;
  onEdit: (proposal: TestProposal, updates: Partial<TestProposal>) => void;
}

function ProposalCard({ proposal, onApprove, onReject, onEdit }: ProposalCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(proposal.title);
  const [editDescription, setEditDescription] = useState(proposal.description);
  const [editConfidence, setEditConfidence] = useState(proposal.confidence);

  const handleSaveEdit = () => {
    onEdit(proposal, {
      title: editTitle.trim() || proposal.title,
      description: editDescription.trim(),
      confidence: Math.max(0, Math.min(1, Number(editConfidence))),
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
            background: "var(--color-info-soft)",
            color: "var(--color-info)",
            flexShrink: 0,
          }}
        >
          {Math.round(proposal.confidence * 100)}%
        </span>
      </div>

      {proposal.description && (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          {proposal.description}
        </p>
      )}

      {proposal.scenario && (
        <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          <strong>Scenario:</strong> {proposal.scenario}
        </p>
      )}

      {proposal.executionSteps && proposal.executionSteps.length > 0 && (
        <div style={{ padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)" }}>Execution Steps</div>
          {proposal.executionSteps.map((step, idx) => (
            <div key={idx} style={{ fontSize: "12px", color: "var(--color-text-secondary)", background: "var(--color-bg-surface)", padding: "8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
              <strong>Step {step.step}:</strong> {step.description}
              {step.operationRef && <div style={{ marginTop: "4px", color: "var(--color-text-muted)" }}>{step.operationRef.serviceId} / {step.operationRef.operationId}</div>}
            </div>
          ))}
        </div>
      )}

      <AssertionViewer assertions={proposal.assertions} />
      <DependencyViewer dependencies={proposal.dependencies} />

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => onApprove(proposal)} style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "#fff", background: "var(--color-success)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Approve</button>
        <button type="button" onClick={() => setEditing(true)} style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Edit</button>
        <button type="button" onClick={() => onReject(proposal)} style={{ padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "var(--color-error-text)", background: "var(--color-error-soft)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Reject</button>
      </div>

      {editing && (
        <div style={{ marginTop: "8px", padding: "12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)", display: "flex", flexDirection: "column", gap: "8px" }}>
          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }} />
          <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)", resize: "vertical" }} />
          <input type="number" value={editConfidence} onChange={(e) => setEditConfidence(Number(e.target.value))} min={0} max={1} step={0.1} style={{ padding: "8px", fontSize: "13px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", background: "var(--color-bg-surface)", color: "var(--color-text-primary)" }} />
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={handleSaveEdit} style={{ padding: "8px 12px", fontSize: "13px", fontWeight: 600, color: "#fff", background: "var(--color-primary)", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Save</button>
            <button type="button" onClick={() => setEditing(false)} style={{ padding: "8px 12px", fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function GeneratedTestReviewPanel({ result, projectId, onClear, onRefresh }: ReviewPanelProps) {
  const [proposals, setProposals] = useState<TestProposal[]>(result?.proposals || []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [warning, setWarning] = useState<string | undefined>(result?.warning || undefined);
  const [analysisLabel, setAnalysisLabel] = useState<string>("Generating executable tests...");

  useMemo(() => {
    setProposals(result?.proposals || []);
    setSelectedIds(new Set());
    setWarning(result?.warning || undefined);
    setAnalysisLabel(result && result.proposals.length > 0 ? "Generation complete" : "Generating executable tests...");
  }, [result]);

  const toggleSelected = useCallback((p: TestProposal) => {
    const key = p.title + (p.mappingId || "");
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
    else setSelectedIds(new Set(proposals.map((p) => p.title + (p.mappingId || ""))));
  };

  const handleApprove = async (p: TestProposal) => {
    if (!projectId) return;
    setSaving(true);
    setSaveError("");
    try {
      await createExecutableTest(projectId, {
        mappingId: p.mappingId,
        requirementId: p.requirementId,
        scenarioId: p.scenarioId,
        title: p.title,
        description: p.description,
        scenario: p.scenario,
        mappedApis: p.mappedApis,
        executionSteps: p.executionSteps,
        headers: p.headers,
        variables: p.variables,
        requestBody: p.requestBody,
        assertions: p.assertions,
        expectedStatusCode: p.expectedStatusCode,
        expectedResponse: p.expectedResponse,
        dependencies: p.dependencies,
        priority: p.priority,
        confidence: p.confidence,
        status: "ready",
        source: "ai-generated",
      });
      setProposals((prev) => prev.filter((x) => x.title + (x.mappingId || "") !== p.title + (p.mappingId || "")));
      onRefresh?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to create test.");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = (p: TestProposal) => {
    const key = p.title + (p.mappingId || "");
    setProposals((prev) => prev.filter((x) => x.title + (x.mappingId || "") !== key));
  };

  const handleEdit = (p: TestProposal, updates: Partial<TestProposal>) => {
    setProposals((prev) => prev.map((x) => (x.title + (x.mappingId || "") === p.title + (p.mappingId || "") ? { ...x, ...updates } : x)));
  };

  const handleApproveSelected = async () => {
    if (!projectId) return;
    setSaving(true);
    setSaveError("");
    try {
      const toApprove = proposals.filter((p) => selectedIds.has(p.title + (p.mappingId || "")));
      await Promise.all(
        toApprove.map((p) =>
          createExecutableTest(projectId, {
            mappingId: p.mappingId,
            requirementId: p.requirementId,
            scenarioId: p.scenarioId,
            title: p.title,
            description: p.description,
            scenario: p.scenario,
            mappedApis: p.mappedApis,
            executionSteps: p.executionSteps,
            headers: p.headers,
            variables: p.variables,
            requestBody: p.requestBody,
            assertions: p.assertions,
            expectedStatusCode: p.expectedStatusCode,
            expectedResponse: p.expectedResponse,
            dependencies: p.dependencies,
            priority: p.priority,
            confidence: p.confidence,
            status: "ready",
            source: "ai-generated",
          })
        )
      );
      setProposals((prev) => prev.filter((p) => !selectedIds.has(p.title + (p.mappingId || ""))));
      setSelectedIds(new Set());
      onRefresh?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to create tests.");
    } finally {
      setSaving(false);
    }
  };

  const handleRejectAll = () => {
    setProposals([]);
    setSelectedIds(new Set());
  };

  const summary = useMemo(() => {
    return {
      testsGenerated: proposals.length,
      approved: 0,
      rejected: 0,
      manualTestsRequired: 0,
      warnings: warning ? 1 : 0,
    };
  }, [proposals, warning]);

  return (
    <section style={{ marginBottom: "24px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-surface)", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
        <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)" }}>AI Generated Tests</h2>
        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--color-text-secondary)" }}>{analysisLabel}</p>
      </div>
      <div style={{ padding: "16px" }}>
        {warning && <div style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "var(--color-warning-soft)", border: "1px solid var(--color-warning)", marginBottom: "12px", fontSize: "13px", color: "var(--color-warning)" }}>{warning}</div>}
        {saveError && <div style={{ padding: "12px", borderRadius: "var(--radius-md)", background: "var(--color-error-soft)", border: "1px solid var(--color-error)", marginBottom: "12px", fontSize: "13px", color: "var(--color-error)" }}>{saveError}</div>}
        {analysisLabel.includes("Generating") && proposals.length === 0 && <div style={{ padding: "24px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>Generating executable tests...</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          {[
            { label: "Tests Generated", value: summary.testsGenerated },
            { label: "Approved", value: summary.approved },
            { label: "Rejected", value: summary.rejected },
            { label: "Manual Tests Required", value: summary.manualTestsRequired },
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
            <div style={{ marginLeft: "auto", fontSize: "12px", color: "var(--color-text-muted)" }}>{proposals.length} test{proposals.length !== 1 ? "s" : ""}</div>
          </div>
        )}

        {proposals.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
            {proposals.map((p, idx) => {
              const key = `${p.mappingId || idx}-${idx}`;
              return (
                <div key={key} style={{ position: "relative" }}>
                  <div style={{ position: "absolute", top: "8px", right: "8px", zIndex: 1 }}>
                    <input type="checkbox" checked={selectedIds.has(p.title + (p.mappingId || ""))} onChange={() => toggleSelected(p)} style={{ width: "16px", height: "16px", cursor: "pointer" }} aria-label={`Select ${p.title}`} />
                  </div>
                  <ProposalCard proposal={p} onApprove={handleApprove} onReject={handleReject} onEdit={handleEdit} />
                </div>
              );
            })}
          </div>
        )}

        {proposals.length === 0 && !analysisLabel.includes("Generating") && (
          <div style={{ padding: "32px 24px", border: "1px dashed var(--color-border-strong)", borderRadius: "var(--radius-md)", background: "var(--color-bg-subtle)", textAlign: "center" }}>
            <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: 600, color: "var(--color-text-primary)" }}>No tests generated.</p>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>Try selecting different mappings or adjust your inputs.</p>
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