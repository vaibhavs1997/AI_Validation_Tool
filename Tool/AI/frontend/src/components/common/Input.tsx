/**
 * Input
 *
 * Reusable input field with label, helper text, and validation.
 * Supports default, focused, error, and disabled states.
 * Includes ARIA attributes for accessibility.
 */

import type { KeyboardEvent, FocusEvent } from "react";

export interface InputProps {
  /** Input label */
  label: string;
  /** Input value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Helper text below input */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Input type */
  type?: "text" | "email" | "password";
  /** HTML id (for label association) */
  id: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Key down handler */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** Blur handler */
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  /** ARIA describedby */
  ariaDescribedBy?: string;
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  error,
  disabled = false,
  type = "text",
  id,
  autoFocus = false,
  onKeyDown,
  onBlur,
  ariaDescribedBy,
}: InputProps) {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const describedBy = error ? errorId : helperText ? helperId : ariaDescribedBy;

  return (
    <div className={`form-field${error ? " form-field-error" : ""}`}>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={`form-input${error ? " form-input-error" : ""}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
      />
      {helperText && !error && (
        <div id={helperId} className="form-helper">
          {helperText}
        </div>
      )}
      {error && (
        <div id={errorId} className="form-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}