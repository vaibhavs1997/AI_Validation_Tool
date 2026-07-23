/**
 * API Error type for consistent error handling
 */
export interface ApiError extends Error {
  status: number;
  statusText: string;
}

/**
 * Creates a typed API error
 */
export function createApiError(response: Response, data: Record<string, unknown> | null): ApiError {
  // Try to extract error message from response body, fallback to status text
  const message = (data?.error as string) || response.statusText || "Unknown error";
  const error: ApiError = {
    name: "ApiError",
    message,
    status: response.status,
    statusText: response.statusText,
  };
  return error;
}

/**
 * Request options for API calls
 */
export interface ApiRequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

/**
 * Generic API request helper for communicating with the Express backend.
 * Works through Vite dev server proxy at /api/*
 */
export async function apiRequest<T = unknown>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  // Try to parse response as JSON; if that fails, try reading as text
  let data: Record<string, unknown> | null = null;
  try {
    data = await response.json();
  } catch {
    try {
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          // Not JSON, use text as fallback error info
          data = { error: text };
        }
      }
    } catch {
      // Response body unreadable, data stays null
    }
  }

  if (!response.ok) {
    throw createApiError(response, data);
  }

  return data as T;
}

/**
 * Convenience methods for common HTTP verbs
 */
export const apiClient = {
  get: <T = unknown>(endpoint: string): Promise<T> =>
    apiRequest<T>(endpoint, { method: "GET" }),

  post: <T = unknown>(endpoint: string, body: unknown): Promise<T> =>
    apiRequest<T>(endpoint, { method: "POST", body: JSON.stringify(body) }),

  delete: <T = unknown>(endpoint: string): Promise<T> =>
    apiRequest<T>(endpoint, { method: "DELETE" }),
};