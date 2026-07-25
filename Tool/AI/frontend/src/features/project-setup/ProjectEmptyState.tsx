/**
 * ProjectEmptyState
 *
 * Displayed when no projects match the current search/filter.
 */

export function ProjectEmptyState() {
  return (
    <div
      className="project-empty-state"
      role="status"
      aria-live="polite"
    >
      <div className="project-empty-state-icon" aria-hidden="true">
        No projects
      </div>
      <h3 className="project-empty-state-title">No projects found</h3>
      <p className="project-empty-state-message">
        Try adjusting your search or filter criteria.
      </p>
    </div>
  );
}
