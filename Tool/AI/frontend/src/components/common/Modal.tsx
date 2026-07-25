/**
 * Modal
 *
 * Reusable modal dialog for forms and confirmations.
 * Features:
 * - Focus trap
 * - Escape to close
 * - ARIA dialog semantics
 * - Overlay click to close
 * - Animation support
 */

import { useEffect, useRef, useCallback, type ReactNode } from "react";

export interface ModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Called when modal is closed */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Modal description (for accessibility) */
  description?: string;
  /** Modal width: 'sm' | 'md' | 'lg' */
  size?: "sm" | "md" | "lg";
  /** Modal content */
  children: ReactNode;
  /** Modal footer (action buttons) */
  footer?: ReactNode;
}

const SIZE_MAP: Record<string, string> = {
  sm: "400px",
  md: "520px",
  lg: "640px",
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap: keep focus within the modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusableElements = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    },
    [onClose]
  );

  // Manage focus and event listeners
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.addEventListener("keydown", handleKeyDown);

      // Focus the first focusable element in the modal
      requestAnimationFrame(() => {
        const dialog = dialogRef.current;
        if (dialog) {
          const firstFocusable = dialog.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          firstFocusable?.focus();
        }
      });
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the element that opened the modal
      if (!isOpen && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const titleId = "modal-title";
  const descriptionId = description ? "modal-description" : undefined;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`modal-dialog modal-size-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        style={{ maxWidth: SIZE_MAP[size] || SIZE_MAP.md }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="modal-close-button"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="18"
              height="18"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {description && (
          <p id={descriptionId} className="modal-description">
            {description}
          </p>
        )}

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}