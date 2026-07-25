# TestForge — Sprint 01: Project Lifecycle Management

## Component Breakdown

**Document Version:** 2.0
**Sprint:** Sprint 01
**Date:** 2026-07-25
**Author:** Lead Product Architect

---

## 1. Overview

This document breaks down every screen into reusable React components. Components are organized by category: Shared (used across multiple features), Feature-specific (used within a single feature), and Layout (structural components).

### 1.1 Component Hierarchy

```
App
├── Layout Components
│   ├── Sidebar
│   ├── Header
│   └── AppShell
├── Shared Components
│   ├── Modal
│   ├── Button
│   ├── Input
│   ├── SearchBar
│   ├── EmptyState
│   ├── LoadingSpinner
│   ├── ErrorBoundary
│   └── Panel
├── Project Setup Feature
│   ├── SetupPage
│   │   ├── PageIntro
│   │   ├── ProjectSetupCard
│   │   │   ├── CardIntroHeader
│   │   │   ├── SearchBar
│   │   │   ├── ExistingProjectsSection
│   │   │   │   ├── ProjectList
│   │   │   │   │   ├── ProjectListItem (× N)
│   │   │   │   │   └── EmptyState (no projects)
│   │   │   │   └── EmptyState (search no results)
│   │   │   ├── Divider
│   │   │   └── CreateProjectSection
│   │   │       ├── SectionHeading
│   │   │       ├── CreateProjectForm
│   │   │       │   ├── FormField (Project ID)
│   │   │       │   ├── FormField (Project Name)
│   │   │       │   └── CreateButton
│   │   │       └── ProjectError
│   │   └── InfoCallout
│   └── ProjectDashboard
│       ├── DashboardHeader
│       │   ├── ProjectTitle
│       │   ├── ProjectMeta
│       │   └── QuickActions
│       │       ├── ChangeProjectButton
│       │       ├── EditProjectButton
│       │       └── DeleteProjectButton
│       ├── ProjectStatusSection
│       │   ├── StatusCard
│       │   └── StatusIndicator
│       ├── NextStepsSection
│       │   ├── StepCard
│       │   └── CallToAction
│       ├── EditProjectDialog
│       │   └── Modal (shared)
│       └── DeleteProjectDialog
│           └── Modal (shared)
└── Context/Providers
    └── ProjectProvider
```

---

## 2. Shared Components

### 2.1 Modal

**File:** `frontend/src/components/common/Modal.tsx`  
**Purpose:** Reusable modal dialog for forms and confirmations  
**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Whether the modal is visible |
| `onClose` | () => void | Yes | Called when modal is closed |
| `title` | string | Yes | Modal title |
| `description` | string | No | Modal description (for accessibility) |
| `size` | 'sm' \| 'md' \| 'lg' | No | Modal width (default: 'md') |
| `children` | ReactNode | Yes | Modal content |
| `footer` | ReactNode | No | Modal footer (action buttons) |

**States:**
- Default (closed)
- Open (with animation)
- Loading (footer disabled)
- Closing (with animation)

**Accessibility:**
- `role="dialog"`, `aria-modal="true"`
- `aria-labelledby` → title
- `aria-describedby` → description
- Focus trap
- Escape to close
- Initial focus on first focusable element

**Usage:**
```tsx
<Modal
  isOpen={isEditOpen}
  onClose={() => setEditOpen(false)}
  title="Edit Project"
  description="Update your project name."
>
  <EditProjectForm projectId={activeProject.id} />
</Modal>
```

---

### 2.2 Button

**File:** `frontend/src/components/common/Button.tsx`  
**Purpose:** Reusable button with consistent styling and states  
**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `children` | ReactNode | Yes | — | Button content |
| `variant` | 'primary' \| 'secondary' \| 'danger' \| 'ghost' | No | 'primary' | Visual style |
| `size` | 'sm' \| 'md' \| 'lg' | No | 'md' | Button size |
| `disabled` | boolean | No | false | Disabled state |
| `loading` | boolean | No | false | Loading spinner |
| `onClick` | () => void | No | — | Click handler |
| `type` | 'button' \| 'submit' \| 'reset' | No | 'button' | HTML button type |
| `className` | string | No | — | Additional CSS classes |
| `ariaLabel` | string | No | — | Accessible name (for icon buttons) |

**States:**
- Default
- Hover
- Active
- Disabled
- Loading (spinner + disabled)
- Focus (visible outline)

**Variants:**
- `primary`: Filled with `--color-primary`, white text
- `secondary`: Outlined with `--color-border`, `--color-text-primary` text
- `danger`: Filled with `--color-error`, white text
- `ghost`: Transparent, `--color-text-secondary` text

**Usage:**
```tsx
<Button variant="primary" loading={isCreating} onClick={handleCreate}>
  Create Project
</Button>

<Button variant="danger" ariaLabel="Delete project">
  🗑
</Button>
```

---

### 2.3 Input

**File:** `frontend/src/components/common/Input.tsx`  
**Purpose:** Reusable input field with label, helper text, and validation  
**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | string | Yes | — | Input label |
| `value` | string | Yes | — | Input value |
| `onChange` | (value: string) => void | Yes | — | Change handler |
| `placeholder` | string | No | — | Placeholder text |
| `helperText` | string | No | — | Helper text below input |
| `error` | string | No | — | Error message |
| `disabled` | boolean | No | false | Disabled state |
| `type` | 'text' \| 'email' \| 'password' | No | 'text' | Input type |
| `id` | string | Yes | — | HTML id (for label association) |
| `autoFocus` | boolean | No | false | Auto-focus on mount |
| `onKeyDown` | (e: KeyboardEvent) => void | No | — | Key down handler |
| `ariaDescribedBy` | string | No | — | ARIA describedby |

**States:**
- Default
- Focused
- Error (red border + error message)
- Disabled
- Helper text (always visible)

**Accessibility:**
- `<label>` associated with `<input>` via `htmlFor`/`id`
- `aria-invalid="true"` when error is present
- `aria-describedby` pointing to helper text or error message

**Usage:**
```tsx
<Input
  id="project-id-input"
  label="Project ID"
  placeholder="e.g. payments-api"
  value={projectId}
  onChange={setProjectId}
  error={projectIdError}
  helperText="Used as the unique project identifier."
  onKeyDown={handleKeyDown}
/>
```

---

### 2.4 SearchBar

**File:** `frontend/src/components/common/SearchBar.tsx`  
**Purpose:** Search input with clear button and debounced filtering  
**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | string | Yes | — | Current search value |
| `onChange` | (value: string) => void | Yes | — | Change handler |
| `placeholder` | string | No | 'Search...' | Placeholder text |
| `ariaLabel` | string | No | 'Search' | Accessible label |
| `debounceMs` | number | No | 300 | Debounce delay in ms |

**States:**
- Empty (no clear button)
- Typing (clear button visible)
- Focused

**Accessibility:**
- `aria-label` for the input
- Clear button has `aria-label="Clear search"`

**Usage:**
```tsx
<SearchBar
  value={searchQuery}
  onChange={setSearchQuery}
  placeholder="Search projects..."
  ariaLabel="Search projects"
/>
```

---

### 2.5 EmptyState

**File:** `frontend/src/components/common/EmptyState.tsx`  
**Purpose:** Consistent empty state with icon, message, and optional CTA  
**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `icon` | ReactNode | No | 📁 | Icon element |
| `title` | string | Yes | — | Title text |
| `description` | string | No | — | Description text |
| `actionLabel` | string | No | — | CTA button label |
| `onAction` | () => void | No | — | CTA click handler |
| `variant` | 'dashed' \| 'solid' | No | 'dashed' | Visual style |

**States:**
- With CTA button
- Without CTA button (just message)

**Usage:**
```tsx
<EmptyState
  icon={<IconFolderPlus />}
  title="No projects yet"
  description="Create your first project below to start testing APIs."
  actionLabel="Create Project"
  onAction={() => setShowCreateDialog(true)}
/>
```

---

### 2.6 LoadingSpinner

**File:** `frontend/src/components/common/LoadingSpinner.tsx`  
**Purpose:** Circular loading indicator  
**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `size` | 'sm' \| 'md' \| 'lg' | No | 'md' | Spinner size |
| `label` | string | No | — | Accessible label (sr-only) |

**Usage:**
```tsx
<LoadingSpinner size="sm" label="Loading projects..." />
```

---

### 2.7 ErrorBoundary

**File:** `frontend/src/components/common/ErrorBoundary.tsx`  
**Purpose:** Catch React errors and display a fallback UI  
**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | ReactNode | Yes | Content to wrap |
| `fallback` | ReactNode | No | Custom fallback UI |

**Usage:**
```tsx
<ErrorBoundary>
  <ProjectDashboard />
</ErrorBoundary>
```

---

### 2.8 Panel

**File:** `frontend/src/components/common/Panel.tsx`  
**Purpose:** Section container with header, step indicator, and expandable body  
**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `step` | number | Yes | — | Step number |
| `title` | string | Yes | — | Panel title |
| `children` | ReactNode | Yes | — | Panel content |

**Usage:**
```tsx
<Panel step={1} title="Project Status">
  <StatusCard />
</Panel>
```

---

## 3. Layout Components

### 3.1 Sidebar

**File:** `frontend/src/components/layout/Sidebar.tsx`  
**Purpose:** Navigation sidebar with brand and nav items  
**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `currentView` | View | Yes | Current active view |
| `onViewChange` | (view: View) => void | Yes | View change handler |

**Enhanced in Sprint 01:**
- Add project-specific nav items when a project is active
- Add "Back to Projects" link

---

### 3.2 Header

**File:** `frontend/src/components/layout/Header.tsx`  
**Purpose:** Top header with page title, project context, and theme switcher  
**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `view` | View | Yes | — | Current view |
| `projectName` | string | No | — | Active project name |
| `environment` | string | No | — | Active environment |

**Enhanced in Sprint 01:**
- Show active project name when a project is selected
- Show "Change Project" button

---

### 3.3 AppShell

**File:** `frontend/src/components/layout/AppShell.tsx`  
**Purpose:** Root layout wrapper  
**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | ReactNode | Yes | Page content |

---

## 4. Project Setup Feature Components

### 4.1 SetupPage

**File:** `frontend/src/features/project-setup/SetupPage.tsx`  
**Purpose:** Main project setup page (no active project)  
**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `activeProjectId` | string \| null | Yes | Currently active project ID |
| `onActiveProjectChange` | (projectId: string \| null) => void | Yes | Project change handler |

**Enhanced in Sprint 01:**
- Add `SearchBar` above project list
- Add search filtering logic
- Add `EmptyState` for no results
- Add loading and error states
- Add `ProjectProvider` integration

**Internal State:**
- `projects: Project[]`
- `searchQuery: string`
- `newProjectId: string`
- `newProjectName: string`
- `creating: boolean`
- `projectError: string`

---

### 4.2 ProjectDashboard

**File:** `frontend/src/features/project-setup/ProjectDashboard.tsx`  
**Purpose:** Dashboard for an active project  
**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `projectId` | string | Yes | Project ID |
| `onNavigateBack` | () => void | Yes | Navigate back to setup |

**Components:**
- `DashboardHeader` — Project title, ID, dates, action buttons
- `ProjectStatusSection` — Status indicator
- `NextStepsSection` — Guidance cards
- `EditProjectDialog` — Edit modal
- `DeleteProjectDialog` — Delete confirmation modal

**Internal State:**
- `project: Project \| null`
- `loading: boolean`
- `error: string \| null`
- `isEditOpen: boolean`
- `isDeleteOpen: boolean`

---

### 4.3 ProjectListItem

**File:** `frontend/src/features/project-setup/ProjectListItem.tsx`  
**Purpose:** Individual project in the list  
**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `project` | Project | Yes | Project data |
| `isSelected` | boolean | No | Whether this project is active |
| `onClick` | (project: Project) => void | Yes | Click handler |

**States:**
- Default
- Hover
- Selected (active)

**Accessibility:**
- `role="button"`
- `aria-current="page"` when selected
- Keyboard navigable

---

### 4.4 ProjectList

**File:** `frontend/src/features/project-setup/ProjectList.tsx`  
**Purpose:** List of projects with filtering  
**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `projects` | Project[] | Yes | List of projects |
| `selectedProjectId` | string \| null | No | Currently selected project |
| `onProjectClick` | (project: Project) => void | Yes | Click handler |

---

### 4.5 EditProjectDialog

**File:** `frontend/src/features/project-setup/EditProjectDialog.tsx`  
**Purpose:** Modal dialog for editing project name  
**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Whether dialog is open |
| `onClose` | () => void | Yes | Close handler |
| `project` | Project | Yes | Project to edit |
| `onSave` | (name: string) => Promise<void> | Yes | Save handler |

**Components:**
- `Modal` (shared)
- `Input` (shared) — for project name
- `Button` (shared) — Save and Cancel

---

### 4.6 DeleteProjectDialog

**File:** `frontend/src/features/project-setup/DeleteProjectDialog.tsx`  
**Purpose:** Modal dialog for confirming project deletion  
**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Whether dialog is open |
| `onClose` | () => void | Yes | Close handler |
| `project` | Project | Yes | Project to delete |
| `onDelete` | () => Promise<void> | Yes | Delete handler |

**Components:**
- `Modal` (shared)
- `Input` (shared) — for ID confirmation
- `Button` (shared) — Delete and Cancel

**Special Logic:**
- Delete button disabled until input matches project ID
- Visual feedback (green/red border) on input

---

### 4.7 ProjectProvider

**File:** `frontend/src/features/project-setup/ProjectContext.ts`  
**Purpose:** React Context for project state management  
**Provides:**

| Value | Type | Description |
|-------|------|-------------|
| `activeProject` | Project \| null | Currently active project |
| `projects` | Project[] | All projects |
| `isLoading` | boolean | Loading state |
| `error` | string \| null | Error message |
| `setActiveProject` | (project: Project \| null) => void | Set active project |
| `refreshProjects` | () => Promise<void> | Re-fetch projects |
| `createProject` | (data: CreateProjectRequest) => Promise<Project> | Create project |
| `updateProject` | (id: string, data: UpdateProjectRequest) => Promise<Project> | Update project |
| `deleteProject` | (id: string) => Promise<void> | Delete project |

---

## 5. New Hooks

### 5.1 useProjects

**File:** `frontend/src/hooks/useProjects.ts`  
**Purpose:** Fetch and manage projects list  
**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `projects` | Project[] | List of projects |
| `isLoading` | boolean | Loading state |
| `error` | string \| null | Error message |
| `refetch` | () => void | Re-fetch projects |

---

### 5.2 useProject

**File:** `frontend/src/hooks/useProject.ts`  
**Purpose:** Fetch a single project by ID  
**Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `projectId` | string | Yes | Project ID |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `project` | Project \| null | Project data |
| `isLoading` | boolean | Loading state |
| `error` | string \| null | Error message |

---

### 5.3 useDebounce

**File:** `frontend/src/hooks/useDebounce.ts`  
**Purpose:** Debounce a value  
**Params:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `value` | T | Yes | — | Value to debounce |
| `delay` | number | No | 300 | Delay in ms |

**Returns:** Debounced value

---

### 5.4 useLocalStorage

**File:** `frontend/src/hooks/useLocalStorage.ts`  
**Purpose:** Sync state with localStorage  
**Params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | Yes | Storage key |
| `initialValue` | T | Yes | Initial value |

**Returns:** `[value, setValue]` tuple

---

## 6. New Utilities

### 6.1 validators.ts

**File:** `frontend/src/utils/validators.ts`  
**Functions:**

| Function | Description |
|----------|-------------|
| `validateProjectId(id: string): string \| null` | Validate project ID format |
| `validateProjectName(name: string): string \| null` | Validate project name |

---

### 6.2 formatDate.ts

**File:** `frontend/src/utils/formatDate.ts`  
**Functions:**

| Function | Description |
|----------|-------------|
| `formatDate(date: string \| Date): string` | Format as "Jan 15, 2025" |
| `formatDateRelative(date: string \| Date): string` | Format as "2 hours ago" |

---

### 6.3 constants.ts

**File:** `frontend/src/utils/constants.ts`  
**Constants:**

| Constant | Value | Description |
|----------|-------|-------------|
| `PROJECT_ID_PATTERN` | `/^[a-zA-Z0-9._-]+$/` | Project ID regex |
| `MAX_PROJECT_ID_LENGTH` | 100 | Max ID length |
| `DEFAULT_PROJECT_ID` | 'default' | Default project ID |
| `SEARCH_DEBOUNCE_MS` | 300 | Search debounce delay |
| `SIDEBAR_WIDTH` | 248 | Sidebar width in px |
| `HEADER_HEIGHT` | 72 | Header height in px |

---

## 7. Type Definitions

### 7.1 New Types (frontend/src/types/index.ts)

```typescript
// Project update request
export interface UpdateProjectRequest {
  name: string;
}

// Project list response (enhanced)
export interface ListProjectsResponse {
  projects: Project[];
  total: number;
  limit: number;
  offset: number;
}

// Delete project response
export interface DeleteProjectResponse {
  success: boolean;
  message: string;
  id: string;
}

// Project context value
export interface ProjectContextValue {
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

---

## 8. Component Reusability Matrix

| Component | Used In | Reusability Score |
|-----------|---------|-------------------|
| `Modal` | EditProjectDialog, DeleteProjectDialog, CreateProjectDialog | High |
| `Button` | All dialogs, forms, dashboards | Very High |
| `Input` | All forms, dialogs | Very High |
| `SearchBar` | SetupPage, (future: ResultsPage, HistoryPage) | High |
| `EmptyState` | SetupPage, ProjectList, (future: ResultsPage) | High |
| `LoadingSpinner` | All loading states | Very High |
| `Panel` | ProjectDashboard, (future: WorkspacePage) | Medium |
| `ProjectListItem` | ProjectList, (future: ProjectTable) | Medium |
| `ErrorBoundary` | App root, feature boundaries | High |

---

## 9. Component States Summary

### 9.1 Modal States

| State | Description |
|-------|-------------|
| Closed | Modal is not visible |
| Open | Modal is visible with content |
| Loading | Submit button shows spinner, inputs disabled |
| Closing | Modal is animating out |

### 9.2 Button States

| State | Description |
|-------|-------------|
| Default | Normal appearance |
| Hover | Background/transform change |
| Active | Pressed state |
| Disabled | Grayed out, not clickable |
| Loading | Spinner shown, disabled |
| Focus | Visible outline |

### 9.3 Input States

| State | Description |
|-------|-------------|
| Default | Empty or with value |
| Focused | Border/glow change |
| Error | Red border + error message |
| Disabled | Grayed out, not editable |

### 9.4 ProjectListItem States

| State | Description |
|-------|-------------|
| Default | Normal appearance |
| Hover | Background change |
| Selected | Active project highlight |

---

*End of Component Breakdown — Sprint 01: Project Lifecycle Management*
</parameter>
<task_progress>
- [x] Read all 10 Sprint 01 docs
- [x] Update 01_PRD.md for Project Lifecycle Management
- [x] Update 02_User_Stories.md
- [x] Update 03_UX_Specification.md
- [x] Update 04_Technical_Design.md
- [x] Update 05_API_Contracts.md
- [x] Update 06_Database_Model.md
- [ ] Update 07_Component_Breakdown.md
- [ ] Update 08_Implementation_Plan.md
- [ ] Update 09_AI_Implementation_Prompts.md
- [ ] Update 10_Definition_of_Done.md
- [ ] Produce changelog and readiness recommendation
</task_progress>
</write_to_file>