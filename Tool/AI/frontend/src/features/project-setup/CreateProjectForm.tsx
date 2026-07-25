/**
 * CreateProjectForm
 *
 * Form for creating a new project.
 * Contains Project ID and optional Project Name fields with validation.
 * Uses ProjectContext for creation - does NOT call ProjectService directly.
 *
 * Features:
 * - Real-time validation on Project ID
 * - Validation on blur
 * - Loading state during creation
 * - Enter to submit
 * - Initial focus on Project ID
 * - Error handling (inline + duplicate)
 */

import { useState, useEffect, useCallback } from "react";
import { validateProjectId, validateProjectName } from "../../utils/validators";
import { useProjectContext } from "./ProjectContext";
import { Input } from "../../components/common/Input";
import { Button } from "../../components/common/Button";

interface CreateProjectFormProps {
  /** Called when the dialog should close after successful creation */
  onSuccess: () => void;
  /** Called when the form wants to close (cancel) */
  onCancel: () => void;
}

export function CreateProjectForm({ onSuccess, onCancel }: CreateProjectFormProps) {
  const { createProject, saving, error, clearError } = useProjectContext();

  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [idError, setIdError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Clear context error when form values change
  useEffect(() => {
    if (error) clearError();
  }, [projectId, projectName, error, clearError]);

  const handleIdChange = useCallback((value: string) => {
    setProjectId(value);
    setSubmitError(null);
    if (value) {
      const errorMsg = validateProjectId(value);
      setIdError(errorMsg);
    } else {
      setIdError(null);
    }
  }, []);

  const handleIdBlur = useCallback(
    (_e: React.FocusEvent<HTMLInputElement>) => {
      if (projectId) {
        const errorMsg = validateProjectId(projectId);
        setIdError(errorMsg);
      }
    },
    [projectId]
  );

  const handleNameChange = useCallback((value: string) => {
    setProjectName(value);
    const errorMsg = validateProjectName(value);
    setNameError(errorMsg);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedId = projectId.trim();
    const trimmedName = projectName.trim();

    // Validate all fields
    const idValidationError = validateProjectId(trimmedId);
    const nameValidationError = validateProjectName(trimmedName);

    setIdError(idValidationError);
    setNameError(nameValidationError);

    if (idValidationError || nameValidationError) {
      return;
    }

    const name = trimmedName || trimmedId;

    try {
      await createProject(trimmedId, name);
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { error?: string })?.error || "Failed to create project.";
      setSubmitError(message);
    }
  }, [projectId, projectName, createProject, onSuccess]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!saving) {
          handleSubmit();
        }
      }
    },
    [saving, handleSubmit]
  );

  const isIdValid = projectId.trim().length > 0 && !idError;
  const canSubmit = isIdValid && !saving;

  return (
    <div className="create-project-form">
      <Input
        id="create-project-id"
        label="Project ID"
        placeholder="e.g. payments-api"
        value={projectId}
        onChange={handleIdChange}
        onBlur={handleIdBlur}
        error={idError || undefined}
        helperText="Used as the unique project identifier."
        disabled={saving}
        autoFocus
        onKeyDown={handleKeyDown}
      />

      <Input
        id="create-project-name"
        label="Project Name (Optional)"
        placeholder="e.g. Payments API"
        value={projectName}
        onChange={handleNameChange}
        error={nameError || undefined}
        helperText="A friendly display name for your team."
        disabled={saving}
        onKeyDown={handleKeyDown}
      />

      {submitError && (
        <div className="form-submit-error" role="alert">
          {submitError}
        </div>
      )}

      <div className="create-project-actions">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={saving}
        >
          Create Project
        </Button>
      </div>
    </div>
  );
}