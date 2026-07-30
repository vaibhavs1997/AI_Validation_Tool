/**
 * GeneratedTestCard
 *
 * Displays a single generated executable test proposal.
 */

import { useState } from "react";
import type { TestProposal } from "./ExecutableTestService";

interface GeneratedTestCardProps {
  proposal: TestProposal;
  onApprove: (proposal: TestProposal) => void;
  onReject: (proposal: TestProposal) => void;
  onEdit: (proposal: TestProposal, updates: Partial<TestProposal>) => void;
}

export function GeneratedTestCard({ proposal, onApprove, onReject, onEdit }: GeneratedTestCardProps) {
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