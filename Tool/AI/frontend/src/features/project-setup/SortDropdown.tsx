/**
 * SortDropdown
 * Themed dropdown replacing the native browser select.
 * Follows the Design System tokens.
 */

import { useState, useRef, useEffect, useCallback } from "react";

interface SortOption {
  value: string;
  label: string;
}

interface SortDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
  "aria-label"?: string;
}

export function SortDropdown({ value, onChange, options, "aria-label": ariaLabel }: SortDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label || options[0]?.label;

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleClickOutside, handleKeyDown]);

  return (
    <div ref={containerRef} style={{ position: "relative", minWidth: 0 }}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="sort-dropdown-trigger"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          maxWidth: "220px",
          height: "44px",
          padding: "0 36px 0 12px",
          fontSize: "14px",
          fontWeight: 500,
          border: "1px solid var(--color-border)",
          borderRadius: "8px",
          background: "var(--color-bg-surface)",
          color: "var(--color-text-primary)",
          cursor: "pointer",
          boxSizing: "border-box",
          transition: "border-color var(--transition-fast), box-shadow var(--transition-fast)",
          fontFamily: "inherit",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-primary)";
          e.currentTarget.style.boxShadow = "0 0 0 3px var(--color-primary-soft)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>
          {selectedLabel}
        </span>
        <span
          style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
            transition: "transform 0.15s ease",
            pointerEvents: "none",
            display: "inline-flex",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: "100%",
            maxWidth: "260px",
            background: "var(--color-bg-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            boxShadow: "var(--shadow-card)",
            zIndex: 1100,
            padding: "4px",
            margin: 0,
            listStyle: "none",
            overflow: "hidden",
          }}
        >
          {options.map((option) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                buttonRef.current?.focus();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: option.value === value ? 600 : 400,
                color: option.value === value ? "var(--color-primary)" : "var(--color-text-primary)",
                background: option.value === value ? "var(--color-primary-soft)" : "transparent",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                textAlign: "left",
                outline: "none",
                transition: "background 0.1s ease",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                if (option.value !== value) e.currentTarget.style.background = "var(--color-bg-muted)";
              }}
              onMouseLeave={(e) => {
                if (option.value !== value) e.currentTarget.style.background = "transparent";
              }}
            >
              {option.value === value && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SORT_OPTIONS: SortOption[] = [
  { value: "recently-updated", label: "Recently Updated" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "newest-created", label: "Newest Created" },
  { value: "oldest-created", label: "Oldest Created" },
];

export default SortDropdown;
export { SORT_OPTIONS };