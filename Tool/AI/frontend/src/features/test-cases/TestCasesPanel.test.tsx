/**
 * STEP 5.5C — TestCase Review + Include/Exclude Workflow
 *
 * Focused tests for the TestCasesPanel include/exclude boundary.
 *
 * Covers:
 * - all generated tests included by default
 * - individual exclude
 * - re-include
 * - Select All
 * - Exclude All
 * - Included count
 * - Excluded count
 * - Continue disabled when zero included
 * - canonical TestCase objects are not mutated by selection
 * - no API matching endpoint is called during generation/review
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TestCasesPanel } from "./TestCasesPanel";
import { apiClient } from "../../services/ApiClient";
import type { GenerateTestCasesResponse, TestCase } from "../../types";
import type { ActiveRequirement } from "../requirements/RequirementTypes";

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

const mockTestCases: TestCase[] = [
  {
    id: "tc-1",
    title: "Verify login with valid credentials",
    description: "User can log in and receive a token.",
    type: "positive",
    requirementRefs: [{ acIndex: 0, acText: "User can login" }],
    testData: {
      pathParams: {},
      queryParams: {},
      headers: { "Content-Type": "application/json" },
      body: { username: "test", password: "pass" },
    },
    expectedBehavior: { status: 200, responseAssertions: ["response.token exists"] },
    assertions: ["response.token exists", "response.expiresIn equals 3600"],
  },
  {
    id: "tc-2",
    title: "Verify login fails with wrong password",
    description: "Login should fail with 401 for invalid credentials.",
    type: "negative",
    requirementRefs: [{ acIndex: 1, acText: "User cannot login with wrong password" }],
    testData: {
      pathParams: {},
      queryParams: {},
      headers: { "Content-Type": "application/json" },
      body: { username: "test", password: "wrong" },
    },
    expectedBehavior: { status: 401, responseAssertions: ["response.error exists"] },
    assertions: ["response.error exists"],
  },
  {
    id: "tc-3",
    title: "Verify password boundary length",
    description: "Password at minimum length should be accepted.",
    type: "boundary",
    requirementRefs: [{ acIndex: 2, acText: "Password must be at least 8 chars" }],
    testData: {
      pathParams: {},
      queryParams: {},
      headers: { "Content-Type": "application/json" },
      body: { username: "test", password: "12345678" },
    },
    expectedBehavior: { status: 200, responseAssertions: ["response.token exists"] },
    assertions: ["response.token exists"],
  },
];

const mockResponse: GenerateTestCasesResponse = {
  projectId: "default",
  testCases: mockTestCases,
  diagnostics: { generated: 3 },
  warnings: [],
};

const mockRequirement: ActiveRequirement = {
  source: "manual",
  requirement: {
    key: "REQ-1",
    summary: "User login",
    description: "User should be able to log in.",
    acceptanceCriteria: [
      "User can login",
      "User cannot login with wrong password",
      "Password must be at least 8 chars",
    ],
    fetchedAt: "2024-01-01T00:00:00Z",
    source: "manual",
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function setupMockResponse() {
  mockedPost.mockResolvedValue(mockResponse);
}

function renderPanel(overrides: {
  onContinue?: (included: TestCase[]) => void;
  onGenerated?: (count: number) => void;
  onIncludedChange?: (included: TestCase[]) => void;
} = {}) {
  return render(
    <TestCasesPanel
      activeProjectId="default"
      activeRequirement={mockRequirement}
      onContinue={overrides.onContinue}
      onGenerated={overrides.onGenerated}
      onIncludedChange={overrides.onIncludedChange}
    />
  );
}

async function generateTests() {
  const generateBtn = screen.getByRole("button", { name: /generate test cases/i });
  fireEvent.click(generateBtn);
  await waitFor(() => {
    expect(screen.getByText(/Generated: 3/)).toBeDefined();
  });
}

function getCheckbox(index: number): HTMLInputElement {
  const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
  const cb = checkboxes[index];
  if (!cb) throw new Error(`Checkbox at index ${index} not found`);
  return cb;
}

function getAllCheckboxes(): HTMLInputElement[] {
  return screen.getAllByRole("checkbox") as HTMLInputElement[];
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("TestCasesPanel — STEP 5.5C TestCase Review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. All generated tests included by default
  it("all generated tests are included by default", async () => {
    setupMockResponse();
    renderPanel();
    await generateTests();

    const checkboxes = getAllCheckboxes();
    expect(checkboxes).toHaveLength(3);
    checkboxes.forEach((cb) => {
      expect(cb.checked).toBe(true);
    });

    expect(screen.getByText(/Included: 3/)).toBeDefined();
    expect(screen.getByText(/Excluded: 0/)).toBeDefined();
  });

  // 2. Individual exclude
  it("individual exclude removes one test from included set", async () => {
    setupMockResponse();
    renderPanel();
    await generateTests();

    fireEvent.click(getCheckbox(1)); // uncheck tc-2

    await waitFor(() => {
      expect(screen.getByText(/Included: 2/)).toBeDefined();
      expect(screen.getByText(/Excluded: 1/)).toBeDefined();
    });

    expect(getCheckbox(1).checked).toBe(false);
  });

  // 3. Re-include
  it("re-include restores a previously excluded test case", async () => {
    setupMockResponse();
    renderPanel();
    await generateTests();

    // Exclude tc-2
    fireEvent.click(getCheckbox(1));
    await waitFor(() => {
      expect(screen.getByText(/Excluded: 1/)).toBeDefined();
    });

    // Re-include tc-2
    fireEvent.click(getCheckbox(1));
    await waitFor(() => {
      expect(screen.getByText(/Included: 3/)).toBeDefined();
      expect(screen.getByText(/Excluded: 0/)).toBeDefined();
    });
  });

  // 4. Select All
  it("Select All re-includes all test cases after Exclude All", async () => {
    setupMockResponse();
    renderPanel();
    await generateTests();

    // Exclude all first
    const excludeAllBtn = screen.getByRole("button", { name: /exclude all/i });
    fireEvent.click(excludeAllBtn);
    await waitFor(() => {
      expect(screen.getByText(/Included: 0/)).toBeDefined();
    });

    // Select All
    const selectAllBtn = screen.getByRole("button", { name: /select all/i });
    fireEvent.click(selectAllBtn);
    await waitFor(() => {
      expect(screen.getByText(/Included: 3/)).toBeDefined();
      expect(screen.getByText(/Excluded: 0/)).toBeDefined();
    });

    getAllCheckboxes().forEach((cb) => {
      expect(cb.checked).toBe(true);
    });
  });

  // 5. Exclude All
  it("Exclude All unchecks all test cases", async () => {
    setupMockResponse();
    renderPanel();
    await generateTests();

    const excludeAllBtn = screen.getByRole("button", { name: /exclude all/i });
    fireEvent.click(excludeAllBtn);

    await waitFor(() => {
      expect(screen.getByText(/Included: 0/)).toBeDefined();
      expect(screen.getByText(/Excluded: 3/)).toBeDefined();
    });

    getAllCheckboxes().forEach((cb) => {
      expect(cb.checked).toBe(false);
    });
  });

  // 6. Included count
  it("shows correct included count after excluding one", async () => {
    setupMockResponse();
    renderPanel();
    await generateTests();

    fireEvent.click(getCheckbox(0));

    await waitFor(() => {
      const summary = screen.getByText(/Generated: 3 · Included: 2 · Excluded: 1/);
      expect(summary).toBeDefined();
    });
  });

  // 7. Excluded count
  it("shows correct excluded count after excluding two", async () => {
    setupMockResponse();
    renderPanel();
    await generateTests();

    fireEvent.click(getCheckbox(0));
    fireEvent.click(getCheckbox(1));

    await waitFor(() => {
      const summary = screen.getByText(/Generated: 3 · Included: 1 · Excluded: 2/);
      expect(summary).toBeDefined();
    });
  });

  // 8. Continue disabled when zero included
  it("Continue button is disabled when zero test cases are included", async () => {
    setupMockResponse();
    renderPanel({ onContinue: () => {} });
    await generateTests();

    // Exclude all
    const excludeAllBtn = screen.getByRole("button", { name: /exclude all/i });
    fireEvent.click(excludeAllBtn);

    await waitFor(() => {
      const continueBtn = screen.getByRole("button", { name: /continue with included tests/i });
      expect(continueBtn).toBeDisabled();
    });
  });

  it("Continue button is enabled when at least one test case is included", async () => {
    setupMockResponse();
    renderPanel({ onContinue: () => {} });
    await generateTests();

    await waitFor(() => {
      const continueBtn = screen.getByRole("button", { name: /continue with included tests/i });
      expect(continueBtn).not.toBeDisabled();
    });
  });

  // 9. Canonical TestCase objects are not mutated by selection
  it("canonical TestCase objects are not mutated by include/exclude selection", async () => {
    setupMockResponse();

    // Deep clone the original test cases to compare later
    const originalSnapshot = JSON.parse(JSON.stringify(mockTestCases));

    renderPanel({
      onIncludedChange: () => {},
    });
    await generateTests();

    // Exclude tc-2
    fireEvent.click(getCheckbox(1));

    await waitFor(() => {
      expect(screen.getByText(/Excluded: 1/)).toBeDefined();
    });

    // The original mockTestCases array should not have been mutated
    expect(JSON.stringify(mockTestCases)).toBe(JSON.stringify(originalSnapshot));

    // Verify the test case data is still intact in the DOM
    expect(screen.getByText("Verify login with valid credentials")).toBeDefined();
    expect(screen.getByText("Verify login fails with wrong password")).toBeDefined();
    expect(screen.getByText("Verify password boundary length")).toBeDefined();
  });

  // 10. No API matching endpoint is called during generation/review
  it("only calls /api/test-cases/generate and never an API matching endpoint", async () => {
    setupMockResponse();
    renderPanel();
    await generateTests();

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalled();
    });

    // Verify the only call was to /api/test-cases/generate
    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/test-cases/generate",
      expect.objectContaining({
        projectId: "default",
        ticket: expect.any(Object),
      })
    );

    // Verify no matching-related endpoints were called
    const calledEndpoints = mockedPost.mock.calls.map((call) => call[0]);
    const matchingEndpoints = calledEndpoints.filter(
      (ep) =>
        typeof ep === "string" &&
        (ep.includes("matching") || ep.includes("match") || ep.includes("api-match"))
    );
    expect(matchingEndpoints).toHaveLength(0);
  });

  it("does not call any API matching endpoint during include/exclude operations", async () => {
    setupMockResponse();
    renderPanel();
    await generateTests();

    // Clear mock calls after generation
    mockedPost.mockClear();

    // Perform include/exclude operations
    fireEvent.click(getCheckbox(0)); // exclude
    fireEvent.click(getCheckbox(1)); // exclude
    fireEvent.click(getCheckbox(0)); // re-include

    // No API calls should have been made during selection
    expect(mockedPost).not.toHaveBeenCalled();
  });
});
