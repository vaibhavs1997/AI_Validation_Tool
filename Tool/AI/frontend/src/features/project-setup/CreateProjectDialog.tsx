/**
 * CreateProjectDialog
 *
 * Modal dialog for creating a new project.
 * Wraps CreateProjectForm in a Modal with proper accessibility.
 *
 * Features:
 * - Dialog semantics (role="dialog", aria-modal="true")
 * - Focus trap
 * - Escape to close
 * - Loading state (modal cannot be closed during creation)
 * - Success notification via onSuccess callback
 */

import { Modal } from "../../components/common/Modal";
import { CreateProjectForm } from "./CreateProjectForm";

interface CreateProjectDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when the dialog is closed */
  onClose: () => void;
  /** Called after successful project creation */
  onSuccess: () => void;
}

export function CreateProjectDialog({ isOpen, onClose, onSuccess }: CreateProjectDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Project"
      description="Enter a project ID and optional name to get started."
      size="md"
    >
      <CreateProjectForm
        onSuccess={onSuccess}
        onCancel={onClose}
      />
    </Modal>
  );
}