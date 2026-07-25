# TestForge — Sprint 01: Project Lifecycle Management

## Product Requirements Document (PRD)

**Document Version:** 2.0
**Sprint:** Sprint 01
**Date:** 2026-07-25
**Author:** Lead Product Architect
**Status:** Approved for Implementation

---

## 1. Product Vision

TestForge is an AI-powered API Quality Engineering Platform that transforms how QA teams, API developers, and DevOps engineers validate APIs. The platform guides users through a structured workflow:

> **Create Project → Import APIs → Analyze Dependencies → Generate Test Cases → Review → Execute → Reports**

This sprint establishes the complete project management layer — the entry point and organizational boundary for all subsequent API testing work. Users must be able to create, view, search, open, edit, and delete projects.

---

## 2. Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G-1 | Enable users to create, view, search, open, edit, and delete projects | All six lifecycle operations work end-to-end with proper validation |
| G-2 | Provide a clear project dashboard showing project status and next steps | Dashboard loads in < 500ms with < 3 API calls |
| G-3 | Establish project selection/activation flow as the gateway to the workspace | Users can switch between projects seamlessly |
| G-4 | Implement project search, sort, and filter capabilities | Users can find any project in a list of 100+ projects within 3 keystrokes |
| G-5 | Ensure all project management screens are fully responsive and accessible | WCAG 2.1 AA compliance; works on screens ≥ 360px wide |
| G-6 | Establish the project entity as the single source of truth for all future features | All project-scoped operations reference a valid project ID |
| G-7 | Implement proper error handling and empty states for all project management flows | No unhandled errors; every state has a clear user-facing message |
| G-8 | Implement safe project deletion with confirmation and cascade cleanup | Deletion removes all project-owned data with no orphaned records |

---

## 3. Non-Goals

The following are explicitly **out of scope** for Sprint 01 and will be addressed in subsequent sprints:

| Non-Goal | Reason | Future Sprint |
|----------|--------|---------------|
| API contract import (OpenAPI, Postman, Swagger) | Requires separate parsing pipeline | Sprint 02 |
| Service registration under a project | Depends on API import | Sprint 02 |
| Dependency analysis between APIs | Requires imported APIs | Sprint 03 |
| Test case generation | Requires analyzed dependencies | Sprint 04 |
| Test execution and orchestration | Requires generated test cases | Sprint 05 |
| Results and reporting | Requires executed tests | Sprint 06 |
| User authentication and multi-tenancy | Project-scoped, not project-creation-scoped | Sprint 08 |
| Project-level knowledge management | Requires imported APIs for analysis | Sprint 03 |
| Environment management (dev/staging/prod) | Separate concern | Sprint 07 |
| WebSocket-based real-time updates | Overkill for project CRUD | Sprint 09 |
| Project export/import | Not needed for MVP | Sprint 10 |
| Bulk project operations | Not needed for MVP | Sprint 10 |
| Project archiving | Deletion is sufficient for MVP; archive in Sprint 10 | Sprint 10 |

---

## 4. Assumptions

| # | Assumption | Rationale | Risk Level |
|---|-----------|-----------|------------|
| A-1 | Users will create projects with human-readable IDs (e.g., `payments-api`) | Consistent with existing `ProjectIdentity` domain model | Low |
| A-2 | A single user operates the platform (no multi-tenancy in MVP) | Existing codebase has no auth; roadmap mentions auth as future | Low |
| A-3 | Projects are stored locally (file-based) by default, with PostgreSQL as optional | Existing dual-persistence architecture supports both | Low |
| A-4 | The default project (`default`) will always exist | Existing `seedDefaultProject()` ensures this | Low |
| A-5 | Users will have fewer than 500 projects | File-based storage is sufficient for this scale | Medium |
| A-6 | Project IDs are immutable after creation | Simplifies referential integrity; existing code enforces this | Low |
| A-7 | Project names are optional and default to the project ID | Matches existing `createProjectIdentity` behavior | Low |
| A-8 | Users interact via a web browser (Chrome, Firefox, Safari, Edge) | Frontend is a React SPA | Low |
| A-9 | The backend runs on Node.js 20+ | Existing `package.json` specifies this | Low |
| A-10 | Deletion is permanent (hard delete) in MVP | Soft delete/archive is deferred to Sprint 10 | Low |
| A-11 | Deleting a project removes all associated data | No orphaned services, APIs, tests, or runs | Low |

---

## 5. Constraints

| # | Constraint | Impact |
|---|-----------|--------|
| C-1 | Backend uses Node.js built-in `http` module (no Express) | API routing must use manual URL pattern matching |
| C-2 | Frontend is React 18 + TypeScript + Vite (no framework like Next.js) | No server-side rendering; SPA with client-side routing |
| C-3 | No external UI component library (no Material-UI, Ant Design, etc.) | All components must be built from scratch using CSS custom properties |
| C-4 | No external icon library (all icons are inline SVGs) | Icons must be hand-coded as SVG components |
| C-5 | Dual persistence: file-based (default) and PostgreSQL (optional) | All repository operations must work with both backends |
| C-6 | Project IDs must match `[a-zA-Z0-9._-]` pattern | Enforced by `safeName()` in existing storage layer |
| C-7 | No authentication in MVP | All data is local; no user isolation |
| C-8 | Maximum project ID length: 100 characters | Enforced by `safeName()` |
| C-9 | CORS is open (`*`) on the backend | Security is not a concern for local development |
| C-10 | Request body size limit: 10MB | Enforced by `readBody()` in `server.js` |
| C-11 | Hard delete only in MVP (no recycle bin/archive) | Deleted projects cannot be recovered; archive in Sprint 10 |

---

## 6. User Personas

### 6.1 QA Engineer (Primary)

| Attribute | Detail |
|-----------|--------|
| **Name** | Priya Sharma |
| **Role** | Senior QA Engineer |
| **Experience** | 5+ years in API testing |
| **Goals** | Validate APIs quickly, organize test work by project, track test results |
| **Pain Points** | Scattered test artifacts, no central place to organize API testing work |
| **Technical Comfort** | High — comfortable with CLI, JSON, API contracts |

### 6.2 API Developer (Secondary)

| Attribute | Detail |
|-----------|--------|
| **Name** | Alex Chen |
| **Role** | Backend/API Developer |
| **Experience** | 3+ years building REST APIs |
| **Goals** | Validate API contracts, ensure API quality before deployment |
| **Pain Points** | Manual testing, no automated validation pipeline |
| **Technical Comfort** | High — works with OpenAPI, Postman, CI/CD |

### 6.3 DevOps Engineer (Secondary)

| Attribute | Detail |
|-----------|--------|
| **Name** | Marcus Johnson |
| **Role** | DevOps/SRE Engineer |
| **Experience** | 7+ years in infrastructure and automation |
| **Goals** | Integrate API testing into CI/CD pipelines |
| **Pain Points** | No programmatic way to run API tests in pipelines |
| **Technical Comfort** | Very high — comfortable with CLI, automation, scripting |

---

## 7. User Journey Map

### Journey: Create and Manage a Project

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER JOURNEY                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  STEP 1: First Visit                                                │
│  ─────────────────────────────────────────────────────────────────  │
│  User opens TestForge in browser                                    │
│  → Sees "Project Setup" page with empty state                       │
│  → Sees "Default Project" in the list (auto-seeded)                 │
│  → Sees "Create New Project" form                                   │
│                                                                     │
│  STEP 2: Create Project                                             │
│  ─────────────────────────────────────────────────────────────────  │
│  User enters project ID and name                                    │
│  → Clicks "Create Project"                                          │
│  → System validates input                                           │
│  → System creates project                                           │
│  → User is redirected to project dashboard                          │
│                                                                     │
│  STEP 3: View Dashboard                                             │
│  ─────────────────────────────────────────────────────────────────  │
│  User sees project dashboard with:                                  │
│  → Project name and ID in header                                    │
│  → Project metadata (created/updated dates)                         │
│  → Status indicators (no APIs yet, ready for import)                │
│  → Quick actions (import APIs, settings, delete)                    │
│                                                                     │
│  STEP 4: Manage Projects                                            │
│  ─────────────────────────────────────────────────────────────────  │
│  User navigates back to project list                                │
│  → Searches for a project                                           │
│  → Opens a different project                                        │
│  → Edits a project name                                             │
│  → Deletes an unused project                                        │
│  → Switches to another project                                      │
│                                                                     │
│  STEP 5: Delete Project                                             │
│  ─────────────────────────────────────────────────────────────────  │
│  User clicks "Delete Project" on dashboard                          │
│  → Confirmation dialog appears                                      │
│  → User types project ID to confirm                                 │
│  → User clicks "Delete"                                             │
│  → Project and all associated data are removed                      │
│  → User is redirected to project setup page                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Feature Breakdown

### 8.1 Project Creation

- **Input:** Project ID (required, unique, alphanumeric + `-_.`), Project Name (optional, defaults to ID)
- **Validation:** ID must be non-empty, match pattern, be unique; Name must be non-empty if provided
- **Output:** New project with `id`, `name`, `createdAt`, `updatedAt` timestamps
- **Side Effects:** Project appears in project list immediately

### 8.2 Project Listing

- **Input:** Optional search query, sort field, sort direction
- **Output:** Paginated list of projects with `id`, `name`, `createdAt`, `updatedAt`
- **Features:** Search by ID or name, sort by name/created/updated, client-side pagination

### 8.3 Project Detail / Dashboard

- **Input:** Project ID (from URL or active project context)
- **Output:** Full project object with all metadata
- **Features:** Display all project fields, show status indicators, quick action buttons

### 8.4 Project Update

- **Input:** Project ID, updated fields (name)
- **Validation:** Name must be non-empty
- **Output:** Updated project with new `updatedAt` timestamp
- **Side Effects:** Project list reflects new name immediately

### 8.5 Project Deletion

- **Input:** Project ID
- **Validation:** Cannot delete the default project; user must type project ID to confirm
- **Output:** Project removed from storage
- **Side Effects:** 
  - All project-owned data is removed (services, APIs, tests, runs, reports)
  - If deleted project was active, redirect to project setup page
  - Project no longer appears in project list

### 8.6 Project Selection / Activation

- **Input:** Project ID
- **Output:** Active project context set
- **Side Effects:** Navigation to workspace/dashboard view

### 8.7 Project Search & Filter

- **Input:** Search query string
- **Output:** Filtered list of projects
- **Features:** Real-time filtering, case-insensitive, matches ID and name

---

## 9. Acceptance Criteria

### 9.1 Project Creation

| ID | Criterion |
|----|-----------|
| AC-01 | User can create a project by entering a project ID and optional name |
| AC-02 | Project ID must be at least 1 character and at most 100 characters |
| AC-03 | Project ID must only contain alphanumeric characters, hyphens, underscores, and dots |
| AC-04 | Project ID must be unique — attempting to create a duplicate shows an error message |
| AC-05 | If project name is not provided, it defaults to the project ID |
| AC-06 | On successful creation, the user is taken to the project dashboard |
| AC-07 | On creation failure, a clear error message is displayed without page reload |
| AC-08 | The "Create Project" button is disabled while the request is in progress |
| AC-09 | The "Create Project" button can be triggered via Enter key in either input field |
| AC-10 | After creation, the new project appears in the project list |

### 9.2 Project Listing

| ID | Criterion |
|----|-----------|
| AC-11 | All projects are listed on the project setup page |
| AC-12 | The default project is always present in the list |
| AC-13 | Projects are sorted alphabetically by ID by default |
| AC-14 | User can search projects by typing in a search box |
| AC-15 | Search results update in real-time as the user types |
| AC-16 | Search is case-insensitive and matches both ID and name |
| AC-17 | When no projects match the search, an empty state message is shown |
| AC-18 | Each project in the list shows its name, ID, and last updated timestamp |
| AC-19 | Clicking a project in the list opens that project (navigates to dashboard) |
| AC-20 | The project list loads within 500ms for up to 100 projects |

### 9.3 Project Dashboard

| ID | Criterion |
|----|-----------|
| AC-21 | The dashboard displays the project name as the page title |
| AC-22 | The dashboard displays the project ID |
| AC-23 | The dashboard displays the creation date |
| AC-24 | The dashboard displays the last updated date |
| AC-25 | The dashboard shows a status indicator for API import (not yet imported) |
| AC-26 | The dashboard provides a "Change Project" button to return to the project list |
| AC-27 | The dashboard provides an "Edit Project" button to modify the project name |
| AC-28 | The dashboard provides a "Delete Project" button with confirmation |
| AC-29 | The dashboard shows a "Next Steps" section with guidance on what to do next |
| AC-30 | The dashboard loads within 500ms |
| AC-31 | If the project is not found (e.g., deleted in another session), the user is redirected to the project setup page with an error message |
| AC-32 | The dashboard shows a breadcrumb or back link to the project list |

### 9.4 Project Update

| ID | Criterion |
|----|-----------|
| AC-33 | User can edit the project name from the dashboard or project list |
| AC-34 | The edit form pre-fills with the current project name |
| AC-35 | User can save changes or cancel the edit |
| AC-36 | On save, the project name is updated and the list/dashboard reflects the change |
| AC-37 | On cancel, no changes are made |
| AC-38 | Empty project names are rejected with an error message |
| AC-39 | The "Save" button is disabled while the update request is in progress |
| AC-40 | The "Save" button can be triggered via Enter key when the input is focused |

### 9.5 Project Deletion

| ID | Criterion |
|----|-----------|
| AC-41 | User can initiate deletion from the dashboard |
| AC-42 | A confirmation dialog is shown before deletion |
| AC-43 | The confirmation dialog displays project name, ID, created date, and stats (services, requirements, test cases, reports) |
| AC-44 | The confirmation dialog requires the user to type the project ID to enable the Delete button |
| AC-45 | A warning message states "This action cannot be undone." |
| AC-46 | The default project cannot be deleted (button hidden/disabled) |
| AC-47 | On successful deletion, the user is returned to the project setup page |
| AC-48 | On cancellation, the user remains on the dashboard |
| AC-49 | After deletion, the project no longer appears in the project list |
| AC-50 | Deleting a project removes all associated data (cascade delete) |
| AC-51 | The Delete button can be triggered via Enter key when the project ID matches |
| AC-52 | The Cancel button can be triggered via Escape key |
| AC-53 | The dialog is accessible (focus trap, ARIA attributes, escape to close) |

### 9.6 Project Selection

| ID | Criterion |
|----|-----------|
| AC-54 | User can switch between projects from the project setup page |
| AC-55 | User can switch between projects from the dashboard |
| AC-56 | When switching projects, the active project context updates immediately |
| AC-57 | The active project persists across page reloads (via URL hash or localStorage) |
| AC-58 | The project selection is reflected in the URL (e.g., `#workspace?project=payments-api`) |

### 9.7 Empty States

| ID | Criterion |
|----|-----------|
| AC-59 | When no projects exist (excluding default), an empty state with guidance is shown |
| AC-60 | When search returns no results, a "no results" message is shown |
| AC-61 | The empty state includes a call-to-action to create a project |

### 9.8 Error Handling

| ID | Criterion |
|----|-----------|
| AC-62 | Network errors during project creation show a user-friendly message |
| AC-63 | Network errors during project listing show a retry option |
| AC-64 | All error messages are displayed in a consistent, visible location |
| AC-65 | Errors do not cause the application to crash or become unresponsive |

### 9.9 Responsiveness

| ID | Criterion |
|----|-----------|
| AC-66 | The project setup page works on screens as narrow as 360px |
| AC-67 | The project dashboard works on screens as narrow as 360px |
| AC-68 | On narrow screens, the create project form stacks vertically |
| AC-69 | On narrow screens, the sidebar is hidden and accessible via a menu toggle |

### 9.10 Accessibility

| ID | Criterion |
|----|-----------|
| AC-70 | All interactive elements are keyboard-navigable |
| AC-71 | All interactive elements have visible focus indicators |
| AC-72 | All images and icons have appropriate `alt` text or `aria-label` |
| AC-73 | Form fields have associated `<label>` elements |
| AC-74 | Color is not the sole means of conveying information |
| AC-75 | The application supports screen readers (ARIA landmarks, roles) |

### 9.11 Dark/Light Mode

| ID | Criterion |
|----|-----------|
| AC-76 | The application supports both light and dark themes |
| AC-77 | Theme preference is persisted in `localStorage` |
| AC-78 | Theme follows system preference by default |
| AC-79 | Theme can be toggled via the header theme switcher |
| AC-80 | All UI components render correctly in both themes |

---

## 10. Dependencies

### 10.1 Internal Dependencies

- Existing `ProjectIdentity` domain model (`src/domain/ProjectIdentity.js`)
- Existing `ProjectRepository` abstraction (`src/domain/ProjectRepository.js`)
- Existing `FileProjectRepository` (`src/domain/repositories/FileProjectRepository.js`)
- Existing `PostgresProjectRepository` (`src/domain/repositories/PostgresProjectRepository.js`)
- Existing frontend `ProjectService` (`frontend/src/features/project-setup/ProjectService.ts`)
- Existing frontend `ApiClient` (`frontend/src/services/ApiClient.ts`)
- Existing CSS design system (`frontend/src/styles/index.css`)

### 10.2 External Dependencies

- Node.js 20+ (runtime)
- React 18.3+ (frontend framework)
- TypeScript 5.5+ (type checking)
- Vite 5.4+ (build tool)
- Vitest 4.1+ (testing framework)

### 10.3 No New Dependencies

This sprint introduces **no new npm dependencies**. All functionality is built using existing tools and libraries.

---

## 11. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Project creation success rate | ≥ 99% | Backend API logs |
| Project list load time | ≤ 500ms | Frontend performance API |
| Dashboard load time | ≤ 500ms | Frontend performance API |
| Project deletion success rate | ≥ 99% | Backend API logs |
| Error rate (5xx) | 0% | Backend error logs |
| Accessibility score | ≥ 95 | Lighthouse audit |
| Test coverage | ≥ 80% | Vitest coverage report |
| Bundle size increase | ≤ 10KB | Vite build output |
| Keyboard navigation coverage | 100% | Manual QA checklist |

---

## 12. Open Questions

| # | Question | Owner | Resolution |
|---|----------|-------|------------|
| OQ-1 | Should project deletion be soft or hard delete? | Product | Hard delete for MVP; soft delete in Sprint 10 |
| OQ-2 | Should project IDs be auto-generated or user-specified? | Product | User-specified (consistent with existing behavior) |
| OQ-3 | Should the project list show a preview of API count? | Product | No — APIs are not in scope for this sprint |
| OQ-4 | Should there be project templates? | Product | No — not needed for MVP |
| OQ-5 | Should project creation be possible from the dashboard? | Product | Yes — quick create from dashboard header |
| OQ-6 | Should deletion show a detailed breakdown of what will be deleted? | Product | Yes — show counts of services, requirements, test cases, reports |
| OQ-7 | Should there be an undo option after deletion? | Product | No — deletion is permanent in MVP |

---

## 13. Deletion Business Rules

### 13.1 What Gets Deleted

When a project is deleted, the following data is removed:

- Project record (projects table / project JSON file)
- All services registered under the project
- All API models/contracts
- All project knowledge (instructions, relationships)
- All execution plans
- All test runs
- All test cases
- All reports
- Any project-owned files in the data directory

### 13.2 Deletion Validation

Before deletion, the system validates:

- Project ID is not `default`
- Project exists
- User has confirmed by typing the exact project ID

### 13.3 Deletion Errors

| Error | HTTP Status | User Message |
|-------|-------------|--------------|
| Cannot delete default project | 400 | "Cannot delete the default project" |
| Project not found | 404 | "Project not found: {id}" |
| Deletion failed (server error) | 500 | "Failed to delete project. Please try again." |

### 13.4 Future: Archive Support

The deletion design allows archive to be introduced later without redesign:

- Add `is_archived` column to projects table (PostgreSQL)
- Add `archivedAt` timestamp
- Change `deleteProject` to set `is_archived = true` instead of hard delete
- Hide archived projects from default list queries
- Add "Archived Projects" view for recovery

---

*End of PRD — Sprint 01: Project Lifecycle Management*