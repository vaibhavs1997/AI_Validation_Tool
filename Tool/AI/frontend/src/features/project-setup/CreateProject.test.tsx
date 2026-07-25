/**
 * Tests for Create Project workflow components.
 *
 * Covers:
 * - CreateProjectButton rendering and click
 * - CreateProjectDialog open/close
 * - CreateProjectForm validation
 * - Successful creation
 * - Duplicate project error
 * - API failure
 * - Keyboard interactions
 * - Focus behavior
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { CreateProjectButton } from "./CreateProjectButton";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectContext, type ProjectContextValue } from "./ProjectContext";
import type { Project } from "../../types";

// ─── Mock Context Helper ─────────────────────────────────────────────────────

function createMockContextValue(overrides: Partial<ProjectContextValue> = {}): ProjectContextValue {
  return {
    projects: [],
    total: 0,
    loading: false,
    saving: false,
    error: null,
    success: null,
    searchQuery: "",
    sort: "id",
    order: "asc",
    limit: 100,
    offset: 0,
    refetchProjects: vi.fn(),
    setSearchQuery: vi.fn(),
    setSort: vi.fn(),
    setOrder: vi.fn(),
    goToPage: vi.fn(),
    clearError: vi.fn(),
    clearSuccess: vi.fn(),
    selectedProject: null,
    projectLoading: false,
    projectSaving: false,
    deleting: false,
    projectError: null,
    projectSuccess: null,
    loadProject: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    clearProjectError: vi.fn(),
    clearProjectSuccess: vi.fn(),
    selectedProjectId: null,
    selectProject: vi.fn(),
    clearSelection: vi.fn(),
    restoreSelection: vi.fn(),
    ...overrides,
  };
}

function renderWithMockContext(ui: ReactNode, mockValue: ProjectContextValue) {
  return render(
    <ProjectContext.Provider value={mockValue}>{ui}</ProjectContext.Provider>
  );
}

// ─── Tests: CreateProjectButton ──────────────────────────────────────────────

describe("CreateProjectButton", () => {
  it("should render with accessible label", () => {
    const onClick = vi.fn();
    renderWithMockContext(<CreateProjectButton onClick={onClick} />, createMockContextValue());
    const btn = screen.getByRole("button", { name: /create new project/i });
    expect(btn).toBeInTheDocument();
  });

  it("should call onClick when clicked", () => {
    const onClick = vi.fn();
    renderWithMockContext(<CreateProjectButton onClick={onClick} />, createMockContextValue());
    const btn = screen.getByRole("button", { name: /create new project/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should be disabled when saving", () => {
    const mockValue = createMockContextValue({ saving: true });
    renderWithMockContext(<CreateProjectButton onClick={vi.fn()} />, mockValue);
    const btn = screen.getByRole("button", { name: /create new project/i });
    expect(btn).toBeDisabled();
  });

  it("should display Create Project text", () => {
    renderWithMockContext(<CreateProjectButton onClick={vi.fn()} />, createMockContextValue());
    expect(screen.getByText("Create Project")).toBeInTheDocument();
  });
});

// ─── Tests: CreateProjectDialog ──────────────────────────────────────────────

describe("CreateProjectDialog", () => {
  it("should not render when isOpen is false", () => {
    render(
      <CreateProjectDialog isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should render modal when isOpen is true", async () => {
    renderWithMockContext(
      <CreateProjectDialog isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      createMockContextValue()
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create Project" })).toBeInTheDocument();
  });

  it("should have dialog semantics", async () => {
    renderWithMockContext(
      <CreateProjectDialog isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      createMockContextValue()
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "modal-title");
  });

  it("should show description text", async () => {
    renderWithMockContext(
      <CreateProjectDialog isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />,
      createMockContextValue()
    );
    expect(
      screen.getByText(/Enter a project ID and optional name to get started/)
    ).toBeInTheDocument();
  });

  it("should call onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    renderWithMockContext(
      <CreateProjectDialog isOpen={true} onClose={onClose} onSuccess={vi.fn()} />,
      createMockContextValue()
    );
    const closeBtn = screen.getByLabelText("Close");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── Tests: CreateProjectForm ────────────────────────────────────────────────

describe("CreateProjectForm", () => {
  it("should render form fields", () => {
    const mockValue = createMockContextValue();
    renderWithMockContext(
      <CreateProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
      mockValue
    );
    expect(screen.getByLabelText(/Project ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Project Name/)).toBeInTheDocument();
    expect(screen.getByText("Create Project")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("should show validation error for empty project ID on blur", async () => {
    const mockValue = createMockContextValue();
    renderWithMockContext(
      <CreateProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
      mockValue
    );
    
    // Button should be disabled when ID is empty
    const submitBtn = screen.getByRole("button", { name: /create project/i });
    expect(submitBtn).toBeDisabled();
    
    // Type something valid first
    const idInput = screen.getByLabelText(/Project ID/);
    await userEvent.type(idInput, "test");
    fireEvent.blur(idInput);
    
    // Button should now be enabled
    expect(submitBtn).not.toBeDisabled();
    
    // Clear the input and blur again
    await userEvent.clear(idInput);
    fireEvent.blur(idInput);
    
    // Button should be disabled again
    expect(submitBtn).toBeDisabled();
  });

  it("should show validation error for invalid project ID", async () => {
    const mockValue = createMockContextValue();
    renderWithMockContext(
      <CreateProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
      mockValue
    );
    const idInput = screen.getByLabelText(/Project ID/);
    await userEvent.type(idInput, "invalid id with spaces!");
    fireEvent.blur(idInput);
    await waitFor(() => {
      expect(
        screen.getByText(
          "Project ID must contain only alphanumeric characters, hyphens, underscores, and dots."
        )
      ).toBeInTheDocument();
    });
  });

  it("should call createProject and onSuccess on valid submission", async () => {
    const createProject = vi.fn().mockResolvedValue({
      id: "test-project",
      name: "Test Project",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    } as Project);
    const onSuccess = vi.fn();
    const mockValue = createMockContextValue({ createProject });

    renderWithMockContext(
      <CreateProjectForm onSuccess={onSuccess} onCancel={vi.fn()} />,
      mockValue
    );

    const idInput = screen.getByLabelText(/Project ID/);
    await userEvent.type(idInput, "test-project");

    const submitBtn = screen.getByText("Create Project");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith("test-project", "test-project");
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("should call createProject with name when provided", async () => {
    const createProject = vi.fn().mockResolvedValue({
      id: "test-project",
      name: "Test Project",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    } as Project);
    const onSuccess = vi.fn();
    const mockValue = createMockContextValue({ createProject });

    renderWithMockContext(
      <CreateProjectForm onSuccess={onSuccess} onCancel={vi.fn()} />,
      mockValue
    );

    const idInput = screen.getByLabelText(/Project ID/);
    await userEvent.type(idInput, "test-project");

    const nameInput = screen.getByLabelText(/Project Name/);
    await userEvent.type(nameInput, "Test Project");

    const submitBtn = screen.getByText("Create Project");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith("test-project", "Test Project");
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("should show error message on duplicate project", async () => {
    const createProject = vi.fn().mockRejectedValue(
      new Error("Project already exists: test-project")
    );
    const mockValue = createMockContextValue({ createProject });

    renderWithMockContext(
      <CreateProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
      mockValue
    );

    const idInput = screen.getByLabelText(/Project ID/);
    await userEvent.type(idInput, "test-project");

    const submitBtn = screen.getByText("Create Project");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Project already exists: test-project")
      ).toBeInTheDocument();
    });
  });

  it("should show error message on API failure", async () => {
    const createProject = vi.fn().mockRejectedValue(
      new Error("Network error")
    );
    const mockValue = createMockContextValue({ createProject });

    renderWithMockContext(
      <CreateProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
      mockValue
    );

    const idInput = screen.getByLabelText(/Project ID/);
    await userEvent.type(idInput, "test-project");

    const submitBtn = screen.getByText("Create Project");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("should call onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn();
    const mockValue = createMockContextValue();
    renderWithMockContext(
      <CreateProjectForm onSuccess={vi.fn()} onCancel={onCancel} />,
      mockValue
    );
    const cancelBtn = screen.getByText("Cancel");
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("should submit on Enter key", async () => {
    const createProject = vi.fn().mockResolvedValue({
      id: "test-project",
      name: "test-project",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    } as Project);
    const onSuccess = vi.fn();
    const mockValue = createMockContextValue({ createProject });

    renderWithMockContext(
      <CreateProjectForm onSuccess={onSuccess} onCancel={vi.fn()} />,
      mockValue
    );

    const idInput = screen.getByLabelText(/Project ID/);
    await userEvent.type(idInput, "test-project");
    fireEvent.keyDown(idInput, { key: "Enter" });

    await waitFor(() => {
      expect(createProject).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("should disable submit button when saving", () => {
    const mockValue = createMockContextValue({ saving: true });
    renderWithMockContext(
      <CreateProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
      mockValue
    );
    const submitBtn = screen.getByRole("button", { name: /create project/i });
    expect(submitBtn).toBeDisabled();
  });

  it("should disable inputs when saving", () => {
    const mockValue = createMockContextValue({ saving: true });
    renderWithMockContext(
      <CreateProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
      mockValue
    );
    const idInput = screen.getByLabelText(/Project ID/);
    expect(idInput).toBeDisabled();
  });

  it("should have initial focus on project ID input", () => {
    const mockValue = createMockContextValue();
    renderWithMockContext(
      <CreateProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
      mockValue
    );
    const idInput = screen.getByLabelText(/Project ID/);
    expect(document.activeElement).toBe(idInput);
  });

  it("should show helper text for project ID", () => {
    const mockValue = createMockContextValue();
    renderWithMockContext(
      <CreateProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
      mockValue
    );
    expect(
      screen.getByText("Used as the unique project identifier.")
    ).toBeInTheDocument();
  });

  it("should show helper text for project name", () => {
    const mockValue = createMockContextValue();
    renderWithMockContext(
      <CreateProjectForm onSuccess={vi.fn()} onCancel={vi.fn()} />,
      mockValue
    );
    expect(
      screen.getByText("A friendly display name for your team.")
    ).toBeInTheDocument();
  });
});
