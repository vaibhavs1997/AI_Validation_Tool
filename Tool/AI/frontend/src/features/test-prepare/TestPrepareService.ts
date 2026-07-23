/**
 * TestPrepareService
 *
 * STEP 5.5E — Frontend service for preparing TestSpecifications
 * from confirmed TestCase/API mappings.
 *
 * Calls POST /api/test-specifications/prepare on the backend.
 */

import { apiClient } from "../../services";
import type { TestCase, TestCaseApiMapping, PrepareResponse } from "../../types";

/**
 * Prepare TestSpecifications and ExecutionPlans from confirmed mappings.
 *
 * @param projectId - The project ID
 * @param testCases - The included canonical TestCase objects
 * @param mappings - The confirmed TestCaseApiMapping objects
 * @returns Preparation results with specs, plans, and unresolved tests
 */
export async function prepareTestSpecifications(
  projectId: string,
  testCases: TestCase[],
  mappings: TestCaseApiMapping[]
): Promise<PrepareResponse> {
  const response = await apiClient.post<PrepareResponse>("/api/test-specifications/prepare", {
    projectId,
    testCases,
    mappings,
  });
  return response;
}