/**
 * Tests for ProjectService.
 *
 * Mocks HTTP requests rather than calling the live backend.
 * Covers: successful requests, API errors, validation failures,
 * network failures, response parsing, typed return values.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  searchProjects,
} from "./ProjectService";
import type {
  Project,
  ListProjectsResponse,
  ListProjectsOptions,
  UpdateProjectRequest,
  CreateProjectRequest,
  DeleteProjectResponse,
} from "../../types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockProject: Project = {
  id: "payments-api",
  name: "Payments API",
  createdAt: "2025-01-15T10:30:00.000Z",
  updatedAt: "2025-07-20T14:22:00.000Z",
};

const mockProjectListResponse: ListProjectsResponse = {
  projects: [
    mockProject,
    {
      id: "default",
      name: "Default Project",
      createdAt: "1970-01-01T00:00:00.000Z",
      updatedAt: "1970-01-01T00:00:00.000Z",
    },
  ],
  total: 2,
  limit: 100,
  offset: 0,
};

const mockDeleteResponse: DeleteProjectResponse = {
  success: true,
  message: "Project deleted successfully",
  id: "payments-api",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Mock a successful JSON response from fetch.
 */
function mockFetchSuccess(data: unknown): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response);
}

/**
 * Mock an error JSON response from fetch.
 */
function mockFetchError(status: number, statusText: string, errorMessage: string): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    json: async () => ({ error: errorMessage }),
    text: async () => JSON.stringify({ error: errorMessage }),
  } as unknown as Response);
}

/**
 * Mock a network failure (fetch throws).
 */
function mockFetchNetworkError(): void {
  globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
}

/**
 * Mock a malformed JSON response (tests response parsing).
 */
function mockFetchMalformedJson(status: number): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => {
      throw new SyntaxError("Unexpected token in JSON");
    },
    text: async () => "not-json",
  } as unknown as Response);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ProjectService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── listProjects ────────────────────────────────────────────────────────

  describe("listProjects", () => {
    it("should return a list of projects on successful request", async () => {
      mockFetchSuccess(mockProjectListResponse);
      const result = await listProjects();
      expect(result).toEqual(mockProjectListResponse);
      expect(result.projects).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("should pass query parameters when options are provided", async () => {
      mockFetchSuccess(mockProjectListResponse);
      const options: ListProjectsOptions = { search: "payments", sort: "name", order: "desc" };
      await listProjects(options);
      const mockFn = globalThis.fetch as ReturnType<typeof vi.fn>;
      const calledUrl = mockFn.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("search=payments");
      expect(calledUrl).toContain("sort=name");
      expect(calledUrl).toContain("order=desc");
    });

    it("should not append query string when no options given", async () => {
      mockFetchSuccess(mockProjectListResponse);
      await listProjects();
      const mockFn = globalThis.fetch as ReturnType<typeof vi.fn>;
      const calledUrl = mockFn.mock.calls[0]?.[0] as string;
      expect(calledUrl).toBe("/api/projects");
    });

    it("should throw an ApiError on server error", async () => {
      mockFetchError(500, "Internal Server Error", "Failed to list projects");
      await expect(listProjects()).rejects.toThrow("Failed to list projects");
    });

    it("should throw on network failure", async () => {
      mockFetchNetworkError();
      await expect(listProjects()).rejects.toThrow("Failed to fetch");
    });
  });

  // ── getProject ──────────────────────────────────────────────────────────

  describe("getProject", () => {
    it("should return a project on successful request", async () => {
      mockFetchSuccess({ project: mockProject });
      const result = await getProject("payments-api");
      expect(result).toEqual(mockProject);
      expect(result.id).toBe("payments-api");
      expect(result.name).toBe("Payments API");
    });

    it("should encode the project ID in the URL", async () => {
      mockFetchSuccess({ project: mockProject });
      await getProject("special/id");
      const mockFn = globalThis.fetch as ReturnType<typeof vi.fn>;
      const calledUrl = mockFn.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain(encodeURIComponent("special/id"));
    });

    it("should throw an ApiError on 404", async () => {
      mockFetchError(404, "Not Found", "Project not found: missing-project");
      await expect(getProject("missing-project")).rejects.toThrow("Project not found: missing-project");
    });

    it("should throw on network failure", async () => {
      mockFetchNetworkError();
      await expect(getProject("any")).rejects.toThrow("Failed to fetch");
    });
  });

  // ── createProject ───────────────────────────────────────────────────────

  describe("createProject", () => {
    it("should return the created project on success", async () => {
      mockFetchSuccess({ project: mockProject });
      const data: CreateProjectRequest = { id: "payments-api", name: "Payments API" };
      const result = await createProject(data);
      expect(result).toEqual(mockProject);
    });

    it("should send the request body as JSON", async () => {
      mockFetchSuccess({ project: mockProject });
      const data: CreateProjectRequest = { id: "new-project", name: "New Project" };
      await createProject(data);
      const mockFn = globalThis.fetch as ReturnType<typeof vi.fn>;
      const callBody = mockFn.mock.calls[0]?.[1] as RequestInit;
      expect(callBody.method).toBe("POST");
      expect(JSON.parse(callBody.body as string)).toEqual(data);
    });

    it("should throw an ApiError on 409 conflict", async () => {
      mockFetchError(409, "Conflict", "Project already exists: duplicate-id");
      await expect(createProject({ id: "duplicate-id", name: "Dup" })).rejects.toThrow(
        "Project already exists: duplicate-id"
      );
    });

    it("should throw on validation error (400)", async () => {
      mockFetchError(400, "Bad Request", "Project ID must be a non-empty string.");
      await expect(createProject({ id: "", name: "" })).rejects.toThrow(
        "Project ID must be a non-empty string."
      );
    });

    it("should throw on network failure", async () => {
      mockFetchNetworkError();
      await expect(createProject({ id: "x", name: "x" })).rejects.toThrow("Failed to fetch");
    });
  });

  // ── updateProject ───────────────────────────────────────────────────────

  describe("updateProject", () => {
    it("should return the updated project on success", async () => {
      const updatedProject: Project = { ...mockProject, name: "Payments API v2", updatedAt: "2025-07-25T13:05:00.000Z" };
      mockFetchSuccess({ project: updatedProject });
      const result = await updateProject("payments-api", { name: "Payments API v2" });
      expect(result.name).toBe("Payments API v2");
      expect(result.updatedAt).not.toBe(mockProject.updatedAt);
    });

    it("should send PATCH with name in body", async () => {
      mockFetchSuccess({ project: mockProject });
      const data: UpdateProjectRequest = { name: "Updated Name" };
      await updateProject("test-id", data);
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const [url, options] = call as [string, RequestInit];
      expect(options.method).toBe("PATCH");
      expect(url).toContain("test-id");
      expect(JSON.parse(options.body as string)).toEqual(data);
    });

    it("should throw on 404", async () => {
      mockFetchError(404, "Not Found", "Project not found: missing");
      await expect(updateProject("missing", { name: "x" })).rejects.toThrow("Project not found: missing");
    });

    it("should throw on empty name (400)", async () => {
      mockFetchError(400, "Bad Request", "Project identity name must be a non-empty string.");
      await expect(updateProject("test", { name: "" })).rejects.toThrow("must be a non-empty string");
    });

    it("should throw on network failure", async () => {
      mockFetchNetworkError();
      await expect(updateProject("x", { name: "x" })).rejects.toThrow("Failed to fetch");
    });
  });

  // ── deleteProject ───────────────────────────────────────────────────────

  describe("deleteProject", () => {
    it("should return success response on successful deletion", async () => {
      mockFetchSuccess(mockDeleteResponse);
      const result = await deleteProject("payments-api");
      expect(result.success).toBe(true);
      expect(result.message).toBe("Project deleted successfully");
      expect(result.id).toBe("payments-api");
    });

    it("should send DELETE request", async () => {
      mockFetchSuccess(mockDeleteResponse);
      await deleteProject("test-id");
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const [, options] = call as [string, RequestInit];
      expect(options.method).toBe("DELETE");
    });

    it("should throw on 400 (cannot delete default)", async () => {
      mockFetchError(400, "Bad Request", "Cannot delete the default project");
      await expect(deleteProject("default")).rejects.toThrow("Cannot delete the default project");
    });

    it("should throw on 404", async () => {
      mockFetchError(404, "Not Found", "Project not found: missing");
      await expect(deleteProject("missing")).rejects.toThrow("Project not found: missing");
    });

    it("should throw on network failure", async () => {
      mockFetchNetworkError();
      await expect(deleteProject("x")).rejects.toThrow("Failed to fetch");
    });
  });

  // ── searchProjects ──────────────────────────────────────────────────────

  describe("searchProjects", () => {
    it("should return filtered results matching the search query", async () => {
      const searchResponse: ListProjectsResponse = {
        projects: [mockProject],
        total: 1,
        limit: 100,
        offset: 0,
      };
      mockFetchSuccess(searchResponse);
      const result = await searchProjects("payments");
      expect(result.projects).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should pass search parameter in the URL", async () => {
      mockFetchSuccess(mockProjectListResponse);
      await searchProjects("test-query");
      const mockFn = globalThis.fetch as ReturnType<typeof vi.fn>;
      const calledUrl = mockFn.mock.calls[0]?.[0] as string;
      expect(calledUrl).toContain("search=test-query");
    });

    it("should return empty list when no matches found", async () => {
      const emptyResponse: ListProjectsResponse = {
        projects: [],
        total: 0,
        limit: 100,
        offset: 0,
      };
      mockFetchSuccess(emptyResponse);
      const result = await searchProjects("nonexistent");
      expect(result.projects).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should throw on network failure", async () => {
      mockFetchNetworkError();
      await expect(searchProjects("x")).rejects.toThrow("Failed to fetch");
    });
  });

  // ── Response Parsing ────────────────────────────────────────────────────

  describe("response parsing", () => {
    it("should parse and return typed values for listProjects", async () => {
      mockFetchSuccess(mockProjectListResponse);
      const result: ListProjectsResponse = await listProjects();
      // TypeScript compile-time check: result must satisfy ListProjectsResponse
      expect(result.projects[0]?.id).toBe("payments-api");
      expect(result.total).toBe(2);
    });

    it("should parse and return typed values for getProject", async () => {
      mockFetchSuccess({ project: mockProject });
      const result: Project = await getProject("payments-api");
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it("should handle malformed JSON from a successful response", async () => {
      mockFetchMalformedJson(200);
      // When JSON parsing fails, the apiClient attempts text fallback
      // and returns the raw text wrapped in an error object
      const result = await listProjects();
      // Should not throw — apiClient handles graceful degradation
      expect(result).toEqual({ error: "not-json" });
    });

    it("should throw with statusText fallback when error response has no JSON body", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
        text: async () => "",
      } as unknown as Response);
      await expect(listProjects()).rejects.toThrow("Internal Server Error");
    });
  });
});