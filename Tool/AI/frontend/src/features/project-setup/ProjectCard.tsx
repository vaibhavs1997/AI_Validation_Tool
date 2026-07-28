/**
 * ProjectCard
 *
 * Production-ready project card with contextual menu.
 * Displays: name, ID, created date, last updated, status, API count, requirement count, test case count.
 *
 * Reuses existing Project type from types/index.ts.
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const IconFolder = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconMoreVertical = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const IconOpen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const IconRename = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconDuplicate = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

// ─── Interface ───────────────────────────────────────────────────────────────

export interface ProjectCardData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
  apiCount?: number | null;
  requirementCount?: number | null;
  testCaseCount?: number | null;
}

interface ProjectCardProps {
  project: ProjectCardData;
  isSelected: boolean;
  onSelect: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onRename?: (projectId: string) => void;
  deleting?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (isNaN(date.getTime()) || date.getFullYear() <= 1970) return "—";
  try {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProjectCard({ project, isSelected, onSelect, onDelete, onRename, deleting }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen, handleClickOutside]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  const handleSelect = () => {
    onSelect(project.id);
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  };

  const handleMenuAction = (action: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (action === "open") {
      onSelect(project.id);
    } else if (action === "rename") {
      onRename?.(project.id);
    } else if (action === "delete") {
      onDelete(project.id);
    }
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect();
    }
  };

  const statusLabel = project.isDefault ? "Default" : "Active";
  const statusColor = project.isDefault
    ? { bg: "var(--blue-soft)", text: "var(--blue-deep)" }
    : { bg: "var(--green-soft)", text: "var(--green-deep)" };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Project ${project.name || project.id}. ${isSelected ? "Selected." : "Click to select."}`}
      aria-current={isSelected ? "true" : undefined}
      className="project-card"
      data-selected={isSelected ? "true" : undefined}
      onClick={handleSelect}
      onKeyDown={handleCardKeyDown}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0",
        padding: "0",
        borderRadius: "8px",
        border: `1px solid ${isSelected ? "var(--violet)" : "var(--color-border)"}`,
        background: isSelected ? "var(--violet-soft)" : "var(--color-bg-surface)",
        cursor: "pointer",
        outline: "none",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.15s, background 0.15s",
        minHeight: "180px",
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = "0 0 0 2px var(--violet)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Selected accent bar */}
      {isSelected && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "var(--violet)",
        }} />
      )}

      {/* Card Header */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "14px 14px 8px",
        gap: "8px",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          minWidth: 0,
          flex: 1,
        }}>
          <div style={{
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "8px",
            background: isSelected ? "var(--violet)" : "var(--surface-alt)",
            color: isSelected ? "#fff" : "var(--muted)",
            flexShrink: 0,
          }}>
            <IconFolder />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }} title={project.name || project.id}>
              {project.name || project.id}
            </div>
            <div style={{
              fontSize: "11px",
              color: "var(--muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }} title={project.id}>
              ID: {project.id}
            </div>
          </div>
        </div>

        {/* Contextual Menu */}
        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={`Project menu for ${project.name || project.id}`}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            onClick={handleMenuToggle}
            style={{
              width: "32px",
              height: "32px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid transparent",
              borderRadius: "6px",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              outline: "none",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--violet)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
          >
            <IconMoreVertical />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label={`Actions for ${project.name || project.id}`}
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                minWidth: "160px",
                background: "var(--color-bg-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.16)",
                zIndex: 1000,
                padding: "4px",
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleMenuAction("open")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "left",
                  outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onBlur={(e) => { e.currentTarget.style.background = "transparent"; }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <IconOpen /> Open
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleMenuAction("rename")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "left",
                  outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onBlur={(e) => { e.currentTarget.style.background = "transparent"; }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <IconRename /> Rename
              </button>
              <button
                type="button"
                role="menuitem"
                disabled
                aria-disabled="true"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--muted)",
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "not-allowed",
                  textAlign: "left",
                  opacity: 0.5,
                }}
              >
                <IconDuplicate /> Duplicate
              </button>
              <div style={{ height: "1px", background: "var(--color-border)", margin: "4px 0" }} />
              <button
                type="button"
                role="menuitem"
                onClick={handleMenuAction("delete")}
                disabled={deleting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "var(--red-deep)",
                  background: "transparent",
                  border: "none",
                  borderRadius: "6px",
                  cursor: deleting ? "not-allowed" : "pointer",
                  textAlign: "left",
                  outline: "none",
                  opacity: deleting ? 0.5 : 1,
                }}
                onFocus={(e) => { e.currentTarget.style.background = "var(--red-soft)"; }}
                onBlur={(e) => { e.currentTarget.style.background = "transparent"; }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--red-soft)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <IconTrash /> {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card Body — Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "0",
        padding: "8px 14px",
        flex: 1,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>{formatCount(project.apiCount)}</div>
          <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>APIs</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>{formatCount(project.requirementCount)}</div>
          <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Reqts</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>{formatCount(project.testCaseCount)}</div>
          <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Tests</div>
        </div>
      </div>

      {/* Card Footer */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 14px 10px",
        borderTop: "1px solid var(--color-border)",
        fontSize: "11px",
        color: "var(--muted)",
        gap: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "3px",
            padding: "1px 6px",
            borderRadius: "4px",
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            background: statusColor.bg,
            color: statusColor.text,
          }}>
            {project.isDefault && <IconCheck />}
            {statusLabel}
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
          <span title={`Created: ${formatDate(project.createdAt)}`}>
            {formatDate(project.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Card ───────────────────────────────────────────────────────────

export function ProjectCardSkeleton() {
  return (
    <div
      aria-label="Loading project card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0",
        padding: "0",
        borderRadius: "8px",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-surface)",
        minHeight: "180px",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 14px 8px", display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "8px",
          background: "var(--surface-alt)", flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{
            width: "60%", height: "14px", borderRadius: "4px",
            background: "var(--surface-alt)", marginBottom: "6px",
          }} />
          <div style={{
            width: "40%", height: "11px", borderRadius: "4px",
            background: "var(--surface-alt)",
          }} />
        </div>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0",
        padding: "8px 14px", flex: 1,
      }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{
              width: "24px", height: "16px", borderRadius: "4px",
              background: "var(--surface-alt)", margin: "0 auto 4px",
            }} />
            <div style={{
              width: "32px", height: "10px", borderRadius: "4px",
              background: "var(--surface-alt)", margin: "0 auto",
            }} />
          </div>
        ))}
      </div>
      <div style={{
        padding: "8px 14px 10px", borderTop: "1px solid var(--color-border)",
        display: "flex", justifyContent: "space-between",
      }}>
        <div style={{
          width: "50px", height: "11px", borderRadius: "4px",
          background: "var(--surface-alt)",
        }} />
        <div style={{
          width: "70px", height: "11px", borderRadius: "4px",
          background: "var(--surface-alt)",
        }} />
      </div>
    </div>
  );
}