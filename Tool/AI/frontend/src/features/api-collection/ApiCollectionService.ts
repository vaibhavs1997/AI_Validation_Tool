import { apiClient } from "../../services";
import type { ApiContract } from "./ApiCollectionTypes";

/**
 * API response shape for /api/contracts/parse endpoint
 */
interface ParseContractResponseDto {
  contract: ApiContract;
}

/**
 * Parses an API contract (OpenAPI, Postman, or HAR) via the backend.
 * Uses the generic API client with typed response.
 * 
 * @param contract - Parsed JSON object representing the contract
 * @param name - Optional name for the contract (used for storage)
 * @returns The normalized API contract
 */
export async function parseApiContract(contract: unknown, name?: string): Promise<ApiContract> {
  const response = await apiClient.post<ParseContractResponseDto>("/api/contracts/parse", { 
    contract, 
    name 
  });
  return response.contract;
}