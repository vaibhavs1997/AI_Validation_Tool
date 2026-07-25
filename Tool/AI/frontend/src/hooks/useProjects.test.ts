/**
 * Tests for useProjects hook.
 *
 * Mocks ProjectService rather than making HTTP requests.
 * Covers: initial state, loading, successful operations, API failures,
 * search state, pagination state.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useProjects } from "./useProjects";
import type { Project, ListProjectsResponse } from "../types";

// Mock the entire ProjectService module
vi.mock("../features/project-setup/ProjectService", () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  getProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  searchProjects: vi.fn(),
}));

import * as ProjectService from "../features/project-setup/ProjectService";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockProjects: Project[] = [
  { id: "project-a", name: "Project A", createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-06-01T00:00:00.000Z" },
  { id: "project-b", name: "Project B", createdAt: "2025-02-01T00:00:00.000Z", updatedAt: "2025-06-15T00:00:00.000Z" },
  { id: "default", name: "Default Project", createdAt: "1970-01-01T00:00:00.000Z", updatedAt: "1970-01-01T00:00:00.000Z" },
];

const mockListResponse: ListProjectsResponse = {
  projects: mockProjects,
  total: 3,
  limit: 100,
  offset: 0,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useProjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial State ───────────────────────────────────────────────────────

  describe("initial state", () => {
    it("should start with empty projects and zero total", async () => {
      // Use a promise that never resolves so the useEffect fetch never completes.
      // This lets us observe the initial state before the fetch callback runs.
      const mockPromise = new Promise<ListProjectsResponse>(() => {});
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockReturnValue(mockPromise);

      const { result } = renderHook(() => useProjects());

      // At this point, the component has mounted and the effect has fired,
      // setting loading = true. We can verify the rest of the initial state.
      const [state] = result.current;
      expect(state.projects).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.saving).toBe(false);
      expect(state.error).toBeNull();
      expect(state.success).toBeNull();
      expect(state.searchQuery).toBe("");
      expect(state.sort).toBe("id");
      expect(state.order).toBe("asc");
      expect(state.limit).toBe(100);
      expect(state.offset).toBe(0);
    });
  });

  // ── Loading State ────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("should set loading true while fetching", async () => {
      // Return a promise that doesn't resolve immediately
      const mockPromise = new Promise<ListProjectsResponse>(() => {});
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockReturnValue(mockPromise);

      const { result } = renderHook(() => useProjects());

      // After mount, loading should be true
      expect(result.current[0].loading).toBe(true);
    });

    it("should set loading false after successful fetch", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));
      expect(result.current[0].projects).toHaveLength(3);
    });
  });

  // ── Successful Operations ───────────────────────────────────────────────

  describe("successful operations", () => {
    it("should load projects on mount", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].projects).toHaveLength(3));
      expect(result.current[0].projects[0]?.id).toBe("project-a");
      expect(result.current[0].total).toBe(3);
    });

    it("should create a project successfully", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);
      const newProject: Project = { id: "new-proj", name: "New Project", createdAt: "2025-07-01T00:00:00.000Z", updatedAt: "2025-07-01T00:00:00.000Z" };
      (ProjectService.createProject as ReturnType<typeof vi.fn>).mockResolvedValue(newProject);

      const { result } = renderHook(() => useProjects());

      // Wait for initial load
      await waitFor(() => expect(result.current[0].loading).toBe(false));

      // Create project
      let created: Project | undefined;
      await act(async () => {
        created = await result.current[1].createProject("new-proj", "New Project");
      });
      expect(created?.id).toBe("new-proj");
      expect(result.current[0].saving).toBe(false);
      expect(result.current[0].success).toContain("created successfully");
    });

    it("should refetch after successful create", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);
      (ProjectService.createProject as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "new-proj", name: "New Project", createdAt: "2025-07-01T00:00:00.000Z", updatedAt: "2025-07-01T00:00:00.000Z",
      });

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));

      await act(async () => {
        await result.current[1].createProject("new-proj", "New Project");
      });

      // Should have called listProjects again after create
      expect(ProjectService.listProjects).toHaveBeenCalledTimes(2);
    });

    it("should refetch when refetch is called", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));
      expect(ProjectService.listProjects).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current[1].refetch();
      });

      expect(ProjectService.listProjects).toHaveBeenCalledTimes(2);
    });
  });

  // ── API Failures ────────────────────────────────────────────────────────

  describe("API failures", () => {
    it("should set error on list failure", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Failed to load projects"));

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].error).toBe("Failed to load projects"));
      expect(result.current[0].loading).toBe(false);
      expect(result.current[0].projects).toEqual([]);
    });

    it("should set error on create failure", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);
      (ProjectService.createProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Project already exists"));

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));

      await act(async () => {
        try {
          await result.current[1].createProject("dup", "Duplicate");
        } catch {
          // expected
        }
      });

      expect(result.current[0].error).toBe("Project already exists");
      expect(result.current[0].saving).toBe(false);
    });

    it("should clear error when clearError is called", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Failed"));

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].error).toBe("Failed"));

      act(() => {
        result.current[1].clearError();
      });

      expect(result.current[0].error).toBeNull();
    });

    it("should clear success when clearSuccess is called", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);
      (ProjectService.createProject as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "x", name: "X", createdAt: "", updatedAt: "",
      });

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));

      await act(async () => {
        await result.current[1].createProject("x", "X");
      });

      expect(result.current[0].success).toBeTruthy();

      act(() => {
        result.current[1].clearSuccess();
      });

      expect(result.current[0].success).toBeNull();
    });
  });

  // ── Search State ────────────────────────────────────────────────────────

  describe("search state", () => {
    it("should set search query and reset offset", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));

      act(() => {
        result.current[1].setSearchQuery("test-query");
      });

      expect(result.current[0].searchQuery).toBe("test-query");
      expect(result.current[0].offset).toBe(0);
    });

    it("should fetch with search parameter after debounce", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));

      act(() => {
        result.current[1].setSearchQuery("search-term");
      });

      // After debounce (300ms), listProjects should have been called with search
      await waitFor(() => {
        const lastCallOptions = (ProjectService.listProjects as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
        expect(lastCallOptions?.search).toBe("search-term");
      }, { timeout: 500 });
    });
  });

  // ── Pagination State ────────────────────────────────────────────────────

  describe("pagination state", () => {
    it("should go to a specific page", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));

      act(() => {
        result.current[1].goToPage(2);
      });

      expect(result.current[0].offset).toBe(100);
    });

    it("should not set negative offset", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));

      act(() => {
        result.current[1].goToPage(0);
      });

      expect(result.current[0].offset).toBe(0);
    });

    it("should reset offset when sort changes", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));

      // Set offset to some value
      act(() => { result.current[1].goToPage(2); });
      expect(result.current[0].offset).toBe(100);

      // Changing sort should reset offset
      act(() => { result.current[1].setSort("name"); });
      expect(result.current[0].offset).toBe(0);
    });

    it("should set sort field", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));

      act(() => { result.current[1].setSort("name"); });
      expect(result.current[0].sort).toBe("name");
    });

    it("should set order", async () => {
      (ProjectService.listProjects as ReturnType<typeof vi.fn>).mockResolvedValue(mockListResponse);

      const { result } = renderHook(() => useProjects());

      await waitFor(() => expect(result.current[0].loading).toBe(false));

      act(() => { result.current[1].setOrder("desc"); });
      expect(result.current[0].order).toBe("desc");
    });
  });
});