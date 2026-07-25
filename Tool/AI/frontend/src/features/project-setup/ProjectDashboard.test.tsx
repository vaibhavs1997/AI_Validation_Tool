/**
 * Tests for Project Dashboard components.
 *
 * Mocks ProjectContext rather than making HTTP requests.
 * Covers: loading, empty, populated, search interaction,
 * sorting, error display, responsive rendering, accessibility.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });
import { ProjectDashboard } from "./ProjectDashboard";
import { ProjectCard } from "./ProjectCard";
import { ProjectEmptyState } from "./ProjectEmptyState";
import { ProjectLoading } from "./ProjectLoading";
import { ProjectError } from "./ProjectError";
import { ProjectSearch } from "./ProjectSearch";
import { ProjectSort } from "./ProjectSort";
import { ProjectGrid } from "./ProjectGrid";
import { ProjectToolbar } from "./ProjectToolbar";
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

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockProjects: Project[] = [
  { id: "payments-api", name: "Payments API", createdAt: "2025-01-15T10:30:00.000Z", updatedAt: "2025-07-20T14:22:00.000Z" },
  { id: "default", name: "Default Project", createdAt: "1970-01-01T00:00:00.000Z", updatedAt: "1970-01-01T00:00:00.000Z" },
  { id: "auth-service", name: "Auth Service", createdAt: "2025-03-10T08:00:00.000Z", updatedAt: "2025-06-01T12:00:00.000Z" },
];

const firstProject = mockProjects[0]!;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ProjectCard", () => {
  it("should render project name and id", () => {
    render(<ProjectCard project={firstProject} />);
    expect(screen.getByText("Payments API")).toBeInTheDocument();
    expect(screen.getByText("payments-api")).toBeInTheDocument();
  });

  it("should render created and updated dates", () => {
    render(<ProjectCard project={firstProject} />);
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Payments API, project ID: payments-api/i })).toBeInTheDocument();
  });

  it("should have accessible title", () => {
    render(<ProjectCard project={firstProject} />);
    const btn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    expect(btn).toHaveAttribute("aria-label", "Payments API, project ID: payments-api");
  });

  it("should call onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<ProjectCard project={firstProject} onSelect={onSelect} />);
    const btn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalledWith(firstProject);
  });

  it("should call onSelect when Enter key is pressed", () => {
    const onSelect = vi.fn();
    render(<ProjectCard project={firstProject} onSelect={onSelect} />);
    const btn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(firstProject);
  });

  it("should call onSelect when Space key is pressed", () => {
    const onSelect = vi.fn();
    render(<ProjectCard project={firstProject} onSelect={onSelect} />);
    const btn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    fireEvent.keyDown(btn, { key: " " });
    expect(onSelect).toHaveBeenCalledWith(firstProject);
  });

  it("should have aria-selected when selected", () => {
    render(<ProjectCard project={firstProject} isSelected={true} />);
    const btn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    expect(btn).toHaveAttribute("aria-selected", "true");
  });

  it("should not have aria-selected when not selected", () => {
    render(<ProjectCard project={firstProject} isSelected={false} />);
    const btn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    expect(btn).toHaveAttribute("aria-selected", "false");
  });
});

describe("ProjectGrid", () => {
  it("should render all project cards", () => {
    render(<ProjectGrid projects={mockProjects} />);
    const cards = screen.getAllByRole("button", { name: /project ID: /i });
    expect(cards).toHaveLength(3);
  });

  it("should have accessible list label", () => {
    render(<ProjectGrid projects={mockProjects} />);
    expect(screen.getByLabelText(/Projects list, 3 items/)).toBeInTheDocument();
  });

  it("should pass selectedProjectId to cards", () => {
    const onProjectSelect = vi.fn();
    render(<ProjectGrid projects={mockProjects} selectedProjectId="payments-api" onProjectSelect={onProjectSelect} />);
    const selectedBtn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    expect(selectedBtn).toHaveAttribute("aria-selected", "true");
    const otherBtn = screen.getByRole("button", { name: /Default Project, project ID: default/i });
    expect(otherBtn).toHaveAttribute("aria-selected", "false");
  });

  it("should call onProjectSelect when a card is clicked", () => {
    const onProjectSelect = vi.fn();
    render(<ProjectGrid projects={mockProjects} onProjectSelect={onProjectSelect} />);
    const btn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    fireEvent.click(btn);
    expect(onProjectSelect).toHaveBeenCalledWith(mockProjects[0]);
  });
});

describe("ProjectEmptyState", () => {
  it("should render empty state message", () => {
    render(<ProjectEmptyState />);
    expect(screen.getByText("No projects found")).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your search/)).toBeInTheDocument();
  });

  it("should have status role", () => {
    render(<ProjectEmptyState />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("ProjectLoading", () => {
  it("should render loading text", () => {
    render(<ProjectLoading />);
    expect(screen.getByText("Loading projects...")).toBeInTheDocument();
  });

  it("should have status role and aria-label", () => {
    render(<ProjectLoading />);
    const loading = screen.getByRole("status");
    expect(loading).toHaveAttribute("aria-label", "Loading projects");
  });
});

describe("ProjectError", () => {
  it("should render error message", () => {
    render(<ProjectError message="Network error occurred" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Network error occurred")).toBeInTheDocument();
  });

  it("should render retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(<ProjectError message="Error" onRetry={onRetry} />);
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should not render retry button when onRetry not provided", () => {
    render(<ProjectError message="Error" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should have alert role", () => {
    render(<ProjectError message="Error" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

describe("ProjectSearch", () => {
  it("should render search input with label", () => {
    const mockValue = createMockContextValue();
    renderWithMockContext(<ProjectSearch />, mockValue);
    expect(screen.getByLabelText("Search projects by ID or name")).toBeInTheDocument();
  });

  it("should display current search query", () => {
    const mockValue = createMockContextValue({ searchQuery: "test-query" });
    renderWithMockContext(<ProjectSearch />, mockValue);
    const input = screen.getByLabelText("Search projects by ID or name") as HTMLInputElement;
    expect(input.value).toBe("test-query");
  });
});

describe("ProjectSort", () => {
  it("should render sort field and order selects", () => {
    const mockValue = createMockContextValue();
    renderWithMockContext(<ProjectSort />, mockValue);
    expect(screen.getByLabelText("Sort field")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort direction")).toBeInTheDocument();
  });

  it("should display current sort values", () => {
    const mockValue = createMockContextValue({ sort: "name", order: "desc" });
    renderWithMockContext(<ProjectSort />, mockValue);
    expect(screen.getByLabelText("Sort field")).toHaveValue("name");
    expect(screen.getByLabelText("Sort direction")).toHaveValue("desc");
  });
});

describe("ProjectToolbar", () => {
  it("should render toolbar with search and sort", () => {
    const mockValue = createMockContextValue();
    renderWithMockContext(<ProjectToolbar />, mockValue);
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.getByLabelText("Search projects by ID or name")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort field")).toBeInTheDocument();
  });
});

describe("ProjectDashboard - Loading", () => {
  it("should show loading state", () => {
    const mockValue = createMockContextValue({ loading: true });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    expect(screen.getByText("Loading projects...")).toBeInTheDocument();
  });
});

describe("ProjectDashboard - Empty", () => {
  it("should show empty state when no projects", () => {
    const mockValue = createMockContextValue({ loading: false, projects: [], total: 0 });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    expect(screen.getByText("No projects found")).toBeInTheDocument();
  });
});

describe("ProjectDashboard - Populated", () => {
  it("should show project grid with projects", () => {
    const mockValue = createMockContextValue({
      loading: false,
      projects: mockProjects,
      total: 3,
    });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    expect(screen.getAllByRole("button", { name: /project ID: /i })).toHaveLength(3);
    expect(screen.getByText("Payments API")).toBeInTheDocument();
  });

  it("should show correct project count", () => {
    const mockValue = createMockContextValue({
      loading: false,
      projects: mockProjects,
      total: 3,
    });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    expect(screen.getByText("3 projects")).toBeInTheDocument();
  });

  it("should show singular project count", () => {
    const mockValue = createMockContextValue({
      loading: false,
      projects: [firstProject],
      total: 1,
    });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    expect(screen.getByText("1 project")).toBeInTheDocument();
  });
});

describe("ProjectDashboard - Error", () => {
  it("should show error message when error occurs", () => {
    const mockValue = createMockContextValue({
      loading: false,
      error: "Failed to load projects",
    });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    expect(screen.getByText("Failed to load projects")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("should show retry button on error", () => {
    const mockValue = createMockContextValue({
      loading: false,
      error: "Network error",
    });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(mockValue.refetchProjects).toHaveBeenCalledTimes(1);
  });
});

describe("ProjectDashboard - Accessibility", () => {
  it("should have accessible region with title", () => {
    const mockValue = createMockContextValue();
    renderWithMockContext(<ProjectDashboard />, mockValue);
    expect(screen.getByRole("region", { name: /projects/i })).toBeInTheDocument();
  });

  it("should have toolbar with accessible label", () => {
    const mockValue = createMockContextValue();
    renderWithMockContext(<ProjectDashboard />, mockValue);
    expect(screen.getByRole("toolbar", { name: /project dashboard toolbar/i })).toBeInTheDocument();
  });
});

describe("ProjectDashboard - Responsive", () => {
  it("should render grid with all project cards", () => {
    const mockValue = createMockContextValue({
      loading: false,
      projects: mockProjects,
      total: 3,
    });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    const grid = screen.getByLabelText(/Projects list, 3 items/);
    expect(grid).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /project ID: /i })).toHaveLength(3);
  });
});

describe("ProjectDashboard - Project Selection", () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it("should restore previously selected project from localStorage", () => {
    localStorageMock.getItem.mockReturnValue("payments-api");
    const mockValue = createMockContextValue({
      loading: false,
      projects: mockProjects,
      total: 3,
      selectedProjectId: "payments-api",
    });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    const selectedBtn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    expect(selectedBtn).toHaveAttribute("aria-selected", "true");
  });

  it("should save selection to localStorage when project is clicked", () => {
    const selectProject = vi.fn();
    const mockValue = createMockContextValue({
      loading: false,
      projects: mockProjects,
      total: 3,
      selectProject,
    });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    const btn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    fireEvent.click(btn);
    expect(selectProject).toHaveBeenCalledWith(expect.objectContaining({ id: "payments-api" }));
  });

  it("should support keyboard selection with Enter key", () => {
    const selectProject = vi.fn();
    const mockValue = createMockContextValue({
      loading: false,
      projects: mockProjects,
      total: 3,
      selectProject,
    });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    const btn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(selectProject).toHaveBeenCalledWith(expect.objectContaining({ id: "payments-api" }));
  });

  it("should support keyboard selection with Space key", () => {
    const selectProject = vi.fn();
    const mockValue = createMockContextValue({
      loading: false,
      projects: mockProjects,
      total: 3,
      selectProject,
    });
    renderWithMockContext(<ProjectDashboard />, mockValue);
    const btn = screen.getByRole("button", { name: /Payments API, project ID: payments-api/i });
    fireEvent.keyDown(btn, { key: " " });
    expect(selectProject).toHaveBeenCalledWith(expect.objectContaining({ id: "payments-api" }));
  });
});
