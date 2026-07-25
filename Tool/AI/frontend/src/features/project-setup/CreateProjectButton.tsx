/**
 * CreateProjectButton
 *
 * Button that triggers the Create Project dialog.
 * Uses ProjectContext to check if a creation is in progress.
 */

import { useProjectContext } from "./ProjectContext";

interface CreateProjectButtonProps {
  /** Called when the button is clicked to open the dialog */
  onClick: () => void;
}

export function CreateProjectButton({ onClick }: CreateProjectButtonProps) {
  const { saving } = useProjectContext();

  return (
    <button
      type="button"
      className="create-project-button"
      onClick={onClick}
      disabled={saving}
      aria-label="Create new project"
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
        <path d="M12 5v14M5 12h14" />
      </svg>
      Create Project
    </button>
  );
}