# TestForge — Sprint 01: Project Foundation

## Technical Design

**Document Version:** 1.0
**Sprint:** Sprint 01
**Date:** 2026-07-25
**Author:** Lead Product Architect

---

## 1. Overview

This document describes the technical architecture for Sprint 01: Project Foundation. The sprint establishes the project management layer — the organizational boundary for all subsequent API testing work in TestForge.

The architecture follows the existing codebase patterns:

- **Backend:** Node.js HTTP server (no Express), dual persistence (file-based + PostgreSQL)
- **Frontend:** React 18 + TypeScript + Vite SPA
- **No new dependencies** — all functionality built using existing tools

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (SPA)                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  React 18 + TypeScript + Vite                                │  │
│  │                                                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │  │
│  │  │ ProjectSetup │  │ ProjectDash- │  │ Shared Components  │ │  │
│  │  │ Page         │  │ board        │  │ (Modal, SearchBar, │ │  │
│  │  │              │  │              │  │  ProjectCard, etc) │ │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘ │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │  Services Layer                                          │ │  │
│  │  │  ProjectService.ts  ←→  /api/projects                   │ │  │
│  │  │  (apiClient wrapper)                                      │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │  State Management                                        │ │  │
│  │  │  React Context (ProjectContext)                          │ │  │
│  │  │  + useState / useEffect hooks                            │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                    NODE.JS HTTP SERVER                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  HTTP Router (manual URL matching)                           │  │
│  │                                                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │  │
│  │  │ Project API  │  │ Project      │  │ Validation &       │ │  │
│  │  │ Endpoints    │  │ Repository   │  │ Error Handling     │ │  │
│  │  │ (server.js)  │  │ (domain/)    │  │ (domain/)          │ │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘ │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │  Persistence Layer                                       │ │  │
│  │  │  FileProjectRepository  |  PostgresProjectRepository    │ │  │
│  │  │  (data/projects/*.json) |  (projects table)             │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Frontend Architecture

### 3.1 Directory Structure

The frontend follows a feature-based directory structure. Sprint 01 adds new components and enhances existing ones:

```
frontend/src/
├── App.tsx                          # Root component (enhanced)
├── main.tsx                         # Entry point
├── components/
│   ├── common/
│   │   ├── Panel.tsx                # Existing — panel wrapper
│   │   ├── Modal.tsx                # NEW — reusable modal dialog
│   │   ├── Button.tsx               # NEW — reusable button
│   │   ├── Input.tsx                # NEW — reusable input field
│   │   ├── SearchBar.tsx            # NEW — search input with clear
│   │   ├── EmptyState.tsx           # NEW — empty state component
│   │   ├── ErrorBoundary.tsx        # NEW — error boundary
│   │   ├── LoadingSpinner.tsx       # NEW — loading indicator
│   │   └── index.ts                 # Barrel export
│   ├── layout/
│   │   ├── Sidebar.tsx              # Existing — enhanced with project nav
│   │   ├── Header.tsx               # Existing — enhanced with project context
│   │   ├── AppShell.tsx             # Existing — layout wrapper
│   │   └── index.ts                 # Barrel export
│   └── workflow/
│       └── WorkflowStatus.tsx       # Existing — workflow indicator
├── features/
│   ├── project-setup/
│   │   ├── SetupPage.tsx            # Existing — enhanced
│   │   ├── ProjectDashboard.tsx     # NEW — project dashboard
│   │   ├── ProjectService.ts        # Existing — enhanced with update/delete
│   │   ├── ProjectContext.ts        # NEW — React context for project state
│   │   └── index.ts                 # Barrel export
│   ├── api-collection/              # Existing (not modified in Sprint 01)
│   ├── api-matching/                # Existing (not modified in Sprint 01)
│   ├── history/                     # Existing (not modified in Sprint 01)
│   ├── requirements/                # Existing (not modified in Sprint 01)
│   ├── results/                     # Existing (not modified in Sprint 01)
│   ├── runs/                        # Existing (not modified in Sprint 01)
│   ├── test-cases/                  # Existing (not modified in Sprint 01)
│   ├── test-prepare/                # Existing (not modified in Sprint 01)
│   └── workspace/
│       └── WorkspacePage.tsx        # Existing — enhanced
├── services/
│   ├── ApiClient.ts                 # Existing — HTTP client
│   └── index.ts                     # Existing — barrel export
├── hooks/
│   ├── index.ts                     # Existing — enhanced
│   ├── useProjects.ts               # NEW — project data fetching hook
│   ├── useProject.ts                # NEW — single project hook
│   ├── useDebounce.ts               # NEW — debounce utility hook
│   └── useLocalStorage.ts           # NEW — localStorage hook
├── types/
│   └── index.ts                     # Existing — enhanced with new types
├── utils/
│   ├── index.ts                     # Existing — enhanced
│   ├── formatDate.ts                # NEW — date formatting
│   ├── validators.ts                # NEW — input validation
│   └── constants.ts                 # NEW — app constants
└── styles/
    └── index.css                    # Existing — enhanced with new styles
```

### 3.2 Component Hierarchy

```
App
├── Sidebar
│   ├── Brand (TestForge logo)
│   └── Nav (Platform, Testing, APIs, Results, System)
├── Header
│   ├── ProductContextBadge
│   ├── HeaderTitle
│   ├── ProjectContext (name, environment)
│   └── ThemeSwitcher
└── MainContent (routed)
    ├── SetupPage (no active project)
    │   ├── PageIntro
    │   ├── ProjectSetupCard
    │   │   ├── CardIntroHeader
    │   │   ├── ExistingProjectsSection
    │   │   │   ├── SectionHeader
    │   │   │   ├── ProjectList
    │   │   │   │   ├── ProjectListItem (× N)
    │   │   │   │   └── EmptyState (no projects)
    │   │   │   └── EmptyState (search no results)
    │   │   ├── Divider
    │   │   └── CreateProjectSection
    │   │       ├── SectionHeading
    │   │       ├── CreateProjectForm
    │   │       │   ├── FormField (Project ID)
    │   │       │   ├── FormField (Project Name)
    │   │       │   └── CreateButton
    │   │       └── ProjectError
    │   └── InfoCallout
    └── ProjectDashboard (active project)
        ├── DashboardHeader
        │   ├── ProjectTitle
        │   ├── ProjectMeta
        │   └── QuickActions
        │       ├── ChangeProjectButton
        │       ├── EditProjectButton
        │       └── DeleteProjectButton
        ├── ProjectStatusSection
        │   ├── StatusCard
        │   └── StatusIndicator
        ├── NextStepsSection
        │   ├── StepCard (× N)
        │   └── CallToAction
        └── Modal (when triggered)
            ├── EditProjectDialog
            └── DeleteProjectDialog
```

### 3.3 State Management

#### 3.3.1 Project Context

A React Context provides the active project state across the application:

```typescript
// frontend/src/features/project-setup/ProjectContext.ts
interface ProjectContextValue {
  activeProject: Project | null;
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  setActiveProject: (project: Project | null) => void;
  refreshProjects: () => Promise<void>;
  createProject: (data: CreateProjectRequest) => Promise<Project>;
  updateProject: (id: string, data: UpdateProjectRequest) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
}
```

#### 3.3.2 Local State

Each feature component manages its own local state for:
- Form inputs (project ID, name)
- Loading states (creating, updating, deleting)
- Error messages
- Search query
- Modal visibility

#### 3.3.3 State Flow

```
User Action → Component Local State → API Call → Context Update → Re-render
```

### 3.4 Routing

The application uses hash-based routing (existing pattern from `App.tsx`):

| Hash | View | Condition |
|------|------|-----------|
| `#setup` | ProjectSetupPage | No active project |
| `#workspace` | ProjectDashboard | Active project selected |
| `#results` | ResultsPage | (Future — not in Sprint 01) |
| `#history` | HistoryPage | (Future — not in Sprint 01) |

**New in Sprint 01:**
- Project ID is encoded in the hash: `#workspace?project=payments-api`
- URL hash is synchronized with React state via `useEffect` + `hashchange` listener
- Page reload preserves the active project from the hash

### 3.5 Data Fetching

#### 3.5.1 Fetching Strategy

- **On mount:** Fetch all projects via `GET /api/projects`
- **On project creation:** Optimistic update + API call
- **On project selection:** Fetch project details via `GET /api/projects/:id`
- **On project update:** API call + context update
- **On project deletion:** API call + context update

#### 3.5.2 Caching

- Projects list is cached in React context
- Individual project data is cached in context after fetch
- No stale-while-revalidate (SWR) — simple cache invalidation on mutation

#### 3.5.3 Error Handling

```typescript
// Pattern for API calls
try {
  setLoading(true);
  setError(null);
  const result = await apiCall();
  // Update state
} catch (err) {
  const message = extractErrorMessage(err);
  setError(message);
} finally {
  setLoading(false);
}
```

---

## 4. Backend Architecture

### 4.1 Server Structure

The backend is a single-file HTTP server (`src/server.js`) using Node.js built-in `http` module. No Express or other frameworks.

#### 4.1.1 Request Flow

```
HTTP Request
  → handleRequest()
    → Log request (requestId, timing)
    → Handle OPTIONS (CORS preflight)
    → Route to handleApi() or serve static file
      → handleApi():
        → Parse URL and method
        → Match route pattern
        → Read body (for POST/PUT/PATCH)
        → Call domain service
        → Return JSON response
      → serveFile():
        → Resolve file path
        → Check path safety (no directory traversal)
        → Serve file with correct content type
        → SPA fallback to index.html
    → Log response (status, duration)
```

#### 4.1.2 New Endpoints (Sprint 01)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `PATCH` | `/api/projects/:id` | `updateProject` | Update project name |
| `DELETE` | `/api/projects/:id` | `deleteProject` | Delete a project |

#### 4.1.3 Enhanced Endpoints

| Method | Path | Enhancement |
|--------|------|-------------|
| `GET` | `/api/projects` | Add `search` and `sort` query parameters |
| `POST` | `/api/projects` | Enhanced validation and error messages |
| `GET` | `/api/projects/:id` | No change (existing) |

### 4.2 Domain Layer

#### 4.2.1 ProjectIdentity (Existing — Enhanced)

File: `src/domain/ProjectIdentity.js`

**Enhancements in Sprint 01:**
- Add `validateProjectId(id)` — validates ID format
- Add `validateProjectName(name)` — validates name is non-empty
- Add `PROJECT_ID_PATTERN` constant — regex for ID validation

```javascript
const PROJECT_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

function validateProjectId(id) {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Project ID must be a non-empty string.');
  }
  if (id.length > 100) {
    throw new Error('Project ID must be at most 100 characters.');
  }
  if (!PROJECT_ID_PATTERN.test(id)) {
    throw new Error('Project ID must contain only alphanumeric characters, hyphens, underscores, and dots.');
  }
}
```

#### 4.2.2 ProjectRepository (Existing — Enhanced)

File: `src/domain/ProjectRepository.js`

**New functions:**
- `updateProject(id, updates)` — update project name
- `deleteProject(id)` — delete a project
- `searchProjects(query)` — search projects by ID or name

**Enhanced functions:**
- `listProjects(options)` — add search and sort options

#### 4.2.3 FileProjectRepository (Existing — Enhanced)

File: `src/domain/repositories/FileProjectRepository.js`

**New functions:**
- `updateProject(id, { name })` — read, update name, write
- `deleteProject(id)` — delete file
- `searchProjects(query)` — filter by ID/name

**Enhanced functions:**
- `listProjects({ search, sort })` — filter and sort

#### 4.2.4 PostgresProjectRepository (Existing — Enhanced)

File: `src/domain/repositories/PostgresProjectRepository.js`

**New functions:**
- `updateProject(id, { name })` — `UPDATE projects SET name = $1, updated_at = now() WHERE id = $2`
- `deleteProject(id)` — `DELETE FROM projects WHERE id = $1`
- `searchProjects(query)` — `SELECT * FROM projects WHERE id ILIKE $1 OR name ILIKE $1`

**Enhanced functions:**
- `listProjects({ search, sort })` — add WHERE and ORDER BY clauses

### 4.3 API Layer

#### 4.3.1 Request/Response Patterns

All API responses follow a consistent envelope:

```json
// Success
{
  "project": { "id": "payments-api", "name": "Payments API", ... }
}

// Error
{
  "error": "Project already exists: payments-api"
}
```

#### 4.3.2 Validation

Validation is performed at multiple layers:

1. **Input validation** (server.js) — check required fields exist
2. **Domain validation** (ProjectIdentity.js) — validate field formats
3. **Repository validation** (FileProjectRepository.js) — check uniqueness, existence

#### 4.3.3 Error Handling

```javascript
// Pattern in server.js
try {
  const project = await updateProject(projectId, { name: body.name });
  return sendJson(res, 200, { project });
} catch (error) {
  if (error.message.includes('not found')) {
    return sendJson(res, 404, { error: error.message });
  }
  if (error.message.includes('already exists')) {
    return sendJson(res, 409, { error: error.message });
  }
  return sendJson(res, 400, { error: error.message });
}
```

#### 4.3.4 HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST (project creation) |
| 400 | Bad Request | Validation error, missing fields |
| 404 | Not Found | Project not found |
| 409 | Conflict | Duplicate project ID |
| 500 | Internal Server Error | Unexpected server error |

---

## 5. Repositories

### 5.1 Repository Pattern

The repository pattern abstracts the persistence layer. The `ProjectRepository` module selects between `FileProjectRepository` and `PostgresProjectRepository` based on configuration.

```javascript
// src/domain/ProjectRepository.js
function selectedRepository() {
  return usePostgres() ? postgresRepository : fileRepository;
}

function updateProject(id, updates) {
  return selectedRepository().updateProject(id, updates);
}
```

### 5.2 File Repository

- Stores projects as JSON files in `data/projects/`
- File naming: `{sanitized-id}.json`
- File content: `{ "id": "...", "name": "...", "createdAt": "...", "updatedAt": "..." }`
- Atomic writes: write to temp file, then rename
- No transactions (single file operations)

### 5.3 PostgreSQL Repository

- Stores projects in `projects` table
- Primary key: `id` (TEXT)
- Columns: `id`, `user_id` (nullable), `name`, `created_at`, `updated_at`
- Uses parameterized queries to prevent SQL injection
- Transactions for multi-step operations

### 5.4 Repository Interface

```javascript
// All repository implementations must implement:
{
  createProject(input): Project
  getProject(id): Project | null
  listProjects(options?): Project[]
  updateProject(id, updates): Project
  deleteProject(id): void
  projectExists(id): boolean
  seedDefaultProject(): Project
  getBackendName(): string
  ensureReady(): Promise<boolean>
}
```

---

## 6. Services

### 6.1 Backend Services

#### 6.1.1 Project Service (Domain)

File: `src/domain/ProjectRepository.js`

Wraps repository calls and provides the public API for project operations.

#### 6.1.2 No New Services

Sprint 01 does not introduce new backend services. All project operations are handled by the existing `ProjectRepository` with new functions added.

### 6.2 Frontend Services

#### 6.2.1 ProjectService (Enhanced)

File: `frontend/src/features/project-setup/ProjectService.ts`

**New functions:**
- `updateProject(projectId, data)` — PATCH `/api/projects/:id`
- `deleteProject(projectId)` — DELETE `/api/projects/:id`
- `searchProjects(query)` — GET `/api/projects?search=...`

**Enhanced functions:**
- `listProjects(options)` — add search and sort options

#### 6.2.2 No New Services

Sprint 01 does not introduce new frontend services. All project operations use the existing `ProjectService` with new functions added.

---

## 7. Routing

### 7.1 Frontend Routing

Hash-based routing (existing pattern):

```
#setup                              → ProjectSetupPage (no active project)
#workspace?project=payments-api     → ProjectDashboard (active project)
```

**New in Sprint 01:**
- Project ID is passed as a query parameter in the hash
- `App.tsx` parses the hash to determine view and active project
- `useEffect` + `hashchange` listener synchronizes state

### 7.2 Backend Routing

URL pattern matching (existing pattern in `server.js`):

```javascript
// GET /api/projects
// POST /api/projects
// GET /api/projects/:id
// PATCH /api/projects/:id  ← NEW
// DELETE /api/projects/:id  ← NEW
```

---

## 8. Validation

### 8.1 Input Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| Project ID | Required, 1-100 chars, `[a-zA-Z0-9._-]+` | "Project ID must be a non-empty string containing only alphanumeric characters, hyphens, underscores, and dots." |
| Project Name | Optional, defaults to ID, non-empty if provided | "Project name must be a non-empty string." |

### 8.2 Validation Layers

1. **Frontend (real-time):** Validate as user types, show inline errors
2. **Frontend (on submit):** Validate before API call, prevent submission if invalid
3. **Backend (input):** Check required fields exist in request body
4. **Backend (domain):** Validate field formats using `ProjectIdentity`
5. **Backend (repository):** Check uniqueness (create) and existence (update/delete)

### 8.3 Validation Utilities

```typescript
// frontend/src/utils/validators.ts
export function validateProjectId(id: string): string | null {
  if (!id || id.trim().length === 0) return 'Project ID is required.';
  if (id.length > 100) return 'Project ID must be at most 100 characters.';
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) return 'Project ID contains invalid characters.';
  return null;
}

export function validateProjectName(name: string): string | null {
  if (name && name.trim().length === 0) return 'Project name cannot be empty.';
  return null;
}
```

---

## 9. Error Handling

### 9.1 Error Categories

| Category | HTTP Status | User Message | Retry? |
|----------|-------------|--------------|--------|
| Validation Error | 400 | "Please check your input and try again." | No |
| Duplicate ID | 409 | "A project with this ID already exists." | No |
| Not Found | 404 | "The project you're looking for no longer exists." | No |
| Network Error | — | "Unable to connect to the server." | Yes |
| Timeout | — | "The request timed out." | Yes |
| Server Error | 500 | "Something went wrong on our end." | Yes |

### 9.2 Error Display Patterns

- **Form errors:** Inline below the form field
- **API errors:** Banner at the top of the form/modal
- **Page errors:** Full-page error with retry button
- **Toast notifications:** For transient errors (optional, not required for MVP)

### 9.3 Error Recovery

- **Retry:** Re-attempt the failed operation
- **Cancel:** Close modal, return to previous state
- **Redirect:** Navigate to a safe page (e.g., setup page)

---

## 10. Performance Considerations

### 10.1 Frontend

| Metric | Target | Strategy |
|--------|--------|----------|
| Project list load | ≤ 500ms | Client-side caching, minimal API calls |
| Dashboard load | ≤ 500ms | Pre-fetch project data on selection |
| Search response | ≤ 300ms | Debounced input, client-side filtering |
| Bundle size | ≤ 10KB increase | Code splitting, tree-shaking |
| Re-render | ≤ 16ms | React.memo, useCallback, useMemo |

### 10.2 Backend

| Metric | Target | Strategy |
|--------|--------|----------|
| API response | ≤ 200ms | File I/O is fast for small files |
| Project creation | ≤ 100ms | Single file write |
| Project list | ≤ 200ms | Read all files, sort in memory |
| Project update | ≤ 100ms | Read-modify-write single file |
| Project deletion | ≤ 50ms | Single file delete |

### 10.3 Database (PostgreSQL)

| Metric | Target | Strategy |
|--------|--------|----------|
| Project creation | ≤ 50ms | Single INSERT |
| Project list | ≤ 100ms | Single SELECT with ORDER BY |
| Project update | ≤ 50ms | Single UPDATE |
| Project deletion | ≤ 50ms | Single DELETE |

### 10.4 Indexes (PostgreSQL)

```sql
-- Existing: projects.id is PRIMARY KEY (indexed automatically)
-- New indexes for search:
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
```

---

## 11. Security Considerations

### 11.1 Input Sanitization

- Project IDs are sanitized by `safeName()` in the storage layer
- Project names are stored as-is (no HTML rendering)
- No SQL injection risk (parameterized queries in PostgreSQL, no SQL in file storage)

### 11.2 Path Traversal Prevention

- File paths are resolved and checked against the base directory
- `safeName()` strips all characters except `[a-zA-Z0-9._-]`
- No user input is used directly in file paths

### 11.3 CORS

- CORS is open (`*`) — consistent with existing configuration
- No credentials are sent in requests
- Acceptable for local development (no authentication in MVP)

### 11.4 Data Exposure

- Project data is stored locally (file-based) or in PostgreSQL
- No sensitive data in project entities (just ID, name, timestamps)
- No secrets or credentials stored in project data

---

## 12. Testing Strategy

### 12.1 Backend Testing

- **Unit tests:** `test-domain-ProjectIdentity.js`, `test-project-repository.js`
- **Integration tests:** `test-api-project-integration.js`
- **Coverage:** All new functions in `ProjectRepository` and `ProjectIdentity`

### 12.2 Frontend Testing

- **Unit tests:** Vitest + React Testing Library
- **Coverage:** All new components and hooks
- **Test files:** `*.test.tsx` alongside components

### 12.3 Test Matrix

| Layer | Tool | Coverage Target |
|-------|------|----------------|
| Backend unit | Node.js assert | 80% |
| Backend integration | Custom test runner | 70% |
| Frontend unit | Vitest + RTL | 80% |
| Frontend integration | Vitest + RTL | 60% |
| E2E | Playwright (future) | — |

---

## 13. Deployment Considerations

### 13.1 Build Process

```bash
# Frontend build
cd frontend
npm run build  # → frontend/dist/

# Backend start
cd ..
npm start  # → serves frontend/dist/ + API
```

### 13.2 Environment Variables

No new environment variables required for Sprint 01.

### 13.3 CI/CD

Existing GitHub Actions workflow (`.github/workflows/ci.yml`) will be extended to:
- Run frontend typecheck
- Run frontend tests
- Run backend tests

---

## 14. Migration Strategy

### 14.1 Data Migration

No data migration required. The existing project data format is unchanged.

### 14.2 API Migration

- New endpoints (`PATCH`, `DELETE`) are additive — no breaking changes
- Enhanced `GET /api/projects` adds optional query parameters — backward compatible
- Enhanced `POST /api/projects` adds stricter validation — may reject previously accepted invalid input (acceptable for MVP)

### 14.3 Frontend Migration

- Existing `SetupPage` is enhanced, not replaced
- New `ProjectDashboard` is a new component
- Existing `ProjectService` is enhanced with new functions
- No breaking changes to existing components

---

## 15. Monitoring and Observability

### 15.1 Logging

Backend logs (existing pattern):
```
[requestId] METHOD /api/path → status (durationms)
```

New log entries for:
- Project creation: `[requestId] POST /api/projects → 200 (45ms)`
- Project update: `[requestId] PATCH /api/projects/:id → 200 (32ms)`
- Project deletion: `[requestId] DELETE /api/projects/:id → 200 (12ms)`

### 15.2 Metrics

No new metrics infrastructure. Existing console logging is sufficient for MVP.

### 15.3 Error Tracking

No error tracking service (e.g., Sentry) in MVP. Errors are logged to console.

---

*End of Technical Design — Sprint 01: Project Foundation*
