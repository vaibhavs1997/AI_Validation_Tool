# Sprint 02 – API Catalog API Contracts

## Base URL

```
/api/v1/projects/:projectId/catalog
```

## Authentication

All endpoints require Bearer token authentication via `Authorization` header.

```
Authorization: Bearer <jwt-token>
```

---

## 1. Import Catalog

### `POST /import`

Import an API collection from file, URL, or pasted content.

#### Request

**Content-Type:** `multipart/form-data` (file upload) or `application/json` (URL/paste)

**Form Data (file upload):**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | API spec file (.json, .yaml, .yml, .har) |
| `projectId` | string | Yes | Project UUID |

**JSON Body (URL/paste):**
```json
{
  "projectId": "uuid",
  "source": "url" | "paste",
  "url": "https://api.example.com/openapi.yaml",
  "content": "{ \"openapi\": \"3.0.3\", ... }",
  "format": "openapi" | "swagger" | "postman" | "har"
}
```

#### Response (200 OK)

```json
{
  "version": {
    "id": "uuid",
    "version": "1.0.0",
    "format": "openapi",
    "importedAt": "2025-01-15T10:30:00Z",
    "importedBy": "user-uuid"
  },
  "services": [
    {
      "id": "uuid",
      "name": "Authentication",
      "description": "Auth endpoints",
      "baseUrl": "https://api.example.com",
      "version": "1.0.0",
      "health": {
        "status": "unknown",
        "lastChecked": null,
        "responseTime": null
      },
      "operationCount": 6
    }
  ],
  "summary": {
    "totalServices": 3,
    "totalOperations": 24,
    "totalSchemas": 12,
    "errors": 0,
    "warnings": 2
  },
  "warnings": [
    {
      "code": "DEPRECATED_ENDPOINT",
      "message": "2 endpoints marked as deprecated",
      "details": ["GET /v1/legacy", "POST /v1/old-flow"]
    }
  ]
}
```

#### Response (400 Bad Request)

```json
{
  "error": {
    "code": "IMPORT_FAILED",
    "message": "Invalid spec. Found 3 errors.",
    "details": [
      {
        "code": "CIRCULAR_REF",
        "message": "Circular $ref detected",
        "path": "#/components/schemas/Node",
        "line": 12,
        "severity": "error",
        "suggestion": "Remove circular reference or use oneOf"
      },
      {
        "code": "MISSING_FIELD",
        "message": "Missing required field: info.title",
        "path": "info.title",
        "line": 3,
        "severity": "error",
        "suggestion": "Add: \"title\": \"My API\""
      }
    ]
  }
}
```

#### Response (413 Payload Too Large)

```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "File size exceeds 50MB limit",
    "maxSize": "50MB"
  }
}
```

---

## 2. Get Catalog

### `GET /`

Retrieve the latest imported catalog for the project.

#### Response (200 OK)

```json
{
  "version": {
    "id": "uuid",
    "version": "1.0.0",
    "format": "openapi",
    "importedAt": "2025-01-15T10:30:00Z",
    "importedBy": "user-uuid"
  },
  "services": [
    {
      "id": "uuid",
      "name": "Authentication",
      "description": "Auth endpoints",
      "baseUrl": "https://api.example.com",
      "version": "1.0.0",
      "health": {
        "status": "healthy",
        "lastChecked": "2025-01-15T12:00:00Z",
        "responseTime": 45
      },
      "operationCount": 6,
      "operations": [
        {
          "id": "uuid",
          "path": "/auth/login",
          "method": "POST",
          "summary": "Authenticate user",
          "description": "Returns JWT tokens",
          "deprecated": false,
          "parameters": [],
          "requestBody": {
            "contentType": "application/json",
            "schema": {
              "type": "object",
              "properties": {
                "email": { "type": "string" },
                "password": { "type": "string" }
              },
              "required": ["email", "password"]
            },
            "required": true
          },
          "responses": [
            {
              "statusCode": 200,
              "description": "Successful authentication",
              "schema": {
                "type": "object",
                "properties": {
                  "access_token": { "type": "string" },
                  "refresh_token": { "type": "string" }
                }
              }
            },
            {
              "statusCode": 401,
              "description": "Invalid credentials",
              "schema": {
                "type": "object",
                "properties": {
                  "error": { "type": "string" }
                }
              }
            }
          ]
        }
      ]
    }
  ]
}
```

#### Response (404 Not Found)

```json
{
  "error": {
    "code": "CATALOG_NOT_FOUND",
    "message": "No catalog imported for this project"
  }
}
```

---

## 3. List Services

### `GET /services`

List all services in the latest catalog version.

#### Response (200 OK)

```json
[
  {
    "id": "uuid",
    "name": "Authentication",
    "description": "Auth endpoints",
    "baseUrl": "https://api.example.com",
    "version": "1.0.0",
    "health": {
      "status": "healthy",
      "lastChecked": "2025-01-15T12:00:00Z",
      "responseTime": 45
    },
    "operationCount": 6
  }
]
```

---

## 4. Get Service Operations

### `GET /services/:serviceId/operations`

List all operations for a specific service.

#### Response (200 OK)

```json
[
  {
    "id": "uuid",
    "path": "/auth/login",
    "method": "POST",
    "summary": "Authenticate user",
    "description": "Returns JWT tokens",
    "deprecated": false,
    "parameters": [],
    "requestBody": { /* ... */ },
    "responses": [ /* ... */ ]
  }
]
```

#### Response (404 Not Found)

```json
{
  "error": {
    "code": "SERVICE_NOT_FOUND",
    "message": "Service not found in catalog"
  }
}
```

---

## 5. Search Operations

### `GET /operations/search`

Full-text search and filter across all operations.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | No | Search query (searches path, summary, description) |
| `methods` | string[] | No | Filter by HTTP methods (comma-separated) |
| `services` | string[] | No | Filter by service IDs (comma-separated UUIDs) |
| `health` | string[] | No | Filter by health status (comma-separated: healthy, degraded, failing, unknown) |

#### Example Request

```
GET /api/v1/projects/123/catalog/operations/search?q=payment&methods=POST,GET&health=healthy
```

#### Response (200 OK)

```json
{
  "query": "payment",
  "filters": {
    "methods": ["POST", "GET"],
    "services": [],
    "health": ["healthy"]
  },
  "total": 8,
  "results": [
    {
      "id": "uuid",
      "serviceId": "uuid",
      "serviceName": "Payments",
      "path": "/v1/payments",
      "method": "POST",
      "summary": "Create payment",
      "description": "Creates a new payment intent",
      "deprecated": false,
      "health": {
        "status": "healthy",
        "responseTime": 45,
        "lastChecked": "2025-01-15T12:00:00Z"
      }
    }
  ]
}
```

---

## 6. Run Health Check

### `POST /health-check`

Trigger health checks on service endpoints.

#### Request Body

```json
{
  "serviceId": "uuid" | null,
  "checkAll": false
}
```

- If `serviceId` provided: check only that service
- If `checkAll: true`: check all services
- If neither: check all services (default)

#### Response (200 OK)

```json
[
  {
    "serviceId": "uuid",
    "serviceName": "Payments",
    "status": "healthy",
    "checkedAt": "2025-01-15T12:30:00Z",
    "avgResponseTime": 45,
    "totalEndpoints": 12,
    "healthyEndpoints": 10,
    "degradedEndpoints": 2,
    "failingEndpoints": 0,
    "endpoints": [
      {
        "operationId": "uuid",
        "path": "/v1/payments",
        "method": "POST",
        "status": "healthy",
        "responseTime": 45,
        "statusCode": 200,
        "lastChecked": "2025-01-15T12:30:00Z"
      }
    ]
  }
]
```

#### Response (202 Accepted)

```json
{
  "message": "Health check queued",
  "jobId": "uuid",
  "estimatedTime": "30s"
}
```

If health checks are queued for background processing.

---

## 7. Get Operation Detail

### `GET /operations/:operationId`

Get full details for a specific operation.

#### Response (200 OK)

```json
{
  "id": "uuid",
  "serviceId": "uuid",
  "serviceName": "Payments",
  "path": "/v1/payments/{id}",
  "method": "GET",
  "summary": "Retrieve payment",
  "description": "Get payment details by ID",
  "deprecated": false,
  "parameters": [
    {
      "name": "id",
      "in": "path",
      "type": "string",
      "required": true,
      "description": "Payment ID"
    },
    {
      "name": "expand",
      "in": "query",
      "type": "string",
      "required": false,
      "description": "Expand related objects",
      "default": null
    }
  ],
  "requestBody": null,
  "responses": [
    {
      "statusCode": 200,
      "description": "Payment details",
      "schema": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "amount": { "type": "number" },
          "currency": { "type": "string" },
          "status": { "type": "string", "enum": ["pending", "completed", "failed"] }
        }
      }
    },
    {
      "statusCode": 404,
      "description": "Payment not found",
      "schema": {
        "type": "object",
        "properties": {
          "error": { "type": "string" }
        }
      }
    }
  ],
  "health": {
    "status": "healthy",
    "responseTime": 12,
    "lastChecked": "2025-01-15T12:00:00Z"
  }
}
```

---

## 8. Delete Catalog

### `DELETE /`

Delete the entire catalog for a project.

#### Response (200 OK)

```json
{
  "message": "Catalog deleted successfully",
  "deletedVersionId": "uuid"
}
```

#### Response (409 Conflict)

```json
{
  "error": {
    "code": "CATALOG_IN_USE",
    "message": "Cannot delete catalog with active executions",
    "activeExecutions": 2
  }
}
```

---

## 9. List Versions

### `GET /versions`

List all catalog versions for the project.

#### Response (200 OK)

```json
[
  {
    "id": "uuid",
    "version": "1.0.0",
    "format": "openapi",
    "importedAt": "2025-01-15T10:30:00Z",
    "importedBy": "user-uuid",
    "serviceCount": 3,
    "operationCount": 24
  },
  {
    "id": "uuid",
    "version": "0.9.0",
    "format": "openapi",
    "importedAt": "2025-01-10T08:00:00Z",
    "importedBy": "user-uuid",
    "serviceCount": 2,
    "operationCount": 18
  }
]
```

---

## 10. Switch Version

### `POST /versions/:versionId/activate`

Switch to a specific catalog version.

#### Response (200 OK)

```json
{
  "version": {
    "id": "uuid",
    "version": "0.9.0",
    "activatedAt": "2025-01-15T13:00:00Z"
  }
}
```

---

## 11. Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `CATALOG_NOT_FOUND` | 404 | No catalog exists for project |
| `SERVICE_NOT_FOUND` | 404 | Service not found in catalog |
| `OPERATION_NOT_FOUND` | 404 | Operation not found |
| `VERSION_NOT_FOUND` | 404 | Catalog version not found |
| `IMPORT_FAILED` | 400 | Spec validation/parsing failed |
| `FILE_TOO_LARGE` | 413 | File exceeds 50MB limit |
| `UNSUPPORTED_FORMAT` | 400 | File format not recognized |
| `INVALID_URL` | 400 | URL fetch failed or invalid |
| `CATALOG_IN_USE` | 409 | Cannot delete catalog with active executions |
| `HEALTH_CHECK_FAILED` | 500 | Health check service error |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 12. Rate Limiting

- **Import:** 5 requests per minute per user
- **Health Check:** 10 requests per minute per project
- **Search:** 100 requests per minute per user
- **Other:** 1000 requests per hour per user

Rate limit headers included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1705...
```

---

## 13. Webhooks (Future)

TestForge can notify external systems when catalog changes:

```
POST /webhooks/catalog-updated
```

**Payload:**

```json
{
  "projectId": "uuid",
  "event": "catalog.imported",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "versionId": "uuid",
    "serviceCount": 3,
    "operationCount": 24
  }
}
```

---

## 14. OpenAPI Specification (Backend)

```yaml
openapi: 3.0.0
info:
  title: TestForge Catalog API
  version: 1.0.0
  description: API Catalog module endpoints

servers:
  - url: /api/v1/projects/{projectId}/catalog
    variables:
      projectId:
        description: Project UUID

paths:
  /import:
    post:
      summary: Import API collection
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                projectId:
                  type: string
                  format: uuid
          application/json:
            schema:
              $ref: '#/components/schemas/ImportRequest'
      responses:
        '200':
          description: Import successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ImportResult'
        '400':
          $ref: '#/components/responses/BadRequest'
        '413':
          $ref: '#/components/responses/PayloadTooLarge'

  /:
    get:
      summary: Get latest catalog
      responses:
        '200':
          description: Catalog retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Catalog'
        '404':
          $ref: '#/components/responses/NotFound'
    delete:
      summary: Delete catalog
      responses:
        '200':
          description: Catalog deleted
        '409':
          $ref: '#/components/responses/Conflict'

  /services:
    get:
      summary: List services
      responses:
        '200':
          description: Services list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Service'

  /services/{serviceId}/operations:
    get:
      summary: List operations for service
      parameters:
        - name: serviceId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Operations list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Operation'
        '404':
          $ref: '#/components/responses/NotFound'

  /operations/search:
    get:
      summary: Search operations
      parameters:
        - name: q
          in: query
          schema:
            type: string
        - name: methods
          in: query
          schema:
            type: array
            items:
              type: string
        - name: services
          in: query
          schema:
            type: array
            items:
              type: string
              format: uuid
        - name: health
          in: query
          schema:
            type: array
            items:
              type: string
      responses:
        '200':
          description: Search results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SearchResult'

  /health-check:
    post:
      summary: Run health checks
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/HealthCheckRequest'
      responses:
        '200':
          description: Health check results
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/HealthResult'
        '202':
          description: Health check queued

components:
  schemas:
    ImportRequest:
      type: object
      properties:
        source:
          type: string
          enum: [url, paste]
        url:
          type: string
          format: uri
        content:
          type: string
        format:
          type: string
          enum: [openapi, swagger, postman, har]

    ImportResult:
      type: object
      properties:
        version:
          $ref: '#/components/schemas/CatalogVersion'
        services:
          type: array
          items:
            $ref: '#/components/schemas/Service'
        summary:
          $ref: '#/components/schemas/ImportSummary'
        warnings:
          type: array
          items:
            $ref: '#/components/schemas/ImportWarning'

    Catalog:
      type: object
      properties:
        version:
          $ref: '#/components/schemas/CatalogVersion'
        services:
          type: array
          items:
            $ref: '#/components/schemas/Service'

    CatalogVersion:
      type: object
      properties:
        id:
          type: string
          format: uuid
        version:
          type: string
        format:
          type: string
        importedAt:
          type: string
          format: date-time
        importedBy:
          type: string
          format: uuid

    Service:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        description:
          type: string
        baseUrl:
          type: string
        version:
          type: string
        health:
          $ref: '#/components/schemas/HealthStatus'
        operationCount:
          type: integer

    Operation:
      type: object
      properties:
        id:
          type: string
          format: uuid
        path:
          type: string
        method:
          type: string
        summary:
          type: string
        description:
          type: string
        deprecated:
          type: boolean
        parameters:
          type: array
          items:
            $ref: '#/components/schemas/Parameter'
        requestBody:
          $ref: '#/components/schemas/RequestBody'
        responses:
          type: array
          items:
            $ref: '#/components/schemas/Response'

    Parameter:
      type: object
      properties:
        name:
          type: string
        in:
          type: string
          enum: [query, path, header, cookie]
        type:
          type: string
        required:
          type: boolean
        default:
          type: any
        description:
          type: string

    RequestBody:
      type: object
      properties:
        contentType:
          type: string
        schema:
          $ref: '#/components/schemas/Schema'
        required:
          type: boolean

    Response:
      type: object
      properties:
        statusCode:
          type: integer
        description:
          type: string
        schema:
          $ref: '#/components/schemas/Schema'

    Schema:
      type: object
      properties:
        type:
          type: string
        properties:
          type: object
        required:
          type: array
          items:
            type: string

    HealthStatus:
      type: object
      properties:
        status:
          type: string
          enum: [healthy, degraded, failing, unknown]
        lastChecked:
          type: string
          format: date-time
        responseTime:
          type: integer
        error:
          type: string

    HealthCheckRequest:
      type: object
      properties:
        serviceId:
          type: string
          format: uuid
        checkAll:
          type: boolean

    HealthResult:
      type: object
      properties:
        serviceId:
          type: string
          format: uuid
        serviceName:
          type: string
        status:
          type: string
        checkedAt:
          type: string
          format: date-time
        avgResponseTime:
          type: number
        endpoints:
          type: array
          items:
            $ref: '#/components/schemas/EndpointHealth'

    EndpointHealth:
      type: object
      properties:
        operationId:
          type: string
          format: uuid
        path:
          type: string
        method:
          type: string
        status:
          type: string
        responseTime:
          type: integer
        statusCode:
          type: integer
        lastChecked:
          type: string
          format: date-time

    SearchResult:
      type: object
      properties:
        query:
          type: string
        filters:
          type: object
        total:
          type: integer
        results:
          type: array
          items:
            $ref: '#/components/schemas/OperationSearchResult'

    OperationSearchResult:
      type: object
      properties:
        id:
          type: string
          format: uuid
        serviceId:
          type: string
          format: uuid
        serviceName:
          type: string
        path:
          type: string
        method:
          type: string
        summary:
          type: string
        description:
          type: string
        deprecated:
          type: boolean
        health:
          $ref: '#/components/schemas/HealthStatus'

    ImportSummary:
      type: object
      properties:
        totalServices:
          type: integer
        totalOperations:
          type: integer
        totalSchemas:
          type: integer
        errors:
          type: integer
        warnings:
          type: integer

    ImportWarning:
      type: object
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: array
          items:
            type: string

  responses:
    BadRequest:
      description: Bad request
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: object
                properties:
                  code:
                    type: string
                  message:
                    type: string
                  details:
                    type: array
                    items:
                      type: object

    NotFound:
      description: Not found
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: object
                properties:
                  code:
                    type: string
                  message:
                    type: string

    Conflict:
      description: Conflict
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: object
                properties:
                  code:
                    type: string
                  message:
                    type: string

    PayloadTooLarge:
      description: Payload too large
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: object
                properties:
                  code:
                    type: string
                  message:
                    type: string
                  maxSize:
                    type: string
```

---

## 15. Frontend API Client

```typescript
// services/CatalogService.ts
import axios from 'axios';

export class CatalogService {
  constructor(private projectId: string, private token: string) {}

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
    };
  }

  async importFile(file: File): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', this.projectId);

    const response = await axios.post(
      `/api/v1/projects/${this.projectId}/catalog/import`,
      formData,
      {
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  }

  async importFromUrl(url: string): Promise<ImportResult> {
    const response = await axios.post(
      `/api/v1/projects/${this.projectId}/catalog/import`,
      { projectId: this.projectId, source: 'url', url },
      { headers: this.getHeaders() }
    );

    return response.data;
  }

  async importFromPaste(content: string, format: SpecFormat): Promise<ImportResult> {
    const response = await axios.post(
      `/api/v1/projects/${this.projectId}/catalog/import`,
      { projectId: this.projectId, source: 'paste', content, format },
      { headers: this.getHeaders() }
    );

    return response.data;
  }

  async getCatalog(): Promise<Catalog> {
    const response = await axios.get(
      `/api/v1/projects/${this.projectId}/catalog`,
      { headers: this.getHeaders() }
    );

    return response.data;
  }

  async search(query: string, filters: FilterState): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (filters.methods.length) params.append('methods', filters.methods.join(','));
    if (filters.services.length) params.append('services', filters.services.join(','));
    if (filters.health.length) params.append('health', filters.health.join(','));

    const response = await axios.get(
      `/api/v1/projects/${this.projectId}/catalog/operations/search?${params.toString()}`,
      { headers: this.getHeaders() }
    );

    return response.data;
  }

  async runHealthCheck(serviceId?: string): Promise<HealthResult[]> {
    const response = await axios.post(
      `/api/v1/projects/${this.projectId}/catalog/health-check`,
      { serviceId, checkAll: !serviceId },
      { headers: this.getHeaders() }
    );

    return response.data;
  }

  async getOperation(operationId: string): Promise<Operation> {
    const response = await axios.get(
      `/api/v1/projects/${this.projectId}/catalog/operations/${operationId}`,
      { headers: this.getHeaders() }
    );

    return response.data;
  }

  async deleteCatalog(): Promise<void> {
    await axios.delete(
      `/api/v1/projects/${this.projectId}/catalog`,
      { headers: this.getHeaders() }
    );
  }
}
```

---

## 16. Request/Response Examples

### Example 1: Import OpenAPI File

**Request:**

```bash
curl -X POST https://api.testforge.io/api/v1/projects/123/catalog/import \
  -H "Authorization: Bearer <token>" \
  -F "file=@openapi.yaml" \
  -F "projectId=123"
```

**Response:**

```json
{
  "version": { "id": "ver-123", "version": "1.0.0", "format": "openapi", "importedAt": "2025-01-15T10:30:00Z" },
  "services": [ /* ... */ ],
  "summary": {
    "totalServices": 3,
    "totalOperations": 24,
    "totalSchemas": 12,
    "errors": 0,
    "warnings": 2
  },
  "warnings": []
}
```

### Example 2: Search Operations

**Request:**

```bash
curl "https://api.testforge.io/api/v1/projects/123/catalog/operations/search?q=payment&methods=POST,GET&health=healthy" \
  -H "Authorization: Bearer <token>"
```

**Response:**

```json
{
  "query": "payment",
  "filters": {
    "methods": ["POST", "GET"],
    "services": [],
    "health": ["healthy"]
  },
  "total": 8,
  "results": [ /* ... */ ]
}
```

### Example 3: Run Health Check

**Request:**

```bash
curl -X POST https://api.testforge.io/api/v1/projects/123/catalog/health-check \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"checkAll": true}'
```

**Response:**

```json
[
  {
    "serviceId": "svc-123",
    "serviceName": "Payments",
    "status": "healthy",
    "checkedAt": "2025-01-15T12:30:00Z",
    "avgResponseTime": 45,
    "totalEndpoints": 12,
    "healthyEndpoints": 10,
    "degradedEndpoints": 2
  }
]