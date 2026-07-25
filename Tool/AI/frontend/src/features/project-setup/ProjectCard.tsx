/**
 * ProjectCard
 *
 * Displays a single project's information.
 * Supports selection via click and keyboard.
 */

import type { Project } from "../../types";

export interface ProjectCardProps {
  project: Project;
  isSelected?: boolean;
  onSelect?: (project: Project) => void;
}

export function ProjectCard({ project, isSelected = false, onSelect }: ProjectCardProps) {
  const formattedDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleClick = () => {
    onSelect?.(project);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(project);
    }
  };

  return (
    <article
      className={`project-card${isSelected ? " project-card--selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`${project.name}, project ID: ${project.id}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="project-card-header">
        <h3 className="project-card-name">
          {project.name}
        </h3>
        <code className="project-card-id">{project.id}</code>
      </div>

      <div className="project-card-dates">
        <div className="project-card-date">
          <span className="project-card-date-label">Created</span>
          <time dateTime={project.createdAt}>{formattedDate(project.createdAt)}</time>
        </div>
        <div className="project-card-date">
          <span className="project-card-date-label">Updated</span>
          <time dateTime={project.updatedAt}>{formattedDate(project.updatedAt)}</time>
        </div>
      </div>
    </article>
  );
}
