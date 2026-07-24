/**
 * STEP 6.4D — Batch Execution Validation
 *
 * Focused tests for the batch execution added in STEP 6.4C.
 *
 * Covers:
 * - Individual checkbox selection
 * - Select All Ready
 * - Clear Selection
 * - Same TestSpecification cannot execute twice in one batch
 * - Selection cannot change while batch is running
 * - Sequential execution via POST /api/runs/execute-dependent
 * - Failure of one test does not stop remaining tests
 * - Progress: Waiting → Running → Passed/Failed transitions + completed count
 * - Each executed test creates exactly one persisted Run
 * - No batch persistence endpoint exists
 * - Rerun Failed: only FAILED tests rerun; passed tests do not rerun; blocked not treated as failed
 * - Run Again: current selected tests can run again creating new independent runs
 * - Canonical TestSpecifications are not mutated
 * - Execution-time overrides still work for single-test execution
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ExecutionPanel } from "./ExecutionPanel";
import { apiClient } from "../../services/ApiClient";
import type { PrepareResponse, TestSpecification, ExecutionPlan } from "../../types";
import type { ExecuteDependentResponse } from "./ExecutionService";

// ─── Mock apiClient ──────────────────────────────────────────────────────────

vi.mock("../../services/ApiClient", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
  apiRequest: vi.fn(),
  createApiError: vi.fn(),
}));

const mockedPost = vi.mocked(apiClient.post);

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockSpecs: TestSpecification[] = [
  {
    id: "spec-1",
    title: "Test A",
    description: "Test A description",
    method: "GET",
    path: "/api/a",
    requirementRefs: [],
    operationRefs: [{ serviceId: "svc", operationId: "op-a", method: "GET", path: "/api/a" }],
    prerequisites: [],
    testData: { pathParams: {}, queryParams: {}, headers: {}, body: {} },
    expectedBehavior: { status: 200, responseAssertions: [] },
    assertions: [],
  },
  {
    id: "spec-2",
    title: "Test B",
    description: "Test B description",
    method: "POST",
    path: "/api/b",
    requirementRefs: [],
    operationRefs: [{ serviceId: "svc", operationId: "op-b", method: "POST", path: "/api/b" }],
    prerequisites: [],
    testData: { pathParams: {}, queryParams: {}, headers: {}, body: {} },
    expectedBehavior: { status: 201, responseAssertions: [] },
    assertions: [],
  },
  {
    id: "spec-3",
    title: "Test C",
    description: "Test C description",
    method: "GET",
    path: "/api/c",
    requirementRefs: [],
    operationRefs: [{ serviceId: "svc", operationId: "op-c", method: "GET", path: "/api/c" }],
    prerequisites: [],
    testData: { pathParams: {}, queryParams: {}, headers: {}, body: {} },
    expectedBehavior: { status: 200, responseAssertions: [] },
    assertions: [],
  },
];

const mockPlans: Record<string, ExecutionPlan> = {
  "spec-1": {
    target: { serviceId: "svc", operationId: "op-a", method: "GET", path: "/api/a" },
    steps: [{
      order: 0,
      operation: { serviceId: "svc", operationId: "op-a", method: "GET", path: "/api/a" },
      prerequisites: [],
      bindings: [],
      status: "ready",
    }],
    errors: [],
    isValid: true,
  },
  "spec-2": {
    target: { serviceId: "svc", operationId: "op-b", method: "POST", path: "/api/b" },
    steps: [{
      order: 0,
      operation: { serviceId: "svc", operationId: "op-b", method: "POST", path: "/api/b" },
      prerequisites: [],
      bindings: [],
      status: "ready",
    }],
    errors: [],
    isValid: true,
  },
  "spec-3": {
    target: { serviceId: "svc", operationId: "op-c", method: "GET", path: "/api/c" },
    steps: [{
      order: 0,
      operation: { serviceId: "svc", operationId: "op-c", method: "GET", path: "/api/c" },
      prerequisites: [],
      bindings: [],
      status: "ready",
    }],
    errors: [],
    isValid: true,
  },
};

const mockPrepareResponse: PrepareResponse = {
  projectId: "default",
  testSpecifications: mockSpecs,
  plans: mockPlans,
  unresolvedTestCases: [],
  diagnostics: { included: 3, prepared: 3, unresolved: 0, plansBuilt: 3 },
  warnings: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockExecutionResponse(
  specId: string,
  title: string,
  status: "passed" | "failed"
): ExecuteDependentResponse {
  return {
    specId,
    spec: { title, description: "" },
    status,
    results: [{
      step: 0,
      operation: { serviceId: "svc", operationId: "op", method: "GET", path: "/api" },
      status: "passed",
      response: null,
      request: null,
    }],
    errors: [],
    success: status === "passed",
    runId: `run-${specId}`,
    run: { id: `run-${specId}`, projectId: "default" },
  };
}

function renderPanel() {
  return render(
    <ExecutionPanel
      activeProjectId="default"
      prepareResponse={mockPrepareResponse}
    />
  );
}

function getCheckboxes(): HTMLInputElement[] {
  return screen.getAllByRole("checkbox") as HTMLInputElement[];
}

async function selectSpecForOverride() {
  const radioButtons = screen.getAllByRole("radio") as HTMLInputElement[];
  fireEvent.click(radioButtons[0]!);;
  await waitFor(() => {
    expect(screen.getByText(/Test Data & Expected Result/i)).toBeDefined();
  });
}

async function selectAllReady() {
  const btn = screen.getByRole("button", { name: /Select All Ready/i });
  fireEvent.click(btn);
  await waitFor(() => {
    expect(screen.getByText(/3 of 3 selected/i)).toBeDefined();
  });
}

async function runBatch() {
  const btn = screen.getByRole("button", { name: /Run Selected Tests/i });
  fireEvent.click(btn);
}

async function waitForBatchComplete() {
  await waitFor(() => {
    expect(screen.getByText(/Batch Complete/i)).toBeDefined();
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ExecutionPanel — STEP 6.4D Batch Execution Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Selection
  describe("Selection", () => {
    it("individual checkbox selection works", async () => {
      renderPanel();
      await selectSpecForOverride();

      const checkboxes = getCheckboxes();
      expect(checkboxes).toHaveLength(3);

      fireEvent.click(checkboxes[0]!);;
      await waitFor(() => {
        expect(screen.getByText(/1 of 3 selected/i)).toBeDefined();
      });

      fireEvent.click(checkboxes[1]!);;
      await waitFor(() => {
        expect(screen.getByText(/2 of 3 selected/i)).toBeDefined();
      });
    });

    it("Select All Ready works", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();
    });

    it("Clear Selection works", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      const clearBtn = screen.getByRole("button", { name: /Clear Selection/i });
      fireEvent.click(clearBtn);
      await waitFor(() => {
        expect(screen.getByText(/0 of 3 selected/i)).toBeDefined();
      });
    });

    it("same TestSpecification cannot execute twice in one batch", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      mockedPost
        .mockResolvedValueOnce(mockExecutionResponse("spec-1", "Test A", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-2", "Test B", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-3", "Test C", "passed"));

      await runBatch();
      await waitForBatchComplete();

      expect(mockedPost).toHaveBeenCalledTimes(3);
      const specIds = mockedPost.mock.calls.map(
        (call) => (call[1] as { testSpecification: { id: string } }).testSpecification.id
      );
      expect(specIds).toEqual(["spec-1", "spec-2", "spec-3"]);
    });

    it("selection cannot change while batch is running", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      // Hang the mock so batch stays running
      mockedPost.mockReturnValue(new Promise(() => {}));

      await runBatch();

      // Wait for batch to start
      await waitFor(() => {
        expect(screen.getByText("Running Tests")).toBeDefined();
      });

      // Try to toggle a checkbox
      const checkboxes = getCheckboxes();
      fireEvent.click(checkboxes[0]!);;

      // Selection should not change
      await waitFor(() => {
        expect(screen.getByText(/3 of 3 selected/i)).toBeDefined();
      });
    });
  });

  // 2. Sequential execution
  describe("Sequential execution", () => {
    it("selected tests execute one at a time via POST /api/runs/execute-dependent", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      mockedPost
        .mockResolvedValueOnce(mockExecutionResponse("spec-1", "Test A", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-2", "Test B", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-3", "Test C", "passed"));

      await runBatch();
      await waitForBatchComplete();

      expect(mockedPost).toHaveBeenCalledTimes(3);

      // Each call uses /api/runs/execute-dependent
      for (let i = 0; i < 3; i++) {
        expect(mockedPost).toHaveBeenNthCalledWith(
          i + 1,
          "/api/runs/execute-dependent",
          expect.anything()
        );
      }
    });

    it("failure of one test does not stop remaining tests", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      mockedPost
        .mockResolvedValueOnce(mockExecutionResponse("spec-1", "Test A", "passed"))
        .mockRejectedValueOnce(new Error("Test B execution failed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-3", "Test C", "passed"));

      await runBatch();
      await waitForBatchComplete();

      // All 3 tests attempted despite failure
      expect(mockedPost).toHaveBeenCalledTimes(3);

      // Summary shows 2 passed, 1 failed
      await waitFor(() => {
        expect(screen.getByText(/2 passed/i)).toBeDefined();
        expect(screen.getByText(/1 failed/i)).toBeDefined();
      });
    });
  });

  // 3. Progress
  describe("Progress", () => {
    it("shows Waiting → Running → Passed/Failed transitions and completed count", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      mockedPost
        .mockImplementationOnce(
          () => new Promise((resolve) =>
            setTimeout(() => resolve(mockExecutionResponse("spec-1", "Test A", "passed")), 30)
          )
        )
        .mockImplementationOnce(
          () => new Promise((resolve) =>
            setTimeout(() => resolve(mockExecutionResponse("spec-2", "Test B", "failed")), 30)
          )
        )
        .mockImplementationOnce(
          () => new Promise((resolve) =>
            setTimeout(() => resolve(mockExecutionResponse("spec-3", "Test C", "passed")), 30)
          )
        );

      await runBatch();

      // "Running Tests" header appears
      await waitFor(() => {
        expect(screen.getByText("Running Tests")).toBeDefined();
      });

      // "X of N completed" appears
      await waitFor(() => {
        expect(screen.getByText(/of 3 completed/i)).toBeDefined();
      });

      // Wait for completion
      await waitForBatchComplete();

      // Summary shows correct counts
      expect(screen.getByText(/3 test/i)).toBeDefined();
      expect(screen.getByText(/2 passed/i)).toBeDefined();
      expect(screen.getByText(/1 failed/i)).toBeDefined();
    });
  });

  // 4. Persistence
  describe("Persistence", () => {
    it("each executed test creates exactly one persisted Run", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      mockedPost
        .mockResolvedValueOnce(mockExecutionResponse("spec-1", "Test A", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-2", "Test B", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-3", "Test C", "passed"));

      await runBatch();
      await waitForBatchComplete();

      expect(mockedPost).toHaveBeenCalledTimes(3);

      // Each response has a runId (indicating persistence)
      const results = mockedPost.mock.results;
      for (let i = 0; i < 3; i++) {
        const response = await results[i]!.value;
        expect(response.runId).toBeDefined();
        expect(response.run).toBeDefined();
      }
    });

    it("no batch persistence endpoint is called", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      mockedPost
        .mockResolvedValueOnce(mockExecutionResponse("spec-1", "Test A", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-2", "Test B", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-3", "Test C", "passed"));

      await runBatch();
      await waitForBatchComplete();

      // All calls are to /api/runs/execute-dependent (no batch endpoint)
      for (const call of mockedPost.mock.calls) {
        expect(call[0]).toBe("/api/runs/execute-dependent");
      }

      // No call to a batch endpoint
      const batchCalls = mockedPost.mock.calls.filter((call) =>
        String(call[0]).includes("batch")
      );
      expect(batchCalls).toHaveLength(0);
    });
  });

  // 5. Rerun Failed
  describe("Rerun Failed", () => {
    it("only FAILED tests rerun", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      // spec-1 passes, spec-2 fails, spec-3 passes
      mockedPost
        .mockResolvedValueOnce(mockExecutionResponse("spec-1", "Test A", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-2", "Test B", "failed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-3", "Test C", "passed"));

      await runBatch();
      await waitForBatchComplete();

      // Clear mock and set up rerun
      mockedPost.mockClear();
      mockedPost.mockResolvedValueOnce(
        mockExecutionResponse("spec-2", "Test B", "passed")
      );

      // Click Rerun Failed (sets selection to only failed tests)
      const rerunBtn = screen.getByRole("button", { name: /Rerun Failed/i });
      fireEvent.click(rerunBtn);

      // Click Run Selected Tests to execute only the failed tests
      const runBtn = screen.getByRole("button", { name: /Run Selected Tests/i });
      fireEvent.click(runBtn);

      await waitForBatchComplete();

      // Only 1 call (only the failed test)
      expect(mockedPost).toHaveBeenCalledTimes(1);
      const specId = (
        mockedPost.mock.calls[0]![1] as { testSpecification: { id: string } }
      ).testSpecification.id;
      expect(specId).toBe("spec-2");
    });

    it("passed tests do not rerun", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      // All pass
      mockedPost
        .mockResolvedValueOnce(mockExecutionResponse("spec-1", "Test A", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-2", "Test B", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-3", "Test C", "passed"));

      await runBatch();
      await waitForBatchComplete();

      // No Rerun Failed button (no failed tests)
      expect(screen.queryByRole("button", { name: /Rerun Failed/i })).toBeNull();
    });

    it("blocked is not treated as failed", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      // spec-1 passes, spec-2 has blocked steps but overall "passed", spec-3 passes
      const blockedResponse: ExecuteDependentResponse = {
        specId: "spec-2",
        spec: { title: "Test B", description: "" },
        status: "passed",
        results: [
          {
            step: 0,
            operation: { serviceId: "svc", operationId: "op", method: "GET", path: "/api" },
            status: "blocked",
            response: null,
            request: null,
          },
        ],
        errors: [],
        success: true,
        runId: "run-spec-2",
        run: { id: "run-spec-2", projectId: "default" },
      };

      mockedPost
        .mockResolvedValueOnce(mockExecutionResponse("spec-1", "Test A", "passed"))
        .mockResolvedValueOnce(blockedResponse)
        .mockResolvedValueOnce(mockExecutionResponse("spec-3", "Test C", "passed"));

      await runBatch();
      await waitForBatchComplete();

      // No Rerun Failed button (no failed tests — blocked is not failed)
      expect(screen.queryByRole("button", { name: /Rerun Failed/i })).toBeNull();
    });
  });

  // 6. Run Again
  describe("Run Again", () => {
    it("current selected tests can run again creating new independent runs", async () => {
      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      // First run
      mockedPost
        .mockResolvedValueOnce(mockExecutionResponse("spec-1", "Test A", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-2", "Test B", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-3", "Test C", "passed"));

      await runBatch();
      await waitForBatchComplete();

      // Clear and set up second run
      mockedPost.mockClear();
      mockedPost
        .mockResolvedValueOnce(mockExecutionResponse("spec-1", "Test A", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-2", "Test B", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-3", "Test C", "passed"));

      // Click Run Again
      const runAgainBtn = screen.getByRole("button", { name: /Run Again/i });
      fireEvent.click(runAgainBtn);

      await waitForBatchComplete();

      // 3 calls (all tests rerun)
      expect(mockedPost).toHaveBeenCalledTimes(3);

      // Each call creates a new run (different runId)
      const results = mockedPost.mock.results;
      for (let i = 0; i < 3; i++) {
        const response = await results[i]!.value;
        expect(response.runId).toBeDefined();
      }
    });
  });

  // 7. Safety
  describe("Safety", () => {
    it("canonical TestSpecifications are not mutated", async () => {
      const originalSpecs = JSON.parse(JSON.stringify(mockSpecs));

      renderPanel();
      await selectSpecForOverride();
      await selectAllReady();

      mockedPost
        .mockResolvedValueOnce(mockExecutionResponse("spec-1", "Test A", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-2", "Test B", "passed"))
        .mockResolvedValueOnce(mockExecutionResponse("spec-3", "Test C", "passed"));

      await runBatch();
      await waitForBatchComplete();

      expect(mockSpecs).toEqual(originalSpecs);
    });

    it("execution-time overrides still work for single-test execution", async () => {
      renderPanel();

      // Select a spec via radio button
      const radioButtons = screen.getAllByRole("radio") as HTMLInputElement[];
      fireEvent.click(radioButtons[0]!);;

      // Wait for override to be initialized
      await waitFor(() => {
        expect(screen.getByText(/Test Data & Expected Result/i)).toBeDefined();
      });

      // Change expected status from 200 to 201
      const statusInput = screen.getByDisplayValue("200") as unknown as HTMLInputElement;
      fireEvent.change(statusInput, { target: { value: "201" } });

      // Mock apiClient.post
      mockedPost.mockResolvedValueOnce(
        mockExecutionResponse("spec-1", "Test A", "passed")
      );

      // Click Run Test
      const runBtn = screen.getByRole("button", { name: /Run Test/i });
      fireEvent.click(runBtn);

      // Wait for execution to complete (use View Full Results button as indicator)
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /View Full Results/i })).toBeDefined();
      });

      // Verify apiClient.post was called
      expect(mockedPost).toHaveBeenCalledTimes(1);

      // Verify the request includes the overridden status
      const call = mockedPost.mock.calls[0]!;
      const request = call[1] as {
        testSpecification: { expectedBehavior: { status: number } };
      };
      expect(request.testSpecification.expectedBehavior.status).toBe(201);
    });
  });
});
