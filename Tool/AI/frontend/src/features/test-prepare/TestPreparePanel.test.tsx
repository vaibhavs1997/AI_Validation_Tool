/**
 * STEP 5.5E — Frontend tests for TestPreparePanel
 *
 * Tests:
 * - ready tests displayed
 * - unresolved tests displayed
 * - dependency flow displayed
 * - preparation starts only after mapping confirmation
 * - no execution endpoint called
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TestPreparePanel } from "./TestPreparePanel";
import { apiClient } from "../../services/ApiClient";
import type { TestCase, TestCaseApiMapping, PrepareResponse } from "../../types";

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

const mockTestCases: TestCase[] = [
  {
    id: "tc-1",
    title: "Reject order when quantity is zero",
    description: "Reject order with zero quantity via PUT /orders/{orderId}",
    type: "negative",
    requirementRefs: [{ acIndex: 0, acText: "Order quantity must be > 0" }],
    testData: {
      pathParams: { orderId: "123" },
      queryParams: {},
      headers: { "Content-Type": "application/json" },
      body: { quantity: 0 },
    },
    expectedBehavior: { status: 400, responseAssertions: ["response.error exists"] },
    assertions: ["response.error exists"],
  },
  {
    id: "tc-2",
    title: "Send confirmation email",
    description: "Customer should receive a confirmation email after registration.",
    type: "functional",
    requirementRefs: [{ acIndex: 1, acText: "Customer receives confirmation email" }],
    testData: { pathParams: {}, queryParams: {}, headers: {}, body: {} },
    expectedBehavior: { status: 200, responseAssertions: [] },
    assertions: [],
  },
];

const mockMappings: TestCaseApiMapping[] = [
  {
    testCaseId: "tc-1",
    serviceId: "order-service",
    operationId: "updateOrder",
    method: "PUT",
    path: "/orders/{orderId}",
    source: "automatic",
  },
  {
    testCaseId: "tc-2",
    serviceId: "notification-service",
    operationId: "sendEmail",
    method: "POST",
    path: "/notifications/email",
    source: "manual",
  },
];

const mockPrepareResponse: PrepareResponse = {
  projectId: "default",
  testSpecifications: [
    {
      id: "tc-1",
      title: "Reject order when quantity is zero",
      description: "Reject order with zero quantity via PUT /orders/{orderId}",
      method: "PUT",
      path: "/orders/{orderId}",
      requirementRefs: [{ acIndex: 0, acText: "Order quantity must be > 0" }],
      operationRefs: [
        {
          serviceId: "order-service",
          operationId: "updateOrder",
          method: "PUT",
          path: "/orders/{orderId}",
        },
      ],
      prerequisites: [],
      testData: { pathParams: { orderId: "123" }, queryParams: {}, headers: {}, body: { quantity: 0 } },
      expectedBehavior: { status: 400, responseAssertions: ["response.error exists"] },
      assertions: ["response.error exists"],
    },
  ],
  plans: {
    "tc-1": {
      target: { serviceId: "order-service", operationId: "updateOrder", method: "PUT", path: "/orders/{orderId}" },
      steps: [
        {
          order: 0,
          operation: { serviceId: "order-service", operationId: "updateOrder", method: "PUT", path: "/orders/{orderId}" },
          prerequisites: [],
          bindings: [],
          status: "ready",
        },
      ],
      errors: [],
      isValid: true,
    },
  },
  unresolvedTestCases: [
    {
      testCaseId: "tc-2",
      reason: "Mapped operation not found: notification-service::sendEmail",
    },
  ],
  diagnostics: {
    included: 2,
    prepared: 1,
    unresolved: 1,
    plansBuilt: 0,
  },
  warnings: [],
};

function setupMockResponse(response: PrepareResponse = mockPrepareResponse) {
  mockedPost.mockResolvedValue(response);
}

function renderPanel(overrides: {
  onPrepared?: (response: PrepareResponse) => void;
} = {}) {
  return render(
    <TestPreparePanel
      activeProjectId="default"
      includedTestCases={mockTestCases}
      confirmedMappings={mockMappings}
      onPrepared={overrides.onPrepared}
    />
  );
}

async function prepareTests() {
  const prepareBtn = screen.getByRole("button", { name: /prepare tests/i });
  fireEvent.click(prepareBtn);
  await waitFor(() => {
    expect(screen.getByText(/Included: 2/)).toBeDefined();
  });
}

describe("TestPreparePanel — STEP 5.5E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ready tests displayed", async () => {
    setupMockResponse();
    renderPanel();
    await prepareTests();

    expect(screen.getByText("Ready for Execution (1)")).toBeDefined();
    expect(screen.getByText(/Reject order when quantity is zero/)).toBeDefined();
  });

  it("unresolved tests displayed", async () => {
    setupMockResponse();
    renderPanel();
    await prepareTests();

    expect(screen.getByText("Need Attention (1)")).toBeDefined();
    expect(screen.getByText(/Send confirmation email/)).toBeDefined();
  });

  it("dependency flow displayed", async () => {
    setupMockResponse();
    renderPanel();
    await prepareTests();

    // Independent operation shows "Independent operation"
    expect(screen.getByText(/Independent operation/)).toBeDefined();
  });

  it("preparation starts only after Prepare Tests button is clicked", async () => {
    setupMockResponse();
    renderPanel();

    expect(screen.queryByText(/Included:/)).toBeNull();

    const prepareBtn = screen.getByRole("button", { name: /prepare tests/i });
    fireEvent.click(prepareBtn);

    await waitFor(() => {
      expect(screen.getByText(/Included: 2/)).toBeDefined();
    });

    expect(mockedPost).toHaveBeenCalledWith(
      "/api/test-specifications/prepare",
      expect.objectContaining({
        projectId: "default",
        testCases: expect.any(Array),
        mappings: expect.any(Array),
      })
    );
  });

  it("no execution endpoint called during preparation", async () => {
    setupMockResponse();
    renderPanel();
    await prepareTests();

    const calledEndpoints = mockedPost.mock.calls.map((call) => call[0]);
    const executionEndpoints = calledEndpoints.filter(
      (ep) => typeof ep === "string" && (ep.includes("execute") || ep.includes("run") || ep.includes("dependent"))
    );
    expect(executionEndpoints).toHaveLength(0);
  });

  it("Confirm API Mappings button propagates mappings", async () => {
    const preparedHandler = vi.fn();
    setupMockResponse();
    renderPanel({ onPrepared: preparedHandler });
    await prepareTests();

    expect(preparedHandler).toHaveBeenCalledTimes(1);
    const firstCall = preparedHandler.mock.calls[0];
    expect(firstCall).toBeDefined();
    const response = firstCall![0];
    expect(response.testSpecifications).toHaveLength(1);
    expect(response.unresolvedTestCases).toHaveLength(1);
  });

  it("Prepare button disabled when no confirmed mappings", () => {
    setupMockResponse();
    render(
      <TestPreparePanel
        activeProjectId="default"
        includedTestCases={mockTestCases}
        confirmedMappings={[]}
      />
    );

    const prepareBtn = screen.getByRole("button", { name: /prepare tests/i });
    expect(prepareBtn).toBeDisabled();
  });
});