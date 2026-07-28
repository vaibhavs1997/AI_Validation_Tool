/**
 * Demo/Sample data for ResultsPage and HistoryPage.
 *
 * These are used to display placeholder content when no real data exists,
 * demonstrating the UI layout to users.
 */

import type { RunDetail, RunSummary } from "../../types";

/**
 * Sample RunDetail for the ResultsPage empty state.
 */
export const sampleRunDetail: RunDetail = {
  id: "sample-run-1",
  title: "Sample Validation Run",
  description: "This is a sample report to demonstrate the Results page.",
  status: "passed",
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: 3420,
  projectId: "default",
  testSpecification: {
    id: "ts-1",
    title: "User login flow",
    description: "Sample test specification for demonstration",
    requirementRefs: [{ acIndex: 1, acText: "Valid login returns token" }],
    operationRefs: [
      { serviceId: "user-api", operationId: "getUser", method: "GET", path: "/users/{id}" },
      { serviceId: "user-api", operationId: "createUser", method: "POST", path: "/users" },
      { serviceId: "auth-api", operationId: "login", method: "POST", path: "/auth/login" }
    ],
    expectedBehavior: { status: 200, responseAssertions: ["token exists", "expiresIn > 0"] }
  },
  targetOperation: { serviceId: "auth-api", operationId: "login" },
  results: [
    {
      step: 1,
      operation: { serviceId: "user-api", operationId: "getUser", method: "GET", path: "/users/{id}" },
      status: "passed",
      response: { id: 1, name: "Test User", email: "test@example.com" }
    },
    {
      step: 2,
      operation: { serviceId: "user-api", operationId: "createUser", method: "POST", path: "/users" },
      status: "passed",
      response: { id: 2, name: "New User", email: "new@example.com" }
    },
    {
      step: 3,
      operation: { serviceId: "auth-api", operationId: "login", method: "POST", path: "/auth/login" },
      status: "failed",
      request: { username: "test", password: "wrong" },
      error: "401 Unauthorized: Invalid credentials"
    }
  ],
  executionPlanSummary: {
    target: { serviceId: "auth-api", operationId: "login" },
    stepCount: 3,
    operations: [
      { serviceId: "user-api", operationId: "getUser", method: "GET", path: "/users/{id}" },
      { serviceId: "user-api", operationId: "createUser", method: "POST", path: "/users" },
      { serviceId: "auth-api", operationId: "login", method: "POST", path: "/auth/login" }
    ]
  },
  errors: []
};

/**
 * Sample RunSummary for the HistoryPage empty state.
 */
export function createSampleRunSummary(projectId: string): RunSummary {
  return {
    id: "sample-run-1",
    projectId: projectId || "default",
    testSpecificationId: "ts-1",
    title: "Sample Validation Run",
    description: "Sample run to demonstrate the History page.",
    status: "passed",
    targetServiceId: "auth-api",
    targetOperationId: "login",
    stepCount: 3,
    passedSteps: 2,
    failedSteps: 1,
    blockedSteps: 0,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 3420,
  };
}