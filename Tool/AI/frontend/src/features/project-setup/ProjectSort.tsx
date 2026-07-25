/**
 * ProjectSort
 *
 * Sort selector for projects (field + direction).
 * Consumes ProjectContext for state management.
 */

import { useProjectContext } from "./ProjectContext";

export function ProjectSort() {
  const { sort, order, setSort, setOrder, loading } = useProjectContext();

  return (
    <div className="project-sort" role="group" aria-label="Sort projects">
      <label htmlFor="project-sort-field" className="project-sort-label">
        Sort by
      </label>
      <select
        id="project-sort-field"
        className="project-sort-select"
        value={sort}
        onChange={(e) => setSort(e.target.value as "id" | "name" | "createdAt" | "updatedAt")}
        disabled={loading}
        aria-label="Sort field"
      >
        <option value="id">ID</option>
        <option value="name">Name</option>
        <option value="createdAt">Created Date</option>
        <option value="updatedAt">Updated Date</option>
      </select>

      <label htmlFor="project-sort-order" className="project-sort-label">
        Direction
      </label>
      <select
        id="project-sort-order"
        className="project-sort-select"
        value={order}
        onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
        disabled={loading}
        aria-label="Sort direction"
      >
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>
    </div>
  );
}
