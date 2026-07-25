/**
 * ProjectToolbar
 *
 * Contains search and sort controls for the project dashboard.
 */

import { ProjectSearch } from "./ProjectSearch";
import { ProjectSort } from "./ProjectSort";

export function ProjectToolbar() {
  return (
    <div
      className="project-toolbar"
      role="toolbar"
      aria-label="Project dashboard toolbar"
    >
      <ProjectSearch />
      <ProjectSort />
    </div>
  );
}