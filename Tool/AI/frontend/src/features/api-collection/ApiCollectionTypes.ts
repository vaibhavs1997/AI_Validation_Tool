/**
 * API Collection TypeScript Types
 * Based on actual backend contract parser implementation
 */

/**
 * Supported HTTP methods from the backend parser
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

/**
 * Contract source types detected by the backend parser
 */
export type ContractType = "openapi" | "postman" | "har";

/**
 * Flexible schema type for dynamic OpenAPI/JSON schemas
 * Uses unknown for type safety instead of any
 */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  items?: JsonSchema | Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Parameter from API specification
 */
export interface ApiParameter {
  name?: string;
  value?: string;
  [key: string]: unknown;
}

/**
 * Endpoint model based on backend normalized structure
 */
export interface ApiEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: ApiParameter[];
  requestSchema: JsonSchema | null;
  responses: Record<string, string>;
  responseSchemas: Record<string, JsonSchema>;
}

/**
 * Normalized API contract structure
 * Matches the backend contract parser output
 * Note: importedAt is always present in all parser outputs
 */
export interface ApiContract {
  type: ContractType;
  title: string;
  version: string;
  baseUrl: string;
  endpoints: ApiEndpoint[];
  importedAt: string;
}

/**
 * Request for parsing API contract
 * Backend supports both contract object and content string
 */
export interface ParseContractRequest {
  contract?: unknown;
  content?: string;
  name?: string;
}

/**
 * Response from contract parsing endpoint
 */
export interface ParseContractResponse {
  contract: ApiContract;
}

/**
 * UI file metadata for future upload state
 */
export interface ContractFileInfo {
  name: string;
  size: number;
  displayType: string;
}