# Sprint 02 – API Catalog Module

## Product Requirements Document

### Sprint Goal

Allow users to import OpenAPI, Swagger, Postman Collection, and HAR files, validate them, parse them into an API Catalog, review services and operations, search/filter endpoints, and persist the catalog.

---

## 1. User Stories

### US-201: Import API Collection

**As a** QA Engineer
**I want to** import my API collection from OpenAPI, Swagger, Postman, or HAR files
**So that** I can begin testing without manual endpoint entry

**Acceptance Criteria:**
- [ ] User can upload JSON/YAML OpenAPI 3.0/3.1 files via file picker
- [ ] User can upload Swagger 2.0 files
- [ ] User can upload Postman Collection v2.1
- [ ] User can upload HAR (HTTP Archive) files
- [ ] User can paste a URL to fetch a remote spec
- [ ] User can paste raw JSON/YAML content directly
- [ ] Import validates file format before parsing
- [ ] Import shows clear error for unsupported formats
- [ ] Import progress visible for large files (>10MB)

**Priority:** P0
**Points:** 8
**Dependencies:** None

---

### US-202: Parse and Validate API Specs

**As a** QA Engineer
**I want to** have my imported spec parsed and validated automatically
**So that** I know the catalog is accurate before proceeding

**Acceptance Criteria:**
- [ ] Spec is parsed into services, operations, parameters, schemas
- [ ] OpenAPI `$ref` schemas are resolved
- [ ] Circular `$ref` detection and reporting
- [ ] Missing required fields flagged with line numbers
- [ ] Duplicate operation IDs highlighted
- [ ] Deprecated endpoints marked with warning badge
- [ ] Parse errors shown inline with suggestions
- [ ] Successful parse shows summary: X services, Y endpoints, Z schemas

**Priority:** P0
**Points:** 8
**Dependencies:** US-201

---

### US-203: View API Catalog

**As a** QA Engineer
**I want to** browse all imported APIs in a structured catalog
**So that** I can understand what I'm testing

**Acceptance Criteria:**
- [ ] Services displayed as collapsible groups
- [ ] Each operation shows method badge (GET/POST/PUT/DELETE/etc.)
- [ ] Operation path, summary, and description visible
- [ ] Parameters listed with type, required flag, and default
- [ ] Request/response schemas expandable
- [ ] Service health indicator (green/yellow/red)
- [ ] Version info displayed if present in spec
- [ ] Group count and operation count visible

**Priority:** P0
**Points:** 5
**Dependencies:** US-202

---

### US-204: Search and Filter APIs

**As a** QA Engineer
**I want to** search and filter the API catalog
**So that** I can quickly find specific endpoints

**Acceptance Criteria:**
- [ ] Full-text search across paths, summaries, descriptions
- [ ] Filter by HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
- [ ] Filter by service/tag
- [ ] Filter by health status (healthy, degraded, unhealthy)
- [ ] Combined filters work together (AND logic)
- [ ] Search results update in real-time (<100ms)
- [ ] Clear all filters button
- [ ] Result count displayed (e.g., "12 of 28 endpoints")

**Priority:** P1
**Points:** 5
**Dependencies:** US-203

---

### US-205: Validate API Catalog

**As a** QA Engineer
**I want to** validate my catalog against live APIs
**So that** I can detect contract drift

**Acceptance Criteria:**
- [ ] User can trigger health check on selected service or all services
- [ ] Health check sends OPTIONS or HEAD request to base URL
- [ ] Response time recorded (p50, p95, p99 shown)
- [ ] TLS certificate expiry shown (future)
- [ ] Health status: green (<200ms), yellow (200-500ms), red (>500ms or error)
- [ ] Unreachable endpoints marked with error state
- [ ] Health results persisted per project
- [ ] Manual re-check available per endpoint

**Priority:** P1
**Points:** 5
**Dependencies:** US-203

---

### US-206: Manage API Versions

**As a** QA Engineer
**I want to** manage multiple versions of an API spec
**So that** I can test across releases

**Acceptance Criteria:**
- [ ] User can upload a new version of an existing service
- [ ] System detects version from spec `info.version` field
- [ ] Previous versions retained with timestamp
- [ ] User can switch between versions
- [ ] Diff view between two versions (added/removed/modified endpoints)
- [ ] Version label shown in catalog
- [ ] Migration impact summary (breaking changes highlighted)

**Priority:** P2
**Points:** 5
**Dependencies:** US-203

---

### US-207: Persist Catalog Across Sessions

**As a** QA Engineer
**I want to** have my catalog persisted across sessions
**So that** I don't need to re-import every time

**Acceptance Criteria:**
- [ ] Catalog stored in backend database per project
- [ ] User can return to project and see previously imported catalog
- [ ] Catalog includes parsed operations, schemas, versions, health results
- [ ] Background refresh available to re-parse and update
- [ ] Catalog export (JSON/YAML) for backup
- [ ] Catalog delete confirmation with cascade warning

**Priority:** P0
**Points:** 8
**Dependencies:** US-202, US-203

---

## 2. Functional Requirements

### FR-01: Import Service

**Priority:** P0
**Description:** System must accept API spec uploads via file picker, URL fetch, and paste.

**Supported Formats:**
- OpenAPI 3.0 / 3.1 (JSON, YAML)
- Swagger 2.0 (JSON, YAML)
- Postman Collection v2.1 (JSON)
- HAR 1.2 (JSON)

**Input Constraints:**
- Max file size: 50MB
- Allowed extensions: `.json`, `.yaml`, `.yml`, `.har`
- URL fetch timeout: 30s
- Paste max size: 10MB

---

### FR-02: Parsing Engine

**Priority:** P0
**Description:** System must normalize imported specs into canonical internal model.

**Core Entities:**
- `Service` – Group of endpoints (from OpenAPI `info`, tag, or hostname)
- `Operation` – Single endpoint (path + method)
- `Parameter` – Query, path, header, cookie parameter
- `RequestBody` – Request body schema
- `Response` – Response schema by status code
- `Schema` – JSON Schema object (resolved from `$ref`)

**Normalization Rules:**
- Path parameters normalized to `{param}` format
- `$ref` resolved recursively
- `allOf` flattened
- `oneOf`/`anyOf` preserved with discriminator
- Enum values extracted
- Example values preserved

---

### FR-03: Validation Service

**Priority:** P0
**Description:** System must validate specs against schema definitions and business rules.

**Validation Checks:**
- JSON Schema conformance (OpenAPI spec structure)
- Circular `$ref` detection
- Missing `info.title`, `info.version`
- Duplicate operation IDs
- Unused schema definitions
- Deprecated endpoints (if `deprecated: true`)
- Path parameter consistency (e.g., `{id}` matches `/items/{id}`)

**Error Reporting:**
- Error code, message, line number, severity
- Suggested fix where applicable
- Error count summary

---

### FR-04: Catalog Storage

**Priority:** P0
**Description:** Parsed catalog must be persisted per project.

**Storage Model:**
```
Project (1) ──→ (N) CatalogVersion
CatalogVersion (1) ──→ (N) Service
Service (1) ──→ (N) Operation
Operation (1) ──→ (N) Parameter
Operation (1) ──→ (N) Response
Response (1) ──→ (1) Schema
```

**Indexing:**
- Full-text search index on operation path, summary, description
- Method index (for filtering)
- Health status cache per service
- Version timestamp for diff

---

### FR-05: Search and Filter Engine

**Priority:** P1
**Description:** Fast search and multi-filter capability across catalog.

**Search Scope:**
- Operation path
- Operation summary/description
- Parameter name/description
- Schema property names

**Filter Logic:**
- Method filter: exact match on HTTP method
- Service filter: exact match on service ID or name
- Health filter: exact match on health status enum

**Performance:** Results in <100ms for catalogs with 10,000+ operations.

---

### FR-06: Health Check Service

**Priority:** P1
**Description:** System can probe live endpoints for availability and latency.

**Check Strategy:**
- Use OPTIONS request if available
- Fallback to HEAD request
- Fallback to GET request (with `range: bytes=0-0` for minimal payload)
- Timeout: 5s per endpoint
- Concurrent checks: 10 max

**Health Thresholds:**
- Green: response <200ms, status 2xx/3xx
- Yellow: response 200-500ms, status 2xx/3xx
- Red: response >500ms, status 4xx/5xx, timeout, network error

**Caching:**
- Health results cached for 15 minutes
- Manual refresh bypasses cache

---

### FR-07: Version Management

**Priority:** P2
**Description:** Support multiple versions of a service spec.

**Version Detection:**
- Read `info.version` from OpenAPI/Swagger
- Read `version` from Postman collection metadata
- HAR files don't have version; default to "1.0"

**Version Storage:**
- Each import creates a new `CatalogVersion`
- Previous versions retained
- Default active version = latest

**Diff Algorithm:**
- Compare operations: added, removed, modified
- Compare schemas: field-level diff
- Breaking change detection:
  - Removed endpoint
  - Removed required field
  - Changed field type
  - Tightened enum

---

## 3. Non-Functional Requirements

### NFR-01: Performance

- Import + parse completes in <5s for 1,000 operations
- Search returns results in <100ms
- Filter updates in <100ms
- Health check completes in <30s for 100 endpoints (concurrent)

### NFR-02: Scalability

- Support 10,000 operations per project
- Support 100 projects per tenant
- Catalog size: up to 100MB per version

### NFR-03: Security

- Imported files scanned for malware (future)
- URL fetch restricted to HTTPS (configurable)
- Secrets in URL basic auth stripped from logs
- Catalog access controlled by project membership

### NFR-04: Reliability

- Parse failures do not corrupt existing catalog
- Import rollback available
- Health check failures do not block workflow

### NFR-05: Usability

- First import complete in <3 minutes
- Error messages actionable (tell user what to fix)
- Search intuitive (no training required)
- Empty state guides user to first import

---

## 4. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Import Success Rate** | >95% | % of OpenAPI/Postman files parsed without manual fix |
| **Parse Time (P95)** | <5s | Time from upload to catalog display for 1K endpoints |
| **Search Latency (P95)** | <100ms | Time from keystroke to result |
| **Health Check Accuracy** | >90% | Correctly identifies reachable/unreachable endpoints |
| **User Time to First Catalog** | <3 min | New user reaches populated catalog |
| **Support Tickets (Import)** | <2% | % of users contacting support for import issues |

---

## 5. Out of Scope

The following are explicitly out of scope for Sprint 02:

- GraphQL schema import (future sprint)
- gRPC / Protobuf import (future sprint)
- API mocking from catalog
- Test generation from catalog (Sprint 03)
- Real-time collaboration on catalog
- Advanced schema diff visualizations
- API execution from catalog (Sprint 05)

---

## 6. Dependencies

| Dependency | Type | Provider | Notes |
|------------|------|----------|-------|
| **Project Context** | Internal | Previous sprint | Project selection, auth |
| **File Storage** | Backend | Platform | Multipart upload, S3/local |
| **Database** | Backend | Platform | Postgres for catalog entities |
| **Search Engine** | Backend | Platform | Full-text search (Postgres FTS or Elastic) |
| **HTTP Client** | Library | OpenAPI Parser | Health check requests |

---

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Complex OpenAPI specs fail to parse | Medium | High | Start with subset; iterate; collect edge cases |
| Large files cause OOM or timeout | Medium | High | Implement streaming parse; max file size 50MB |
| Circular `$ref` crashes parser | Medium | High | Cycle detection with safe fallback |
| Slow search on large catalogs | Low | Medium | Indexing from day 1; benchmark at 10K ops |
| Backend API not ready | Low | High | Frontend can use mock service for Sprint 02 |

---

## 8. Definition of Done

- [ ] All P0 user stories implemented and tested
- [ ] P1 user stories implemented and tested
- [ ] P2 user stories implemented and tested
- [ ] Unit test coverage >80%
- [ ] Integration tests pass for import → parse → display → search flow
- [ ] E2E tests pass for critical user journeys
- [ ] API contracts documented and reviewed
- [ ] Frontend build succeeds
- [ ] No console errors or warnings in development
- [ ] Accessibility audit passes (WCAG 2.1 AA)
- [ ] Performance benchmarks met
- [ ] Documentation updated (user help, dev notes)
- [ ] Code reviewed and merged
- [ ] Deployed to staging environment
- [ ] Product owner acceptance sign-off