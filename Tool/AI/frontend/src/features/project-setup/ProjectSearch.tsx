/**
 * ProjectSearch
 *
 * Search input for filtering projects by ID or name.
 * Consumes ProjectContext for state management.
 */

import { useProjectContext } from "./ProjectContext";

export function ProjectSearch() {
  const { searchQuery, setSearchQuery, loading } = useProjectContext();

  return (
    <div className="project-search" role="search">
      <label htmlFor="project-search-input" className="project-search-label">
        Search projects
      </label>
      <input
        id="project-search-input"
        type="search"
        className="project-search-input"
        placeholder="Search by project ID or name..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        disabled={loading}
        aria-label="Search projects by ID or name"
        aria-disabled={loading}
      />
    </div>
  );
}
