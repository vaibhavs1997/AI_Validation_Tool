/**
 * ApiMatchingService
 *
 * STEP 5.5D — Frontend service for TestCase → API Endpoint matching.
 * Calls POST /api/test-cases/match on the backend.
 */

import { apiClient } from "../../services";
import type { MatchTestCasesRequest, MatchTestCasesResponse } from "../../types";

/**
 * Match included TestCases against registered project API operations.
 *
 * @param projectId - The project ID
 * @param testCases - The included TestCase objects (canonical, API-independent)
 * @returns Match results with one entry per input TestCase
 */
export async function matchTestCases(
  projectId: string,
  testCases: MatchTestCasesRequest["testCases"]
): Promise<MatchTestCasesResponse> {
  const response = await apiClient.post<MatchTestCasesResponse>("/api/test-cases/match", {
    projectId,
    testCases,
  });
  return response;
}
