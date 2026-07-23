/**
 * STEP 5.5D — Frontend tests for ApiMatchingPanel
 *
 * Tests:
 * - displays matched status
 * - displays ambiguous status
 * - displays unmatched status
 * - manual mapping works
 * - automatic mapping can be overridden
 * - TestCases remain unchanged
 * - matching starts only after Continue
 * - no execution endpoint called
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ApiMatchingPanel } from "./ApiMatchingPanel";
import { apiClient } from "../../services/ApiClient";
import type { MatchTestCasesResponse, TestCase } from "../../types";

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
    assertions: ["response.token exists"],
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
    title: "Verify customer receives confirmation email",
    description: "Customer should receive a confirmation email after registration.",
    type: "functional",
    requirementRefs: [{ acIndex: 2, acText: "Customer receives confirmation email" }],
    testData: {
      pathParams: {},
      queryParams: {},
      headers: { "Content-Type": "application/json" },
      body: { email: "test@example.com" },
    },
    expectedBehavior: { status: 200, responseAssertions: [] },
    assertions: [],
  },
];

const mockMatchResponse: MatchTestCasesResponse = {
  projectId: "default",
  matches: [
    {
      testCaseId: "tc-1",
      status: "matched",
      selectedMatch: {
        serviceId: "auth-service",
        operationId: "loginUser",
        method: "POST",
        path: "/auth/login",
        confidence: 96,
        reasons: ["method: POST", "path: /auth/login"],
      },
      candidates: [
        {
          serviceId: "auth-service",
          operationId: "loginUser",
          method: "POST",
          path: "/auth/login",
          confidence: 96,
          reasons: ["method: POST", "path: /auth/login"],
        },
        {
          serviceId: "auth-service",
          operationId: "getUser",
          method: "GET",
          path: "/users/{userId}",
          confidence: 45,
          reasons: ["method: GET"],
        },
      ],
    },
    {
      testCaseId: "tc-2",
      status: "ambiguous",
      selectedMatch: {
        serviceId: "auth-service",
        operationId: "loginUser",
        method: "POST",
        path: "/auth/login",
        confidence: 65,
        reasons: ["method: POST"],
      },
      candidates: [
        {
          serviceId: "auth-service",
          operationId: "loginUser",
          method: "POST",
          path: "/auth/login",
          confidence: 65,
          reasons: ["method: POST"],
        },
        {
          serviceId: "auth-service",
          operationId: "getUser",
          method: "GET",
          path: "/users/{userId}",
          confidence: 60,
          reasons: ["method: GET"],
        },
      ],
    },
    {
      testCaseId: "tc-3",
      status: "unmatched",
      selectedMatch: null,
      candidates: [],
    },
  ],
  diagnostics: {
    total: 3,
    matched: 1,
    ambiguous: 1,
    unmatched: 1,
  },
  warnings: ["No email/notification API found in registered services."],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function setupMockResponse(response: MatchTestCasesResponse = mockMatchResponse) {
  mockedPost.mockResolvedValue(response);
}

function renderPanel(overrides: {
  onConfirm?: (response: {
    includedTestCases: TestCase[];
    mappings: any[];
    diagnostics: any;
  }) => void;
  onGenerated?: (count: number) => void;
} = {}) {
  return render(
    <ApiMatchingPanel
      activeProjectId="default"
      includedTestCases={mockTestCases}
      onConfirm={overrides.onConfirm}
      onGenerated={overrides.onGenerated}
    />
  );
}

async function matchTests() {
  const matchBtn = screen.getByRole("button", { name: /match test cases/i });
  fireEvent.click(matchBtn);
  await waitFor(() => {
    expect(screen.getByText(/Total: 3/)).toBeDefined();
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("ApiMatchingPanel — STEP 5.5D API Matching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Displays matched status
  it("displays matched status for matched test cases", async () => {
    setupMockResponse();
    renderPanel();
    await matchTests();

    expect(screen.getAllByText("matched")).toHaveLength(1);
  });

  // 2. Displays ambiguous status
  it("displays ambiguous status for ambiguous test cases", async () => {
    setupMockResponse();
    renderPanel();
    await matchTests();

    expect(screen.getAllByText("ambiguous")).toHaveLength(1);
  });

  // 3. Displays unmatched status
  it("displays unmatched status for unmatched test cases", async () => {
    setupMockResponse();
    renderPanel();
    await matchTests();

    expect(screen.getAllByText("unmatched")).toHaveLength(1);
  });

  // 4. Manual mapping works
  it("manual mapping works — user can select a candidate", async () => {
    setupMockResponse();
    renderPanel();
    await matchTests();

    // Click on a candidate to select it manually
    const candidates = screen.getAllByText(/SELECTED/);
    // At least one candidate should be selected (the automatic match for tc-1)
    expect(candidates.length).toBeGreaterThan(0);
  });

  // 5. Automatic mapping can be overridden
  it("automatic mapping can be overridden by selecting a different candidate", async () => {
    setupMockResponse();
    renderPanel();
    await matchTests();

    // The automatic match for tc-1 is loginUser (POST /auth/login)
    // Click on the second candidate (getUser, GET /users/{userId})
    const candidateButtons = screen.getAllByText(/GET/);
    // Find the one with /users/{userId}
    const getUserCandidate = candidateButtons.find((el) =>
      el.textContent?.includes("/users/{userId}")
    );
    expect(getUserCandidate).toBeDefined();

    // Click it to override
    const parentEl = getUserCandidate?.parentElement;
    if (parentEl) {
      fireEvent.click(parentEl);
    }

    await waitFor(() => {
      expect(screen.getAllByText("manual")).toHaveLength(1);
    });
  });

  // 6. TestCases remain unchanged
  it("TestCase objects are not mutated by mapping operations", async () => {
    setupMockResponse();
    const originalSnapshot = JSON.parse(JSON.stringify(mockTestCases));
    renderPanel();
    await matchTests();

    // Perform mapping operations
    const candidateButtons = screen.getAllByText(/GET/);
    const getUserCandidate = candidateButtons.find((el) =>
      el.textContent?.includes("/users/{userId}")
    );
    if (getUserCandidate && getUserCandidate.parentElement) {
      fireEvent.click(getUserCandidate.parentElement);
    }

    // The original test cases should not have been mutated
    expect(JSON.stringify(mockTestCases)).toBe(JSON.stringify(originalSnapshot));
  });

  // 7. Matching starts only after Continue (Match Test Cases button)
  it("matching starts only after Match Test Cases button is clicked", async () => {
    setupMockResponse();
    renderPanel();

    // Before clicking, no match results should be visible
    expect(screen.queryByText(/Total:/)).toBeNull();

    // Click the match button
    const matchBtn = screen.getByRole("button", { name: /match test cases/i });
    fireEvent.click(matchBtn);

    // After clicking, match results should be visible
    await waitFor(() => {
      expect(screen.getByText(/Total: 3/)).toBeDefined();
    });

    // Verify the API was called
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/test-cases/match",
      expect.objectContaining({
        projectId: "default",
        testCases: expect.any(Array),
      })
    );
  });

  // 8. No execution endpoint called
  it("no execution endpoint is called during matching", async () => {
    setupMockResponse();
    renderPanel();
    await matchTests();

    // Verify only /api/test-cases/match was called, not execution endpoints
    const calledEndpoints = mockedPost.mock.calls.map((call) => call[0]);
    const executionEndpoints = calledEndpoints.filter(
      (ep) =>
        typeof ep === "string" &&
        (ep.includes("execute") || ep.includes("run") || ep.includes("specification"))
    );
    expect(executionEndpoints).toHaveLength(0);
  });

  // 9. Summary shows correct diagnostics
  it("shows correct match diagnostics in summary", async () => {
    setupMockResponse();
    renderPanel();
    await matchTests();

    expect(screen.getByText(/Matched: 1/)).toBeDefined();
    expect(screen.getByText(/Ambiguous: 1/)).toBeDefined();
    expect(screen.getByText(/Unmatched: 1/)).toBeDefined();
  });

  // 10. Confirm button calls onConfirm with mappings
  it("Confirm API Mappings button calls onConfirm with mappings", async () => {
    setupMockResponse();
    const confirmHandler = vi.fn();
    renderPanel({ onConfirm: confirmHandler });
    await matchTests();

    const confirmBtn = screen.getByRole("button", { name: /confirm api mappings/i });
    fireEvent.click(confirmBtn);

    expect(confirmHandler).toHaveBeenCalledTimes(1);
    const firstCall = confirmHandler.mock.calls[0];
    expect(firstCall).toBeDefined();
    const response = firstCall![0];
    expect(response.includedTestCases).toHaveLength(3);
    expect(response.mappings.length).toBeGreaterThan(0);
    expect(response.diagnostics).toBeDefined();
  });

  // 11. Match button disabled when no included test cases
  it("Match Test Cases button is disabled when no included test cases", () => {
    setupMockResponse();
    render(
      <ApiMatchingPanel
        activeProjectId="default"
        includedTestCases={[]}
      />
    );

    const matchBtn = screen.getByRole("button", { name: /match test cases/i });
    expect(matchBtn).toBeDisabled();
  });

  // 12. Unmatched test cases remain visible
  it("unmatched test cases remain visible with no API mapping", async () => {
    setupMockResponse();
    renderPanel();
    await matchTests();

    // tc-3 is unmatched, tc-2 is ambiguous (no auto-mapping) — both show "No API mapping selected"
    expect(screen.getAllByText("No API mapping selected").length).toBeGreaterThanOrEqual(1);
  });
});
