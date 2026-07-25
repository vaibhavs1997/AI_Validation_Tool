/**
 * Tests for useProject hook.
 *
 * Mocks ProjectService rather than making HTTP requests.
 * Covers: initial state, loading, successful operations, API failures,
 * update state, delete state, refresh behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProject } from "./useProject";
import type { Project, DeleteProjectResponse } from "../types";

// Mock the entire ProjectService module
vi.mock("../features/project-setup/ProjectService", () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  listProjects: vi.fn(),
  createProject: vi.fn(),
  searchProjects: vi.fn(),
}));

import * as ProjectService from "../features/project-setup/ProjectService";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockProject: Project = {
  id: "payments-api",
  name: "Payments API",
  createdAt: "2025-01-15T10:30:00.000Z",
  updatedAt: "2025-07-20T14:22:00.000Z",
};

const mockDeleteResponse: DeleteProjectResponse = {
  success: true,
  message: "Project deleted successfully",
  id: "payments-api",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial State ───────────────────────────────────────────────────────

  describe("initial state", () => {
    it("should start with null project and no loading", () => {
      const { result } = renderHook(() => useProject());
      const [state] = result.current;

      expect(state.project).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.saving).toBe(false);
      expect(state.deleting).toBe(false);
      expect(state.error).toBeNull();
      expect(state.success).toBeNull();
    });
  });

  // ── Loading State ────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("should set loading true while fetching", async () => {
      const mockPromise = new Promise<Project>(() => {});
      (ProjectService.getProject as ReturnType<typeof vi.fn>).mockReturnValue(mockPromise);

      const { result } = renderHook(() => useProject());

      act(() => {
        result.current[1].loadProject("test-id");
      });

      expect(result.current[0].loading).toBe(true);
    });

    it("should set loading false after successful load", async () => {
      (ProjectService.getProject as ReturnType<typeof vi.fn>).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useProject());

      await act(async () => {
        await result.current[1].loadProject("payments-api");
      });

      expect(result.current[0].loading).toBe(false);
      expect(result.current[0].project?.id).toBe("payments-api");
    });
  });

  // ── Successful Operations ───────────────────────────────────────────────

  describe("successful operations", () => {
    it("should load a project by ID", async () => {
      (ProjectService.getProject as ReturnType<typeof vi.fn>).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useProject());

      await act(async () => {
        await result.current[1].loadProject("payments-api");
      });

      expect(result.current[0].project).toEqual(mockProject);
      expect(ProjectService.getProject).toHaveBeenCalledWith("payments-api");
    });

    it("should update a project name", async () => {
      const updatedProject: Project = { ...mockProject, name: "Updated Name", updatedAt: "2025-07-25T00:00:00.000Z" };
      (ProjectService.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(updatedProject);

      const { result } = renderHook(() => useProject());

      let returned: Project | undefined;
      await act(async () => {
        returned = await result.current[1].updateProject("payments-api", { name: "Updated Name" });
      });

      expect(returned?.name).toBe("Updated Name");
      expect(result.current[0].project?.name).toBe("Updated Name");
      expect(result.current[0].saving).toBe(false);
      expect(result.current[0].success).toContain("renamed");
    });

    it("should delete a project", async () => {
      (ProjectService.deleteProject as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeleteResponse);

      const { result } = renderHook(() => useProject());

      let returned: DeleteProjectResponse | undefined;
      await act(async () => {
        returned = await result.current[1].deleteProject("payments-api");
      });

      expect(returned?.success).toBe(true);
      expect(result.current[0].project).toBeNull();
      expect(result.current[0].deleting).toBe(false);
      expect(result.current[0].success).toContain("deleted successfully");
    });
  });

  // ── API Failures ────────────────────────────────────────────────────────

  describe("API failures", () => {
    it("should set error on load failure", async () => {
      (ProjectService.getProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Project not found"));

      const { result } = renderHook(() => useProject());

      await act(async () => {
        try {
          await result.current[1].loadProject("missing");
        } catch {
          // expected
        }
      });

      expect(result.current[0].error).toBe("Project not found");
      expect(result.current[0].loading).toBe(false);
    });

    it("should set error on update failure", async () => {
      (ProjectService.updateProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Project not found: missing"));

      const { result } = renderHook(() => useProject());

      await act(async () => {
        try {
          await result.current[1].updateProject("missing", { name: "x" });
        } catch {
          // expected
        }
      });

      expect(result.current[0].error).toBe("Project not found: missing");
      expect(result.current[0].saving).toBe(false);
    });

    it("should set error on delete failure", async () => {
      (ProjectService.deleteProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Cannot delete the default project"));

      const { result } = renderHook(() => useProject());

      await act(async () => {
        try {
          await result.current[1].deleteProject("default");
        } catch {
          // expected
        }
      });

      expect(result.current[0].error).toBe("Cannot delete the default project");
      expect(result.current[0].deleting).toBe(false);
    });

    it("should clear error when clearError is called", async () => {
      (ProjectService.getProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Error"));

      const { result } = renderHook(() => useProject());

      await act(async () => {
        try {
          await result.current[1].loadProject("x");
        } catch {
          // expected
        }
      });

      expect(result.current[0].error).toBe("Error");

      act(() => {
        result.current[1].clearError();
      });

      expect(result.current[0].error).toBeNull();
    });

    it("should clear success when clearSuccess is called", async () => {
      (ProjectService.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(mockProject);

      const { result } = renderHook(() => useProject());

      await act(async () => {
        await result.current[1].updateProject("test", { name: "New" });
      });

      expect(result.current[0].success).toBeTruthy();

      act(() => {
        result.current[1].clearSuccess();
      });

      expect(result.current[0].success).toBeNull();
    });
  });

  // ── Update State ────────────────────────────────────────────────────────

  describe("update state", () => {
    it("should set saving true during update", async () => {
      const mockPromise = new Promise<Project>(() => {});
      (ProjectService.updateProject as ReturnType<typeof vi.fn>).mockReturnValue(mockPromise);

      const { result } = renderHook(() => useProject());

      act(() => {
        result.current[1].updateProject("test", { name: "New" });
      });

      expect(result.current[0].saving).toBe(true);
    });

    it("should update the project in state after successful update", async () => {
      const original: Project = { ...mockProject, name: "Original" };
      const updated: Project = { ...mockProject, name: "Updated" };
      (ProjectService.getProject as ReturnType<typeof vi.fn>).mockResolvedValue(original);
      (ProjectService.updateProject as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const { result } = renderHook(() => useProject());

      // Load first
      await act(async () => {
        await result.current[1].loadProject("payments-api");
      });
      expect(result.current[0].project?.name).toBe("Original");

      // Then update
      await act(async () => {
        await result.current[1].updateProject("payments-api", { name: "Updated" });
      });
      expect(result.current[0].project?.name).toBe("Updated");
    });
  });

  // ── Delete State ────────────────────────────────────────────────────────

  describe("delete state", () => {
    it("should set deleting true during delete", async () => {
      const mockPromise = new Promise<DeleteProjectResponse>(() => {});
      (ProjectService.deleteProject as ReturnType<typeof vi.fn>).mockReturnValue(mockPromise);

      const { result } = renderHook(() => useProject());

      act(() => {
        result.current[1].deleteProject("test");
      });

      expect(result.current[0].deleting).toBe(true);
    });

    it("should clear project from state after successful delete", async () => {
      (ProjectService.getProject as ReturnType<typeof vi.fn>).mockResolvedValue(mockProject);
      (ProjectService.deleteProject as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeleteResponse);

      const { result } = renderHook(() => useProject());

      // Load first
      await act(async () => {
        await result.current[1].loadProject("payments-api");
      });
      expect(result.current[0].project).not.toBeNull();

      // Then delete
      await act(async () => {
        await result.current[1].deleteProject("payments-api");
      });
      expect(result.current[0].project).toBeNull();
    });
  });

  // ── Refresh Behavior ────────────────────────────────────────────────────

  describe("refresh behavior", () => {
    it("should reload project when loadProject is called again", async () => {
      const firstLoad: Project = { ...mockProject, name: "First" };
      const secondLoad: Project = { ...mockProject, name: "Second" };

      (ProjectService.getProject as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(firstLoad)
        .mockResolvedValueOnce(secondLoad);

      const { result } = renderHook(() => useProject());

      await act(async () => {
        await result.current[1].loadProject("payments-api");
      });
      expect(result.current[0].project?.name).toBe("First");

      await act(async () => {
        await result.current[1].loadProject("payments-api");
      });
      expect(result.current[0].project?.name).toBe("Second");
      expect(ProjectService.getProject).toHaveBeenCalledTimes(2);
    });
  });
});