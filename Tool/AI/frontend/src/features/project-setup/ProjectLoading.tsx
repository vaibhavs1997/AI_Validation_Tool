/**
 * ProjectLoading
 *
 * Displayed while projects are being loaded.
 */

export function ProjectLoading() {
  return (
    <div
      className="project-loading"
      role="status"
      aria-live="polite"
      aria-label="Loading projects"
    >
      <div className="project-loading-spinner" aria-hidden="true" />
      <p className="project-loading-text">Loading projects...</p>
    </div>
  );
}