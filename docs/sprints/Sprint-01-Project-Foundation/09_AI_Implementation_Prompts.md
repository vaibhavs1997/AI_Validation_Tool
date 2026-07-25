# TestForge — Sprint 01: Project Foundation

## AI Implementation Prompts

**Document Version:** 1.0
**Sprint:** Sprint 01
**Date:** 2026-07-25
**Author:** Lead Product Architect

---

## Overview

This document contains ready-to-use coding prompts for Claude Code for each implementation task in Sprint 01. Each prompt contains enough context for the task to be completed independently.

---

## TASK-001: Set up project types and constants

```
You are a senior TypeScript engineer working on TestForge, a React + TypeScript + Vite frontend.

CONTEXT:
- The project already has types in frontend/src/types/index.ts
- The project already has utils in frontend/src/utils/index.ts
- You need to add new types for project update and delete operations

TASK:
1. Add the following interfaces to frontend/src/types/index.ts:
   - UpdateProjectRequest { name: string }
   - DeleteProjectResponse { success: boolean; message: string; id: string }
   - Enhanced ListProjectsResponse with total, limit, offset fields
   - ProjectContextValue interface with all project state and actions

2. Create frontend/src/utils/constants.ts with:
   - PROJECT_ID_PATTERN = /^[a-zA-Z0-9._-]+$/
   - MAX_PROJECT_ID_LENGTH = 100
   - DEFAULT_PROJECT_ID = 'default'
   - SEARCH_DEBOUNCE_MS = 300
   - SIDEBAR_WIDTH = 248
   - HEADER_HEIGHT = 72

3. Update frontend/src/utils/index.ts to export constants

CONSTRAINTS:
- Use existing code style (no semicolons, 2-space indent)
- All types must be exported
- Run npm run typecheck to verify

FILES TO MODIFY:
- frontend/src/types/index.ts (add new types)
- frontend/src/utils/constants.ts (new file)
- frontend/src/utils/index.ts (add exports)
```

---

## TASK-002: Create shared UI components

```
You are a senior React engineer working on TestForge, a React 18 + TypeScript + Vite SPA.

CONTEXT:
- The project uses CSS custom properties for theming (light/dark)
- All icons are inline SVGs (no external icon library)
- Existing components are in frontend/src/components/
- CSS is in frontend/src/styles/index.css

TASK:
Create the following reusable components in frontend/src/components/common/:

1. Modal.tsx - Reusable modal dialog
   - Props: isOpen, onClose, title, description, size, children, footer
   - Features: focus trap, escape to close, aria attributes
   - Use CSS custom properties for theming

2. Button.tsx - Reusable button
   - Props: children, variant, size, disabled, loading, onClick, type, className, ariaLabel
   - Variants: primary, secondary, danger, ghost
   - Sizes: sm, md, lg
   - Show spinner when loading

3. Input.tsx - Reusable input field
   - Props: label, value, onChange, placeholder, helperText, error, disabled, type, id, autoFocus, onKeyDown
   - Show error state with red border and message
   - Associate label with input via htmlFor/id

4. SearchBar.tsx - Search input with clear button
   - Props: value, onChange, placeholder, ariaLabel, debounceMs
   - Show clear button when there is text
   - Debounced onChange

5. EmptyState.tsx - Empty state component
   - Props: icon, title, description, actionLabel, onAction, variant

6. LoadingSpinner.tsx - Circular loading indicator
   - Props: size, label

7. ErrorBoundary.tsx - React error boundary
   - Props: children, fallback

8. Create index.ts barrel export

CONSTRAINTS:
- All components must be accessible (ARIA, keyboard nav)
- All components must work in light and dark themes
- Use inline SVG icons (no external library)
- Follow existing code style (no semicolons, 2-space indent)
- Add CSS styles to frontend/src/styles/index.css

FILES TO CREATE:
- frontend/src/components/common/Modal.tsx
- frontend/src/components/common/Button.tsx
- frontend/src/components/common/Input.tsx
- frontend/src/components/common/SearchBar.tsx
- frontend/src/components/common/EmptyState.tsx
- frontend/src/components/common/LoadingSpinner.tsx
- frontend/src/components/common/ErrorBoundary.tsx
- frontend/src/components/common/index.ts
```

---

## TASK-003: Enhance ProjectIdentity domain model

```
You are a senior Node.js engineer working on TestForge backend.

CONTEXT:
- The backend is a single-file HTTP server using Node.js built-in http module
- ProjectIdentity is in src/domain/ProjectIdentity.js
- The existing code uses CommonJS (require/module.exports)
- Existing validation: validateProjectIdentity(project) checks id, name, createdAt, updatedAt

TASK:
Enhance src/domain/ProjectIdentity.js:

1. Add PROJECT_ID_PATTERN constant: /^[a-zA-Z0-9._-]+$/

2. Add validateProjectId(id) function:
   - Throws if id is not a non-empty string
   - Throws if id.length > 100
   - Throws if id doesn't match PROJECT_ID_PATTERN

3. Add validateProjectName(name) function:
   - Throws if name is provided but empty/whitespace

4. Update createProjectIdentity to call validateProjectId and validateProjectName

CONSTRAINTS:
- Use existing code style (CommonJS, 2-space indent)
- Don't break existing API (createProjectIdentity, validateProjectIdentity, DEFAULT_PROJECT, getDefaultProjectIdentity)
- Run existing tests to verify

FILES TO MODIFY:
- src/domain/ProjectIdentity.js
```

---

## TASK-004: Add update and delete to ProjectRepository

```
You are a senior Node.js engineer working on TestForge backend.

CONTEXT:
- ProjectRepository is in src/domain/ProjectRepository.js
- It delegates to FileProjectRepository or PostgresProjectRepository based on config
- FileProjectRepository is in src/domain/repositories/FileProjectRepository.js
- PostgresProjectRepository is in src/domain/repositories/PostgresProjectRepository.js
- The existing code uses CommonJS

TASK:
Add the following functions to all three files:

1. updateProject(id, { name })
   - File: read file, update name and updatedAt, write file
   - Postgres: UPDATE projects SET name = $1, updated_at = now() WHERE id = $2
   - Return the updated project object

2. deleteProject(id)
   - File: delete the project file
   - Postgres: DELETE FROM projects WHERE id = $1
   - Throw error if id === 'default' (cannot delete default project)
   - Throw error if project doesn't exist

3. searchProjects(query)
   - File: read all projects, filter by id/name (case-insensitive)
   - Postgres: SELECT * FROM projects WHERE id ILIKE $1 OR name ILIKE $1

4. Enhance listProjects to accept { search, sort, order, limit, offset }
   - search: filter by id/name
   - sort: sort by id, name, createdAt, updatedAt
   - order: asc or desc

CONSTRAINTS:
- All three files must implement the same interface
- Use existing code style (CommonJS, 2-space indent)
- File operations should be atomic (write to temp, rename)
- Postgres should use parameterized queries

FILES TO MODIFY:
- src/domain/ProjectRepository.js
- src/domain/repositories/FileProjectRepository.js
- src/domain/repositories/PostgresProjectRepository.js
```

---

## TASK-005: Add backend API endpoints

```
You are a senior Node.js engineer working on TestForge backend.

CONTEXT:
- The server is in src/server.js using Node.js built-in http module
- The server uses manual URL pattern matching (no Express)
- Existing project endpoints: GET /api/projects, POST /api/projects, GET /api/projects/:id
- The server uses sendJson(res, status, data) for JSON responses
- The server uses readBody(req) for reading POST bodies

TASK:
Add the following endpoints to src/server.js:

1. PATCH /api/projects/:id
   - Read body: { name }
   - Call updateProject(projectId, { name })
   - Return 200 with { project } on success
   - Return 404 if project not found
   - Return 400 if name is empty
   - Return 400 on other errors

2. DELETE /api/projects/:id
   - Call deleteProject(projectId)
   - Return 200 with { success: true, message: "...", id } on success
   - Return 400 if trying to delete default project
   - Return 404 if project not found

3. Enhance GET /api/projects
   - Read query params: search, sort, order, limit, offset
   - Pass to listProjects({ search, sort, order, limit, offset })
   - Return { projects, total, limit, offset }

4. Enhance POST /api/projects
   - Add stricter validation using validateProjectId and validateProjectName
   - Return 400 with specific error messages

CONSTRAINTS:
- Follow existing code patterns in server.js
- Use proper HTTP status codes (200, 400, 404, 409)
- Log requests in the existing format
- Don't break existing endpoints

FILES TO MODIFY:
- src/server.js
```

---

## TASK-006: Enhance frontend ProjectService

```
You are a senior TypeScript engineer working on TestForge frontend.

CONTEXT:
- ProjectService is in frontend/src/features/project-setup/ProjectService.ts
- It uses apiClient from frontend/src/services/ApiClient.ts
- Existing functions: listProjects, getProject, createProject
- Types are in frontend/src/types/index.ts

TASK:
Add the following functions to frontend/src/features/project-setup/ProjectService.ts:

1. updateProject(projectId: string, data: UpdateProjectRequest): Promise<Project>
   - PATCH /api/projects/:projectId
   - Return the updated project

2. deleteProject(projectId: string): Promise<DeleteProjectResponse>
   - DELETE /api/projects/:projectId
   - Return the delete response

3. searchProjects(query: string): Promise<Project[]>
   - GET /api/projects?search=query
   - Return the filtered projects

4. Enhance listProjects to accept optional { search, sort, order, limit, offset }
   - Return { projects, total, limit, offset }

CONSTRAINTS:
- Use existing code style (no semicolons, 2-space indent)
- Use apiClient for HTTP requests
- Return typed responses
- Handle errors consistently with existing patterns

FILES TO MODIFY:
- frontend/src/features/project-setup/ProjectService.ts
```

---

## TASK-007: Create utility functions

```
You are a senior TypeScript engineer working on TestForge frontend.

CONTEXT:
- Utils are in frontend/src/utils/
- Existing utils are in frontend/src/utils/index.ts
- The project uses TypeScript

TASK:
Create the following utility files:

1. frontend/src/utils/validators.ts
   - validateProjectId(id: string): string | null
     - Returns null if valid, error message if invalid
     - Check: non-empty, ≤ 100 chars, matches /^[a-zA-Z0-9._-]+$/
   - validateProjectName(name: string): string | null
     - Returns null if valid, error message if invalid
     - Check: non-empty if provided

2. frontend/src/utils/formatDate.ts
   - formatDate(date: string | Date): string
     - Format as "Jan 15, 2025"
   - formatDateRelative(date: string | Date): string
     - Format as "2 hours ago", "yesterday", etc.

3. Update frontend/src/utils/index.ts to export all utilities

CONSTRAINTS:
- Use existing code style (no semicolons, 2-space indent)
- All functions must have TypeScript types
- All functions must be exported

FILES TO CREATE:
- frontend/src/utils/validators.ts
- frontend/src/utils/formatDate.ts

FILES TO MODIFY:
- frontend/src/utils/index.ts
```

---

## TASK-008: Create custom hooks

```
You are a senior React engineer working on TestForge frontend.

CONTEXT:
- Hooks are in frontend/src/hooks/
- Existing hooks are in frontend/src/hooks/index.ts
- ProjectService is in frontend/src/features/project-setup/ProjectService.ts
- The project uses React 18 with TypeScript

TASK:
Create the following custom hooks:

1. frontend/src/hooks/useProjects.ts
   - Fetches projects on mount
   - Returns { projects, isLoading, error, refetch }
   - Uses ProjectService.listProjects()

2. frontend/src/hooks/useProject.ts
   - Fetches a single project by ID
   - Params: projectId: string
   - Returns { project, isLoading, error }
   - Uses ProjectService.getProject()

3. frontend/src/hooks/useDebounce.ts
   - Generic hook to debounce a value
   - Params: value: T, delay: number = 300
   - Returns debounced value

4. frontend/src/hooks/useLocalStorage.ts
   - Syncs state with localStorage
   - Params: key: string, initialValue: T
   - Returns [value, setValue]

5. Update frontend/src/hooks/index.ts with exports

CONSTRAINTS:
- Use existing code style (no semicolons, 2-space indent)
- All hooks must have TypeScript types
- All hooks must handle loading and error states
- useDebounce must be generic

FILES TO CREATE:
- frontend/src/hooks/useProjects.ts
- frontend/src/hooks/useProject.ts
- frontend/src/hooks/useDebounce.ts
- frontend/src/hooks/useLocalStorage.ts

FILES TO MODIFY:
- frontend/src/hooks/index.ts
```

---

## TASK-009: Create ProjectProvider context

```
You are a senior React engineer working on TestForge frontend.

CONTEXT:
- ProjectService is in frontend/src/features/project-setup/ProjectService.ts
- Types are in frontend/src/types/index.ts (ProjectContextValue)
- The project uses React 18 with TypeScript
- Existing hooks: useProjects, useProject

TASK:
Create frontend/src/features/project-setup/ProjectContext.ts:

1. Create ProjectContext using React.createContext
2. Create ProjectProvider component that:
   - Fetches projects on mount
   - Manages activeProject state
   - Provides createProject, updateProject, deleteProject functions
   - Provides refreshProjects function
   - Handles loading and error states
3. Export useProjectContext hook for consuming the context

The context should provide:
- activeProject: Project | null
- projects: Project[]
- isLoading: boolean
- error: string | null
- setActiveProject: (project: Project | null) => void
- refreshProjects: () => Promise<void>
- createProject: (data: CreateProjectRequest) => Promise<Project>
- updateProject: (id: string, data: UpdateProjectRequest) => Promise<Project>
- deleteProject: (id: string) => Promise<void>

CONSTRAINTS:
- Use existing code style (no semicolons, 2-space indent)
- All values must be typed
- Context updates must trigger re-renders
- Handle loading and error states

FILES TO CREATE:
- frontend/src/features/project-setup/ProjectContext.ts
```

---

## TASK-010: Enhance SetupPage with search and filtering

```
You are a senior React engineer working on TestForge frontend.

CONTEXT:
- SetupPage is in frontend/src/features/project-setup/SetupPage.tsx
- It already has project creation and listing functionality
- Shared components are available: SearchBar, EmptyState, LoadingSpinner
- ProjectProvider is available for context
- The project uses React 18 with TypeScript

TASK:
Enhance SetupPage to add:

1. SearchBar above the project list
2. Search filtering logic (debounced 300ms using useDebounce)
   - Filter by project ID and name (case-insensitive)
3. EmptyState when no projects match search
4. Loading state (spinner) while fetching
5. Error state with retry button
6. Integrate with ProjectProvider (use context instead of direct API calls)
7. Keyboard shortcut: Ctrl/Cmd + K focuses search input

CONSTRAINTS:
- Use existing code style (no semicolons, 2-space indent)
- Don't break existing project creation functionality
- Search must be case-insensitive
- Use useDebounce hook for search
- All states must be accessible

FILES TO MODIFY:
- frontend/src/features/project-setup/SetupPage.tsx
```

---

## TASK-011: Create ProjectDashboard

```
You are a senior React engineer working on TestForge frontend.

CONTEXT:
- No ProjectDashboard exists yet
- Shared components are available: Modal, Button, Input, Panel
- ProjectService is available for API calls
- Types are in frontend/src/types/index.ts
- The project uses React 18 with TypeScript

TASK:
Create frontend/src/features/project-setup/ProjectDashboard.tsx:

1. DashboardHeader section:
   - Project name (H1)
   - Project ID
   - Created/Updated dates (formatted)
   - Quick action buttons: Change Project, Edit, Delete

2. ProjectStatusSection:
   - StatusCard with "Not configured" indicator (no APIs yet)
   - Message: "No APIs have been imported yet."

3. NextStepsSection:
   - StepCard for "Import APIs" (step 1)
   - StepCard for "Analyze Dependencies" (step 2)
   - StepCard for "Generate Test Cases" (step 3)
   - Each with description and CTA

4. Loading state: skeleton placeholders
5. Error state: redirect to setup page

Props:
- projectId: string
- onNavigateBack: () => void

CONSTRAINTS:
- Use existing code style (no semicolons, 2-space indent)
- Use CSS custom properties for theming
- Dashboard must load within 500ms
- All components must be accessible
- Use formatDate utility for date formatting

FILES TO CREATE:
- frontend/src/features/project-setup/ProjectDashboard.tsx
```

---

## TASK-012: Create EditProjectDialog

```
You are a senior React engineer working on TestForge frontend.

CONTEXT:
- Modal, Input, and Button shared components are available
- ProjectService.updateProject is available
- Types are in frontend/src/types/index.ts
- The project uses React 18 with TypeScript

TASK:
Create frontend/src/features/project-setup/EditProjectDialog.tsx:

Props:
- isOpen: boolean
- onClose: () => void
- project: Project
- onSave: (name: string) => Promise<void>

Features:
1. Use Modal component with title "Edit Project"
2. Use Input component for project name (pre-filled with current name)
3. Save button (disabled when input is empty, shows spinner when loading)
4. Cancel button (closes dialog)
5. Error message display
6. Escape key closes dialog
7. Focus trapped within dialog
8. Initial focus on the name input

CONSTRAINTS:
- Use existing code style (no semicolons, 2-space indent)
- Use shared components (Modal, Input, Button)
- All features must be accessible
- Don't break existing modal patterns

FILES TO CREATE:
- frontend/src/features/project-setup/EditProjectDialog.tsx
```

---

## TASK-013: Create DeleteProjectDialog

```
You are a senior React engineer working on TestForge frontend.

CONTEXT:
- Modal, Input, and Button shared components are available
- ProjectService.deleteProject is available
- Types are in frontend/src/types/index.ts
- The project uses React 18 with TypeScript

TASK:
Create frontend/src/features/project-setup/DeleteProjectDialog.tsx:

Props:
- isOpen: boolean
- onClose: () => void
- project: Project
- onDelete: () => Promise<void>

Features:
1. Use Modal component with title "Delete Project"
2. Display project name and ID
3. Input for ID confirmation (user must type exact project ID)
4. Delete button (disabled until input matches project ID exactly)
5. Visual feedback: green border when input matches, red when it doesn't
6. Cancel button (closes dialog)
7. Loading state (spinner on delete button)
8. Error message display
9. Escape key closes dialog
10. Focus trapped within dialog

CONSTRAINTS:
- Use existing code style (no semicolons, 2-space indent)
- Use shared components (Modal, Input, Button)
- Delete button must be disabled until input matches exactly
- All features must be accessible
- Prevent deletion of default project (hide or disable button)

FILES TO CREATE:
- frontend/src/features/project-setup/DeleteProjectDialog.tsx
```

---

## TASK-014: Integrate ProjectDashboard into App

```
You are a senior React engineer working on TestForge frontend.

CONTEXT:
- App.tsx is the root component
- It currently renders SetupPage, WorkspacePage, ResultsPage, HistoryPage
- ProjectDashboard and ProjectProvider are now available
- The app uses hash-based routing

TASK:
Update App.tsx to:

1. Wrap the app in ProjectProvider
2. Render ProjectDashboard when a project is active
3. Render SetupPage when no project is active
4. Add hash-based routing for project context:
   - #setup → SetupPage (no active project)
   - #workspace?project=payments-api → ProjectDashboard
5. Update Header to show active project name
6. Update Sidebar with project-specific nav items
7. Handle browser back button
8. Preserve active project on page reload

CONSTRAINTS:
- Use existing code style (no semicolons, 2-space indent)
- Don't break existing routing for workspace, results, history
- Hash-based routing only (no React Router)
- Project ID is passed as query param in hash

FILES TO MODIFY:
- frontend/src/App.tsx
- frontend/src/components/layout/Header.tsx (show project name)
- frontend/src/components/layout/Sidebar.tsx (project-specific nav)
```

---

## TASK-015: Add responsive design

```
You are a senior CSS engineer working on TestForge frontend.

CONTEXT:
- CSS is in frontend/src/styles/index.css
- The project uses CSS custom properties for theming
- Existing breakpoints: 768px (mobile), 1200px (tablet)
- The project has a sidebar (248px) and header (72px)

TASK:
Add responsive design to frontend/src/styles/index.css:

1. Mobile (≤ 768px):
   - Hide sidebar (display: none)
   - Add hamburger menu toggle
   - Stack form fields vertically in SetupPage
   - Stack dashboard action buttons vertically
   - Full-width create button
   - Reduce padding

2. Tablet (769px – 1200px):
   - Keep sidebar visible
   - Compact form fields
   - Reduce card padding

3. Desktop (≥ 1201px):
   - Full layout (no changes needed)

4. Touch targets:
   - Ensure all interactive elements are ≥ 44px × 44px on mobile

CONSTRAINTS:
- Use existing CSS custom properties
- Use @media queries
- Don't break existing styles
- Test on various screen sizes

FILES TO MODIFY:
- frontend/src/styles/index.css
```

---

## TASK-016: Add accessibility features

```
You are a senior frontend engineer specializing in accessibility.

CONTEXT:
- The project has shared components: Modal, Button, Input, SearchBar, EmptyState
- The project has feature components: SetupPage, ProjectDashboard
- The project uses React 18 with TypeScript
- WCAG 2.1 AA compliance is required

TASK:
Add accessibility features to all components:

1. Modal:
   - role="dialog", aria-modal="true"
   - aria-labelledby → title
   - aria-describedby → description
   - Focus trap (Tab cycles within modal)
   - Escape to close
   - Initial focus on first focusable element

2. Button:
   - aria-label for icon-only buttons
   - aria-busy="true" when loading
   - aria-pressed for toggle buttons

3. Input:
   - <label> associated with <input> via htmlFor/id
   - aria-invalid="true" when error
   - aria-describedby → helper text or error message

4. SearchBar:
   - aria-label on input
   - aria-label on clear button

5. SetupPage:
   - <main> landmark
   - aria-label on page intro
   - aria-current="page" on active project

6. ProjectDashboard:
   - <main> landmark
   - <h1> for project title
   - aria-label on action buttons
   - aria-live for status updates

7. Color contrast:
   - Ensure 4.5:1 for normal text
   - Ensure 3:1 for large text

CONSTRAINTS:
- Use semantic HTML
- Use ARIA attributes correctly
- Don't break existing functionality
- Test with keyboard navigation

FILES TO MODIFY:
- frontend/src/components/common/Modal.tsx
- frontend/src/components/common/Button.tsx
- frontend/src/components/common/Input.tsx
- frontend/src/components/common/SearchBar.tsx
- frontend/src/features/project-setup/SetupPage.tsx
- frontend/src/features/project-setup/ProjectDashboard.tsx
```

---

## TASK-017: Write tests

```
You are a senior QA engineer working on TestForge.

CONTEXT:
- Backend tests use Node.js assert module
- Frontend tests use Vitest + React Testing Library
- Existing backend tests are in Tool/AI/ directory
- Existing frontend tests are alongside components (*.test.tsx)

TASK:
Write tests for:

BACKEND:
1. frontend/../Tool/AI/test-domain-ProjectIdentity-validation.js
   - Test validateProjectId with valid IDs
   - Test validateProjectId with invalid IDs (empty, too long, special chars)
   - Test validateProjectName with valid names
   - Test validateProjectName with empty names

2. Tool/AI/test-api-project-crud.js
   - Test POST /api/projects (create)
   - Test GET /api/projects (list)
   - Test GET /api/projects/:id (get)
   - Test PATCH /api/projects/:id (update)
   - Test DELETE /api/projects/:id (delete)
   - Test search and sort query parameters

FRONTEND:
3. frontend/src/components/common/Modal.test.tsx
   - Test modal opens/closes
   - Test escape key closes
   - Test focus trap

4. frontend/src/components/common/Input.test.tsx
   - Test rendering with label
   - Test error state
   - Test change events

5. frontend/src/features/project-setup/ProjectDashboard.test.tsx
   - Test rendering with project data
   - Test loading state
   - Test error state

6. frontend/src/features/project-setup/SetupPage.test.tsx
   - Test rendering with projects
   - Test search filtering
   - Test empty state

CONSTRAINTS:
- Backend tests use Node.js assert
- Frontend tests use Vitest + RTL
- Test coverage ≥ 80% for new code
- All tests must pass

FILES TO CREATE:
- Tool/AI/test-domain-ProjectIdentity-validation.js
- Tool/AI/test-api-project-crud.js
- frontend/src/components/common/Modal.test.tsx
- frontend/src/components/common/Input.test.tsx
- frontend/src/features/project-setup/ProjectDashboard.test.tsx
- frontend/src/features/project-setup/SetupPage.test.tsx
```

---

## TASK-018: Update documentation and CSS

```
You are a senior frontend engineer working on TestForge.

CONTEXT:
- CSS is in frontend/src/styles/index.css
- README is in Tool/AI/README.md
- The project uses CSS custom properties for theming

TASK:
1. Add CSS styles for all new components:
   - Modal (overlay, dialog, header, body, footer)
   - Button (variants, sizes, states)
   - Input (label, field, helper text, error)
   - SearchBar (input, clear button)
   - EmptyState (icon, title, description, CTA)
   - LoadingSpinner (spinner animation)
   - ProjectDashboard (header, status, next steps)
   - EditProjectDialog and DeleteProjectDialog

2. Add responsive media queries for mobile (≤ 768px)

3. Add dark/light theme variables for new components

4. Update Tool/AI/README.md with new API endpoints:
   - PATCH /api/projects/:id
   - DELETE /api/projects/:id
   - Enhanced GET /api/projects (search, sort)

CONSTRAINTS:
- Use existing CSS custom properties
- Follow existing CSS code style
- All components must work in both themes
- README must document all new endpoints with examples

FILES TO MODIFY:
- frontend/src/styles/index.css
- Tool/AI/README.md
```

---

*End of AI Implementation Prompts — Sprint 01: Project Foundation*
