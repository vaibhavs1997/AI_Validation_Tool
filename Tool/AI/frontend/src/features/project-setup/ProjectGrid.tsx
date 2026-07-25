/**
 * ProjectGrid
 *
 * Displays a grid of project cards.
 */

import type { Project } from "../../types";
import { ProjectCard } from "./ProjectCard";

export interface ProjectGridProps {
  projects: Project[];
  selectedProjectId?: string | null;
  onProjectSelect?: (project: Project) => void;
}

export function ProjectGrid({ projects, selectedProjectId, onProjectSelect }: ProjectGridProps) {
  return (
    <div
      className="project-grid"
      role="list"
      aria-label={`Projects list, ${projects.length} items`}
    >
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          isSelected={selectedProjectId === project.id}
          onSelect={onProjectSelect}
        />
      ))}
    </div>
  );
}
