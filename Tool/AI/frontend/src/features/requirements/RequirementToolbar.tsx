/**
 * RequirementToolbar
 *
 * Search and sort controls for the Requirement Library.
 */

import { useState } from "react";

interface RequirementToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortField: string;
  onSortChange: (field: string) => void;
  sortOrder: string;
  onOrderChange: (order: string) => void;
  totalCount: number;
}

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const SORT_OPTIONS = [
  { value: "updatedAt", label: "Last Updated" },
  { value: "createdAt", label: "Created Date" },
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
];

export function RequirementToolbar({
  searchQuery,
  onSearchChange,
  sortField,
  onSortChange,
  sortOrder,
  onOrderChange,
  totalCount,
}: RequirementToolbarProps) {
  const [isSortOpen, setIsSortOpen] = useState(false);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      flexWrap: "wrap",
    }}>
      {/* Search */}
      <div style={{
        position: "relative",
        flex: "1 1 240px",
        minWidth: 0,
      }}>
        <span style={{
          position: "absolute",
          left: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--color-text-muted)",
          display: "flex",
          pointerEvents: "none",
        }}>
          <IconSearch />
        </span>
        <input
          type="search"
          placeholder="Search requirements..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search requirements"
          style={{
            width: "100%",
            height: "36px",
            padding: "0 12px 0 34px",
            fontSize: "13px",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-bg-surface)",
            color: "var(--color-text-primary)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Sort */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setIsSortOpen(!isSortOpen)}
          aria-haspopup="listbox"
          aria-expanded={isSortOpen}
          style={{
            height: "36px",
            padding: "0 12px",
            fontSize: "13px",
            fontWeight: 600,
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-bg-surface)",
            color: "var(--color-text-primary)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
          }}
        >
          Sort: {SORT_OPTIONS.find((o) => o.value === sortField)?.label || "Last Updated"}
          <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
            {sortOrder === "desc" ? "↓" : "↑"}
          </span>
        </button>

        {isSortOpen && (
          <>
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9,
              }}
              onClick={() => setIsSortOpen(false)}
            />
            <div
              role="listbox"
              aria-label="Sort options"
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "4px",
                minWidth: "180px",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-bg-surface)",
                boxShadow: "var(--shadow-md)",
                zIndex: 10,
                overflow: "hidden",
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={sortField === option.value}
                  onClick={() => {
                    if (sortField === option.value) {
                      onOrderChange(sortOrder === "desc" ? "asc" : "desc");
                    } else {
                      onSortChange(option.value);
                      onOrderChange("desc");
                    }
                    setIsSortOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px 14px",
                    fontSize: "13px",
                    textAlign: "left",
                    background: sortField === option.value ? "var(--color-primary-soft)" : "transparent",
                    color: "var(--color-text-primary)",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: sortField === option.value ? 600 : 400,
                  }}
                >
                  {option.label}
                  {sortField === option.value && (
                    <span style={{ marginLeft: "8px", color: "var(--color-text-muted)" }}>
                      {sortOrder === "desc" ? "↓" : "↑"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Count */}
      <span style={{
        fontSize: "12px",
        color: "var(--color-text-muted)",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}>
        {totalCount} {totalCount === 1 ? "requirement" : "requirements"}
      </span>
    </div>
  );
}