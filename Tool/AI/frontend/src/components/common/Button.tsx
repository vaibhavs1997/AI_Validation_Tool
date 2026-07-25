/**
 * Button
 *
 * Reusable button with consistent styling and states.
 * Supports variants: primary, secondary, danger, ghost.
 * Supports sizes: sm, md, lg.
 * Includes loading spinner state.
 */

import type { ReactNode, ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: ReactNode;
  /** Visual style */
  variant?: "primary" | "secondary" | "danger" | "ghost";
  /** Button size */
  size?: "sm" | "md" | "lg";
  /** Loading spinner state */
  loading?: boolean;
  /** Accessible name (for icon buttons) */
  ariaLabel?: string;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  onClick,
  type = "button",
  className = "",
  ariaLabel,
  ...rest
}: ButtonProps) {
  const classNames = [
    "btn",
    `btn-${variant}`,
    `btn-${size}`,
    loading ? "btn-loading" : "",
    disabled ? "btn-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classNames}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      {...rest}
    >
      {loading && (
        <span className="btn-spinner" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="16"
            height="16"
            className="btn-spinner-icon"
          >
            <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" />
          </svg>
        </span>
      )}
      <span className={loading ? "btn-content-hidden" : "btn-content"}>{children}</span>
    </button>
  );
}