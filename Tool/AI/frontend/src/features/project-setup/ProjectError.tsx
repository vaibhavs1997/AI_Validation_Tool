/**
 * ProjectError
 *
 * Displayed when an error occurs while loading projects.
 */

export interface ProjectErrorProps {
  message: string;
  onRetry?: () => void;
}

export function ProjectError({ message, onRetry }: ProjectErrorProps) {
  return (
    <div
      className="project-error"
      role="alert"
      aria-live="assertive"
    >
      <div className="project-error-icon" aria-hidden="true">
        Error
      </div>
      <h3 className="project-error-title">Something went wrong</h3>
      <p className="project-error-message">{message}</p>
      {onRetry && (
        <button
          type="button"
          className="project-error-retry"
          onClick={onRetry}
          aria-label="Retry loading projects"
        >
          Try again
        </button>
      )}
    </div>
  );
}
