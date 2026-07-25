# TestForge — Sprint 01: Project Foundation

## API Contracts

**Document Version:** 1.0
**Sprint:** Sprint 01
**Date:** 2026-07-25
**Author:** Lead Product Architect

---

## 1. Overview

This document defines the REST API contracts for Sprint 01: Project Foundation. All endpoints are relative to the backend server running at `http://localhost:4173` (or configured `PORT`).

### 1.1 Base URL

```
http://localhost:4173/api
```

### 1.2 Content Type

All requests and responses use `application/json; charset=utf-8`.

### 1.3 CORS

CORS is open (`*`). All methods (`GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS`) are allowed.

### 1.4 Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message"
}
```

### 1.5 HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST (project creation) |
| 400 | Bad Request | Validation error, missing required fields |
| 404 | Not Found | Project not found |
| 409 | Conflict | Duplicate project ID |
| 500 | Internal Server Error | Unexpected server error |

---

## 2. Endpoints

### 2.1 List Projects

Returns a paginated list of all projects.

**Method:** `GET`  
**Path:** `/api/projects`  
**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `search` | string | No | — | Search query to filter projects by ID or name |
| `sort` | string | No | `id` | Sort field: `id`, `name`, `createdAt`, `updatedAt` |
| `order` | string | No | `asc` | Sort order: `asc` or `desc` |
| `limit` | number | No | 100 | Maximum number of projects to return |
| `offset` | number | No | 0 | Number of projects to skip |

**Request:**

```http
GET /api/projects?search=payments&sort=name&order=desc HTTP/1.1
Host: localhost:4173
Content-Type: application/json
```

**Response (200 OK):**

```json
{
  "projects": [
    {
      "id": "payments-api",
      "name": "Payments API",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-07-20T14:22:00.000Z"
    },
    {
      "id": "default",
      "name": "Default Project",
      "createdAt": "1970-01-01T00:00:00.000Z",
      "updatedAt": "1970-01-01T00:00:00.000Z"
    }
  ],
  "total": 2,
  "limit": 100,
  "offset": 0
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `projects` | array of Project | List of projects |
| `total` | number | Total number of projects (after filtering) |
| `limit` | number | Maximum number of projects returned |
| `offset` | number | Number of projects skipped |

**Error Responses:**

```json
// 500 Internal Server Error
{
  "error": "Failed to list projects: <error details>"
}
```

---

### 2.2 Get Project

Returns a single project by ID.

**Method:** `GET`  
**Path:** `/api/projects/{id}`  
**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Project ID (URL-encoded) |

**Request:**

```http
GET /api/projects/payments-api HTTP/1.1
Host: localhost:4173
Content-Type: application/json
```

**Response (200 OK):**

```json
{
  "project": {
    "id": "payments-api",
    "name": "Payments API",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-07-20T14:22:00.000Z"
  }
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `project` | Project | The requested project |

**Error Responses:**

```json
// 404 Not Found
{
  "error": "Project not found: payments-api"
}
```

---

### 2.3 Create Project

Creates a new project.

**Method:** `POST`  
**Path:** `/api/projects`  
**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `id` | string | Yes | 1-100 chars, `[a-zA-Z0-9._-]+` | Project ID (unique) |
| `name` | string | No | Non-empty if provided | Project name (defaults to ID) |
| `createdAt` | string | No | Valid ISO date | Creation timestamp (defaults to now) |
| `updatedAt` | string | No | Valid ISO date | Update timestamp (defaults to now) |

**Request:**

```http
POST /api/projects HTTP/1.1
Host: localhost:4173
Content-Type: application/json

{
  "id": "payments-api",
  "name": "Payments API"
}
```

**Response (200 OK):**

```json
{
  "project": {
    "id": "payments-api",
    "name": "Payments API",
    "createdAt": "2025-07-25T13:00:00.000Z",
    "updatedAt": "2025-07-25T13:00:00.000Z"
  }
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `project` | Project | The created project |

**Error Responses:**

```json
// 400 Bad Request — Missing ID
{
  "error": "Project identity id must be a non-empty string."
}

// 400 Bad Request — Invalid ID format
{
  "error": "Project ID must contain only alphanumeric characters, hyphens, underscores, and dots."
}

// 400 Bad Request — ID too long
{
  "error": "Project ID must be at most 100 characters."
}

// 409 Conflict — Duplicate ID
{
  "error": "Project already exists: payments-api"
}
```

---

### 2.4 Update Project

Updates an existing project's name.

**Method:** `PATCH`  
**Path:** `/api/projects/{id}`  
**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Project ID (URL-encoded) |

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | Yes | Non-empty | Updated project name |

**Request:**

```http
PATCH /api/projects/payments-api HTTP/1.1
Host: localhost:4173
Content-Type: application/json

{
  "name": "Payments API v2"
}
```

**Response (200 OK):**

```json
{
  "project": {
    "id": "payments-api",
    "name": "Payments API v2",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-07-25T13:05:00.000Z"
  }
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `project` | Project | The updated project |

**Error Responses:**

```json
// 400 Bad Request — Empty name
{
  "error": "Project identity name must be a non-empty string."
}

// 404 Not Found
{
  "error": "Project not found: payments-api"
}
```

---

### 2.5 Delete Project

Deletes a project.

**Method:** `DELETE`  
**Path:** `/api/projects/{id}`  
**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Project ID (URL-encoded) |

**Request:**

```http
DELETE /api/projects/payments-api HTTP/1.1
Host: localhost:4173
Content-Type: application/json
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Project deleted successfully",
  "id": "payments-api"
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` on success |
| `message` | string | Success message |
| `id` | string | The deleted project ID |

**Error Responses:**

```json
// 400 Bad Request — Cannot delete default project
{
  "error": "Cannot delete the default project"
}

// 404 Not Found
{
  "error": "Project not found: payments-api"
}
```

---

## 3. Data Schemas

### 3.1 Project

```typescript
interface Project {
  /**
   * Unique project identifier.
   * - Pattern: [a-zA-Z0-9._-]+
   * - Max length: 100 characters
   * - Immutable after creation
   */
  id: string;

  /**
   * Human-readable project name.
   * - Defaults to the project ID if not provided
   * - Can be updated
   */
  name: string;

  /**
   * ISO 8601 timestamp of project creation.
   * - Set automatically on creation
   * - Immutable after creation
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp of last project update.
   * - Updated on every modification
   */
  updatedAt: string;
}
```

### 3.2 CreateProjectRequest

```typescript
interface CreateProjectRequest {
  /**
   * Project ID (required).
   * Must be unique, 1-100 characters, alphanumeric + hyphens/underscores/dots.
   */
  id: string;

  /**
   * Project name (optional).
   * Defaults to the project ID if not provided.
   */
  name?: string;

  /**
   * Creation timestamp (optional).
   * Defaults to current time if not provided.
   */
  createdAt?: string;

  /**
   * Update timestamp (optional).
   * Defaults to current time if not provided.
   */
  updatedAt?: string;
}
```

### 3.3 UpdateProjectRequest

```typescript
interface UpdateProjectRequest {
  /**
   * Updated project name.
   * Must be non-empty.
   */
  name: string;
}
```

### 3.4 ListProjectsResponse

```typescript
interface ListProjectsResponse {
  /**
   * Array of projects.
   */
  projects: Project[];

  /**
   * Total number of projects (after filtering).
   */
  total: number;

  /**
   * Maximum number of projects returned.
   */
  limit: number;

  /**
   * Number of projects skipped.
   */
  offset: number;
}
```

### 3.5 GetProjectResponse

```typescript
interface GetProjectResponse {
  /**
   * The requested project.
   */
  project: Project;
}
```

### 3.6 CreateProjectResponse

```typescript
interface CreateProjectResponse {
  /**
   * The created project.
   */
  project: Project;
}
```

### 3.7 UpdateProjectResponse

```typescript
interface UpdateProjectResponse {
  /**
   * The updated project.
   */
  project: Project;
}
```

### 3.8 DeleteProjectResponse

```typescript
interface DeleteProjectResponse {
  /**
   * Always true on success.
   */
  success: boolean;

  /**
   * Success message.
   */
  message: string;

  /**
   * The deleted project ID.
   */
  id: string;
}
```

### 3.9 ErrorResponse

```typescript
interface ErrorResponse {
  /**
   * Human-readable error message.
   */
  error: string;
}
```

---

## 4. Validation Rules

### 4.1 Project ID

| Rule | Constraint | Error Message |
|------|-----------|---------------|
| Required | Must be provided | "Project identity id must be a non-empty string." |
| Type | Must be a string | "Project identity id must be a non-empty string." |
| Length | 1-100 characters | "Project ID must be at most 100 characters." |
| Pattern | `[a-zA-Z0-9._-]+` | "Project ID must contain only alphanumeric characters, hyphens, underscores, and dots." |
| Uniqueness | Must not already exist | "Project already exists: {id}" |

### 4.2 Project Name

| Rule | Constraint | Error Message |
|------|-----------|---------------|
| Required | Only if provided | "Project identity name must be a non-empty string." |
| Type | Must be a string | "Project identity name must be a non-empty string." |
| Non-empty | Must not be empty/whitespace | "Project identity name must be a non-empty string." |

### 4.3 Query Parameters

| Parameter | Rule | Error Message |
|-----------|------|---------------|
| `search` | Optional, string | N/A (empty string returns all) |
| `sort` | Optional, enum | "Invalid sort field. Use: id, name, createdAt, updatedAt" |
| `order` | Optional, enum | "Invalid sort order. Use: asc or desc" |
| `limit` | Optional, number | "Limit must be a positive number" |
| `offset` | Optional, number | "Offset must be a non-negative number" |

---

## 5. Backward Compatibility

### 5.1 Existing Endpoints (Unchanged)

| Method | Path | Status |
|--------|------|--------|
| `GET` | `/api/health` | Unchanged |
| `GET` | `/api/config/status` | Unchanged |
| `GET` | `/api/services` | Unchanged |
| `POST` | `/api/services/register` | Unchanged |
| `GET` | `/api/services/:projectId/:serviceId` | Unchanged |
| `GET` | `/api/knowledge` | Unchanged |
| `GET` | `/api/knowledge/relationships/:status` | Unchanged |
| `POST` | `/api/knowledge/instructions` | Unchanged |
| `POST` | `/api/knowledge/relationships/confirm` | Unchanged |
| `POST` | `/api/knowledge/relationships/reject` | Unchanged |
| `POST` | `/api/jira/ticket` | Unchanged |
| `POST` | `/api/jira/jql` | Unchanged |
| `POST` | `/api/contracts/parse` | Unchanged |
| `POST` | `/api/contracts/diff` | Unchanged |
| `POST` | `/api/test-cases/generate` | Unchanged |
| `POST` | `/api/test-cases/match` | Unchanged |
| `POST` | `/api/test-specifications/prepare` | Unchanged |
| `POST` | `/api/runs/execute-dependent` | Unchanged |
| `GET` | `/api/runs` | Unchanged |
| `GET` | `/api/runs/:id` | Unchanged |
| `DELETE` | `/api/runs/:id` | Unchanged |
| `GET` | `/api/reports/:id.html` | Unchanged |

### 5.2 Enhanced Endpoints

| Method | Path | Enhancement | Backward Compatible? |
|--------|------|-------------|---------------------|
| `GET` | `/api/projects` | Added optional `search`, `sort`, `order`, `limit`, `offset` query parameters | Yes — all new params are optional |
| `POST` | `/api/projects` | Added stricter validation (ID pattern, length) | Mostly — may reject previously accepted invalid IDs |

### 5.3 New Endpoints

| Method | Path | Backward Compatible? |
|--------|------|---------------------|
| `PATCH` | `/api/projects/:id` | Yes — new endpoint |
| `DELETE` | `/api/projects/:id` | Yes — new endpoint |

---

## 6. Rate Limiting

No rate limiting is implemented in the MVP. All requests are processed immediately.

---

## 7. Authentication

No authentication is required for any endpoint in the MVP. All data is local.

---

## 8. Examples

### 8.1 Create a Project

```bash
curl -X POST http://localhost:4173/api/projects \
  -H "Content-Type: application/json" \
  -d '{"id": "payments-api", "name": "Payments API"}'
```

### 8.2 List All Projects

```bash
curl http://localhost:4173/api/projects
```

### 8.3 List Projects with Search

```bash
curl "http://localhost:4173/api/projects?search=payments&sort=name&order=desc"
```

### 8.4 Get a Project

```bash
curl http://localhost:4173/api/projects/payments-api
```

### 8.5 Update a Project

```bash
curl -X PATCH http://localhost:4173/api/projects/payments-api \
  -H "Content-Type: application/json" \
  -d '{"name": "Payments API v2"}'
```

### 8.6 Delete a Project

```bash
curl -X DELETE http://localhost:4173/api/projects/payments-api
```

---

*End of API Contracts — Sprint 01: Project Foundation*
