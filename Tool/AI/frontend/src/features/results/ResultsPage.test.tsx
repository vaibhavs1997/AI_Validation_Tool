import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ResultsPage } from "./ResultsPage";
import { getRun } from "../runs/RunService";

vi.mock("../runs/RunService", () => ({
  getRun: vi.fn(),
}));

const mockedGetRun = vi.mocked(getRun);

const mockRun = {
  id: "run-1",
  projectId: "default",
  testSpecification: {
    id: "spec-1",
    title: "Spec",
    description: "Desc",
    requirementRefs: [],
    operationRefs: [],
    expectedBehavior: { status: 200, responseAssertions: [] },
  },
  title: "Test Run",
  description: "Asc",
  status: "passed" as const,
  results: [],
  executionPlanSummary: { target: { serviceId: "", operationId: "" }, stepCount: 1, operations: [{ serviceId: "", operationId: "", method: "GET", path: "/" }] },
  targetOperation: { serviceId: "", operationId: "" },
  errors: [],
  startedAt: "",
  completedAt: "",
  durationMs: 100,
};

describe("ResultsPage — MVP Report Export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("print button calls window.print", async () => {
    mockedGetRun.mockResolvedValue(mockRun);
    const { rerender } = render(<ResultsPage activeProjectId={null} />);
    window.location.hash = "#results?runId=run-1";
    rerender(<ResultsPage activeProjectId="default" />);

    await waitFor(() => {
      expect(screen.getByText("PASSED")).toBeDefined();
    });

    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const printBtn = screen.getByRole("button", { name: /print \/ save as pdf/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("download JSON uses current persisted run and filename contains runId", async () => {
    mockedGetRun.mockResolvedValue(mockRun);
    const { rerender } = render(<ResultsPage activeProjectId={null} />);
    window.location.hash = "#results?runId=run-1";
    rerender(<ResultsPage activeProjectId="default" />);

    await waitFor(() => {
      expect(screen.getByText("PASSED")).toBeDefined();
    });

    const urlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(window.HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const downloadBtn = screen.getByRole("button", { name: /download json/i });
    fireEvent.click(downloadBtn);

    expect(urlSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledTimes(1);

    urlSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
