# TestForge — Sprint 01: Project Foundation

## UX Specification

**Document Version:** 1.0
**Sprint:** Sprint 01
**Date:** 2026-07-25
**Author:** Lead Product Architect

---

## 1. Design Principles

| Principle | Description |
|-----------|-------------|
| **Clarity First** | Every screen communicates its purpose immediately. No ambiguity about what the user should do next. |
| **Progressive Disclosure** | Complex actions (edit, delete) are hidden behind simple triggers. Only show what's needed. |
| **Consistent Patterns** | All forms, buttons, modals, and lists follow the same visual and interaction patterns. |
| **Error Prevention** | Validate input in real-time. Disable actions that would cause errors. |
| **Recovery-Oriented** | When errors occur, provide clear recovery paths (retry, cancel, undo). |
| **Accessibility by Default** | Every component is designed to be accessible from the start, not as an afterthought. |
| **Responsive by Default** | Every screen works on any device, from 360px to 4K+. |
| **Dark Mode Native** | Both themes are designed in parallel, not as an inversion of light mode. |

---

## 2. Design System

### 2.1 Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-bg-app` | `#F7F8FC` | `#0F172A` | App background |
| `--color-bg-surface` | `#FFFFFF` | `#182235` | Card/surface background |
| `--color-bg-subtle` | `#F8FAFC` | `#1E293B` | Subtle background |
| `--color-bg-muted` | `#F1F5F9` | `#263449` | Muted background |
| `--color-border` | `#E5E7EB` | `#334155` | Border |
| `--color-text-primary` | `#111827` | `#F8FAFC` | Primary text |
| `--color-text-secondary` | `#475569` | `#CBD5E1` | Secondary text |
| `--color-text-muted` | `#94A3B8` | `#94A3B8` | Muted text |
| `--color-primary` | `#6D5DFB` | `#8B7CFF` | Primary action |
| `--color-success` | `#16A34A` | `#4ADE80` | Success |
| `--color-error` | `#DC2626` | `#DC2626` | Error |

### 2.2 Typography

| Element | Font Size | Line Height | Weight | Color |
|---------|-----------|-------------|--------|-------|
| Page Title (H1) | 28px | 1.2 | 700 | `--color-text-primary` |
| Section Title (H2) | 20px | 1.25 | 700 | `--color-text-primary` |
| Card Title (H3) | 17px | 1.25 | 700 | `--color-text-primary` |
| Body Text | 14px | 1.5 | 400 | `--color-text-secondary` |
| Helper Text | 12px | 1.5 | 400 | `--color-text-muted` |
| Caption | 11px | 1.4 | 600 | `--color-text-muted` |
| Badge | 11px | — | 700 | Varies by status |

### 2.3 Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Tight padding, small gaps |
| `--space-sm` | 8px | Standard gaps, small padding |
| `--space-md` | 16px | Card padding, section gaps |
| `--space-lg` | 24px | Section padding, large gaps |
| `--space-xl` | 32px | Page padding, container gaps |
| `--space-2xl` | 44px | Page intro padding |
| `--space-3xl` | 64px | Page bottom padding |

### 2.4 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Input fields, small elements |
| `--radius-md` | 10px | Cards, modals |
| `--radius-lg` | 14px | Page cards |
| `--radius-xl` | 16px | App shell |
| `--radius-full` | 999px | Badges, circular buttons |

### 2.5 Shadows

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--shadow-xs` | `0 1px 2px rgba(15,23,42,0.04)` | `0 1px 2px rgba(0,0,0,0.20)` | Subtle elements |
| `--shadow-sm` | `0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)` | `0 2px 8px rgba(0,0,0,0.20)` | Cards, dropdowns |
| `--shadow-card` | `0 8px 24px rgba(15,23,42,0.05)` | `0 12px 32px rgba(0,0,0,0.18)` | Modal, elevated cards |

### 2.6 Breakpoints

| Name | Width | Usage |
|------|-------|-------|
| Mobile | ≤ 768px | Hide sidebar, stack forms |
| Tablet | 769px – 1200px | Sidebar visible, compact forms |
| Desktop | ≥ 1201px | Full layout |

---

## 3. Screen Designs

### 3.1 Project Setup Page (No Active Project)

**Route:** `#setup`

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar (fixed, 248px)                                             │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Header (72px, sticky)                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  TestForge | API Testing Platform                           │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  Main Content (scrollable)                                      │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  Page Intro                                                 │ │ │
│  │  │  "Project Setup"                                            │ │ │
│  │  │  "Create or select a project to start testing your APIs."   │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  Project Setup Card (surface, border, shadow)               │ │ │
│  │  │  ┌─────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  Card Intro Header                                      │ │ │ │
│  │  │  │  [📁] Choose your project                               │ │ │ │
│  │  │  │  "Projects organize your APIs, tests, dependencies..."  │ │ │ │
│  │  │  └─────────────────────────────────────────────────────────┘ │ │ │
│  │  │                                                             │ │ │
│  │  │  ┌─────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  Search Bar                                             │ │ │ │
│  │  │  │  [🔍 Search projects...]                                │ │ │ │
│  │  │  └─────────────────────────────────────────────────────────┘ │ │ │
│  │  │                                                             │ │ │
│  │  │  ┌─────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  Existing Projects                                      │ │ │ │
│  │  │  │  ┌─────────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  [📁] Default Project                               │ │ │ │ │
│  │  │  │  │  Project ID: default                                │ │ │ │ │
│  │  │  │  │  Updated: 2 hours ago                             │ │ │ │ │
│  │  │  │  └─────────────────────────────────────────────────────┘ │ │ │ │
│  │  │  │  ┌─────────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  [📁] Payments API                                  │ │ │ │ │
│  │  │  │  │  Project ID: payments-api                           │ │ │ │ │
│  │  │  │  │  Updated: 1 day ago                                 │ │ │ │ │
│  │  │  │  └─────────────────────────────────────────────────────┘ │ │ │ │
│  │  │  └─────────────────────────────────────────────────────────┘ │ │ │
│  │  │                                                             │ │ │
│  │  │  ─────────────────────────────────────────────────────────  │ │ │
│  │  │                                                             │ │ │
│  │  │  Create New Project                                         │ │ │
│  │  │  ┌─────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  [➕] Start a new workspace...                          │ │ │ │
│  │  │  │  ┌─────────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  Project ID *                                       │ │ │ │ │
│  │  │  │  │  [e.g. payments-api]                                │ │ │ │ │
│  │  │  │  └─────────────────────────────────────────────────────┘ │ │ │ │
│  │  │  │  ┌─────────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  Project Name (Optional)                            │ │ │ │ │
│  │  │  │  │  [e.g. Payments API]                                │ │ │ │ │
│  │  │  │  └─────────────────────────────────────────────────────┘ │ │ │ │
│  │  │  │  ┌─────────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  [ + Create Project ]                              │ │ │ │ │
│  │  │  │  └─────────────────────────────────────────────────────┘ │ │ │ │
│  │  │  └─────────────────────────────────────────────────────────┘ │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  Info Callout                                               │ │ │
│  │  │  [ⓘ] Everything stays organized                            │ │ │
│  │  │  "Your APIs, tests, dependencies, runs, and results..."     │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

#### Components

| Component | Description | States |
|-----------|-------------|--------|
| `PageIntro` | Title and description | Default |
| `ProjectSetupCard` | Container card for all project setup content | Default |
| `CardIntroHeader` | Icon, title, and description | Default |
| `SearchBar` | Search input with clear button | Empty, Typing, Focused, Disabled |
| `ExistingProjectsSection` | List of existing projects | Loading, Populated, Empty, Error |
| `ProjectListItem` | Individual project in the list | Default, Hover, Selected |
| `EmptyState` | Shown when no projects or no search results | No Projects, No Results |
| `Divider` | Visual separator | Default |
| `CreateProjectSection` | Form for creating a new project | Default, Loading, Error |
| `CreateProjectForm` | Form with ID and Name inputs | Default, Typing, Error |
| `FormField` | Label, input, helper text | Default, Focused, Error |
| `CreateButton` | Submit button | Default, Disabled, Loading |
| `InfoCallout` | Informational message | Default |

#### States

##### Loading State
- Search bar shows a loading spinner
- Project list shows skeleton placeholders
- Create button is disabled

##### Empty State (No Projects)
```
[📁] (icon)
No projects yet
Create your first project below to start testing APIs.
```

##### Empty State (Search No Results)
```
🔍 (icon)
No projects match your search
Try adjusting your search terms or [clear search].
```

##### Error State
```
⚠️ (icon)
Unable to load projects.
[Retry] button
```

##### Form Error State
- Red border on the input field
- Red error message below the field
- Input remains editable

#### Responsive Behavior

| Screen Size | Behavior |
|-------------|----------|
| Desktop (≥ 1201px) | Full-width card, form fields side by side |
| Tablet (769px – 1200px) | Slightly narrower card, form fields side by side |
| Mobile (≤ 768px) | Full-width card, form fields stacked vertically, sidebar hidden |

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate between form fields and buttons |
| `Enter` | Submit the create project form |
| `Ctrl/Cmd + K` | Focus the search input |
| `Escape` | Clear the search input |

#### Accessibility

- `PageIntro` has `aria-label="Project setup page introduction"`
- `SearchBar` input has `aria-label="Search projects"`
- `ProjectListItem` has `role="button"` and `aria-current="page"` when active
- `CreateProjectForm` fields have associated `<label>` elements
- `CreateButton` has `aria-busy="true"` when loading
- All icons have `aria-hidden="true"`
- Page has `<main>` landmark

#### Dark/Light Mode

All colors use CSS custom properties that change based on `[data-theme="light"]` or `[data-theme="dark"]`.

---

### 3.2 Project Dashboard (Active Project)

**Route:** `#workspace?project=payments-api`

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar (fixed, 248px)                                             │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Header (72px, sticky)                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  API TESTING | Test Workspace                               │ │ │
│  │  │  Project: Payments API       Theme: [Light/Dark]            │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  Main Content (scrollable)                                      │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │  Dashboard Header                                           │ │ │
│  │  │  ┌─────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  ← Back to Projects    [Edit] [Delete]                  │ │ │ │
│  │  │  │  Payments API                                              │ │ │ │
│  │  │  │  ID: payments-api                                         │ │ │ │
│  │  │  │  Created: Jan 15, 2025    Updated: 2 hours ago          │ │ │ │
│  │  │  └─────────────────────────────────────────────────────────┘ │ │ │
│  │  │                                                             │ │ │
│  │  │  ┌─────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  Project Status                                         │ │ │ │
│  │  │  │  [🔵 Not configured]                                      │ │ │ │
│  │  │  │  No APIs have been imported yet.                          │ │ │ │
│  │  │  │  Import your first API to get started.                    │ │ │ │
│  │  │  └─────────────────────────────────────────────────────────┘ │ │ │
│  │  │                                                             │ │ │
│  │  │  ┌─────────────────────────────────────────────────────────┐ │ │ │
│  │  │  │  Next Steps                                             │ │ │ │
│  │  │  │  ┌─────────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  [1] Import APIs                                    │ │ │ │ │
│  │  │  │  │  Upload an OpenAPI spec or Postman collection       │ │ │ │ │
│  │  │  │  └─────────────────────────────────────────────────────┘ │ │ │ │
│  │  │  │  ┌─────────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  [2] Analyze Dependencies                           │ │ │ │ │
│  │  │  │  │  Review AI-suggested API relationships              │ │ │ │ │
│  │  │  │  └─────────────────────────────────────────────────────┘ │ │ │ │
│  │  │  │  ┌─────────────────────────────────────────────────────┐ │ │ │ │
│  │  │  │  │  [3] Generate Test Cases                            │ │ │ │ │
│  │  │  │  │  Create test scenarios from your API contracts      │ │ │ │ │
│  │  │  │  └─────────────────────────────────────────────────────┘ │ │ │ │
│  │  │  └─────────────────────────────────────────────────────────┘ │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

#### Components

| Component | Description | States |
|-----------|-------------|--------|
| `DashboardHeader` | Project name, ID, dates, action buttons | Default, Loading |
| `ProjectTitle` | Large project name | Default |
| `ProjectMeta` | Project ID, created/updated dates | Default |
| `QuickActions` | Edit, Delete, Change Project buttons | Default |
| `ChangeProjectButton` | Returns to project list | Default, Hover |
| `EditProjectButton` | Opens edit modal | Default, Hover |
| `DeleteProjectButton` | Opens delete modal | Default, Hover, Disabled (default project) |
| `ProjectStatusSection` | Shows project status | Default, Loading |
| `StatusCard` | Status indicator card | Not Configured, Configured |
| `StatusIndicator` | Badge showing status | Not Configured, Configured |
| `NextStepsSection` | Guidance on what to do next | Default |
| `StepCard` | Individual next step | Default, Current, Completed |
| `CallToAction` | Action button for next step | Default |

#### States

##### Loading State
- Skeleton placeholders for all dashboard content
- Header shows gray bars
- Status card shows gray box
- Next steps show gray boxes

##### Loaded State
- All dashboard content is visible
- Status indicator shows "Not configured" (since no APIs)
- Next steps section shows 3 steps

##### Error State (Project Not Found)
- Redirect to setup page with error toast
- Error message: "The project you're looking for no longer exists."

##### Empty State (No APIs)
- Status indicator shows "Not configured" with blue background
- Message: "No APIs have been imported yet."
- Guidance: "Import your first API to get started."

#### Responsive Behavior

| Screen Size | Behavior |
|-------------|----------|
| Desktop (≥ 1201px) | Full-width dashboard, action buttons inline |
| Tablet (769px – 1200px) | Slightly narrower, action buttons compact |
| Mobile (≤ 768px) | Action buttons stack vertically, status card full-width |

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate between dashboard elements |
| `Enter` | Activate buttons |
| `Escape` | Close modals |
| `Backspace` | Go back to project list |

#### Accessibility

- `DashboardHeader` has `aria-label="Project dashboard header"`
- `ProjectTitle` is an `<h1>` element
- `QuickActions` buttons have `aria-label` attributes
- `StatusIndicator` has `aria-label="Project status: Not configured"`
- `NextStepsSection` has `aria-label="Next steps"`
- All buttons are keyboard-navigable
- All icons have `aria-hidden="true"`

#### Dark/Light Mode

All dashboard components use CSS custom properties for theming.

---

### 3.3 Create Project Dialog

**Trigger:** "Create Project" button on Project Setup Page

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Modal Overlay                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Modal Dialog (surface, border, shadow)                       │  │
│  │  ┌───────────────────────────────────────────────────────────┐ │  │
│  │  │  [✕] Close                                                 │ │  │
│  │  │  Create Project                                             │ │  │
│  │  │  "Enter a project ID and optional name to get started."     │ │  │
│  │  │                                                             │ │  │
│  │  │  ┌───────────────────────────────────────────────────────┐ │ │  │
│  │  │  │  Project ID *                                           │ │ │  │
│  │  │  │  [e.g. payments-api]                                    │ │ │  │
│  │  │  │  "Used as the unique project identifier."               │ │ │  │
│  │  │  └───────────────────────────────────────────────────────┘ │ │  │
│  │  │                                                             │ │  │
│  │  │  ┌───────────────────────────────────────────────────────┐ │ │  │
│  │  │  │  Project Name (Optional)                                │ │ │  │
│  │  │  │  [e.g. Payments API]                                    │ │ │  │
│  │  │  │  "A friendly display name for your team."               │ │ │  │
│  │  │  └───────────────────────────────────────────────────────┘ │ │  │
│  │  │                                                             │ │  │
│  │  │  [Cancel] [Create Project]                                  │ │  │
│  │  └───────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

#### Components

| Component | Description | States |
|-----------|-------------|--------|
| `Modal` | Overlay with dialog | Default, Closing |
| `ModalHeader` | Title and close button | Default |
| `ModalBody` | Form content | Default |
| `ModalFooter` | Action buttons | Default, Loading |
| `FormField` | Label, input, helper text | Default, Focused, Error |
| `ModalButton` | Cancel or Submit button | Default, Disabled, Loading |

#### States

##### Default
- Form is empty, Create button disabled
- Project ID input is focused (auto-focus)

##### Typing
- Real-time validation on Project ID
- Create button enabled when ID is valid
- Helper text updates based on validation

##### Loading
- Create button shows spinner
- All inputs disabled
- Modal cannot be closed

##### Error
- Red error message below the form
- Inputs remain editable
- Create button re-enabled

##### Success
- Modal closes
- User is navigated to project dashboard

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Submit the form (when ID is valid) |
| `Escape` | Close the modal (cancel) |
| `Tab` | Navigate between fields |
| `Shift + Tab` | Navigate backwards |

#### Accessibility

- Modal has `role="dialog"` and `aria-modal="true"`
- Modal has `aria-labelledby` pointing to the title
- Modal has `aria-describedby` pointing to the description
- Focus is trapped within the modal
- Initial focus is on the Project ID input
- Close button has `aria-label="Close"`
- Form fields have associated `<label>` elements

#### Dark/Light Mode

Modal background uses `var(--color-bg-surface)`, border uses `var(--color-border)`.

---

### 3.4 Edit Project Dialog

**Trigger:** "Edit Project" button on Project Dashboard

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Modal Overlay                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Modal Dialog                                                 │  │
│  │  ┌───────────────────────────────────────────────────────────┐ │  │
│  │  │  [✕] Close                                                 │ │  │
│  │  │  Edit Project                                               │ │  │
│  │  │  "Update your project name."                                │ │  │
│  │  │                                                             │ │  │
│  │  │  ┌───────────────────────────────────────────────────────┐ │ │  │
│  │  │  │  Project Name                                           │ │ │  │
│  │  │  │  [Payments API]                                         │ │ │  │
│  │  │  └───────────────────────────────────────────────────────┘ │ │  │
│  │  │                                                             │ │  │
│  │  │  [Cancel] [Save]                                            │ │  │
│  │  └───────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

#### Components

Same as Create Project Dialog, but with only the Project Name field.

#### States

##### Default
- Project Name input is pre-filled with current name
- Save button is disabled if input is empty
- Initial focus is on the Project Name input

##### Typing
- Save button enabled when input is non-empty
- Save button disabled when input is empty

##### Loading
- Save button shows spinner
- All inputs disabled

##### Error
- Red error message in modal
- Inputs remain editable

##### Success
- Modal closes
- Dashboard reflects new name

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Save the project |
| `Escape` | Cancel and close |
| `Tab` | Navigate between fields |

#### Accessibility

Same as Create Project Dialog.

---

### 3.5 Delete Project Confirmation Dialog

**Trigger:** "Delete Project" button on Project Dashboard

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Modal Overlay                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Modal Dialog                                                 │  │
│  │  ┌───────────────────────────────────────────────────────────┐ │  │
│  │  │  [✕] Close                                                 │ │  │
│  │  │  Delete Project                                             │ │  │
│  │  │  "This action cannot be undone."                            │ │  │
│  │  │                                                             │ │  │
│  │  │  ┌───────────────────────────────────────────────────────┐ │ │  │
│  │  │  │  Project Details                                        │ │ │  │
│  │  │  │  Name: Payments API                                     │ │ │  │
│  │  │  │  ID: payments-api                                       │ │ │  │
│  │  │  └───────────────────────────────────────────────────────┘ │ │  │
│  │  │                                                             │ │  │
│  │  │  ┌───────────────────────────────────────────────────────┐ │ │  │
│  │  │  │  Type the project ID to confirm deletion:               │ │ │  │
│  │  │  │  [payments-api]                                         │ │ │  │
│  │  │  └───────────────────────────────────────────────────────┘ │ │  │
│  │  │                                                             │ │  │
│  │  │  [Cancel] [Delete Project]                                  │ │  │
│  │  └───────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

#### Components

Same as Create Project Dialog, but with project details and ID confirmation input.

#### States

##### Default
- Project ID input is empty
- Delete button is disabled
- Initial focus is on the Project ID input

##### Typing
- Delete button enabled when input matches project ID exactly
- Delete button disabled when input doesn't match
- Visual feedback (green/red border) on input

##### Loading
- Delete button shows spinner
- All inputs disabled

##### Error
- Red error message in modal
- Inputs remain editable

##### Success
- User is redirected to project setup page

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Delete the project (when ID matches) |
| `Escape` | Cancel and close |
| `Tab` | Navigate between fields |

#### Accessibility

Same as Create Project Dialog, plus:
- Input has `aria-describedby` pointing to instructions
- Delete button has `aria-disabled` when ID doesn't match
- Project details have `aria-label` attributes

---

### 3.6 Project List (Search Results)

**Trigger:** User types in search bar

#### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Search Results                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  "No projects match your search"                              │  │
│  │  [Clear search]                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

#### States

##### No Results
- Message: "No projects match your search"
- Link: "Clear search" to reset

##### Results Found
- Filtered list of projects
- Each result is a `ProjectListItem`

#### Accessibility

- Results container has `aria-live="polite"` for dynamic updates
- Each result has `role="button"` and is keyboard-navigable

---

## 4. Interaction Patterns

### 4.1 Modal Dialogs

All modal dialogs follow the same pattern:

1. **Trigger:** User clicks a button
2. **Open:** Modal fades in, focus moves to first input
3. **Trap:** Tab key cycles within the modal
4. **Close:** Escape key, close button, or cancel button
5. **Submit:** Enter key or submit button
6. **Loading:** Spinner on submit button, inputs disabled
7. **Success:** Modal closes, state updates
8. **Error:** Error message displayed, inputs remain editable

### 4.2 Form Validation

1. **Real-time:** Validate as user types (debounced 300ms)
2. **On blur:** Validate when user leaves the field
3. **On submit:** Validate all fields before API call
4. **Error display:** Inline below the field, red border on input

### 4.3 Search

1. **Debounced:** 300ms delay before filtering
2. **Case-insensitive:** Matches regardless of case
3. **Multi-field:** Matches both ID and name
4. **Clear button:** Visible when there is text
5. **Empty state:** Shown when no results

### 4.4 Navigation

1. **Hash-based:** URL hash determines the view
2. **Project context:** Project ID in hash determines active project
3. **Back button:** Browser back button works
4. **Reload:** Page reload preserves state from hash

### 4.5 Loading States

1. **Skeleton:** Gray boxes for content that is loading
2. **Spinner:** Circular spinner for actions
3. **Disabled:** Buttons and inputs disabled during loading
4. **Overlay:** Modal overlay prevents interaction during loading

---

## 5. Animation and Transitions

### 5.1 Modal Entry/Exit

- **Duration:** 150ms ease-in-out
- **Effect:** Fade + slight scale (95% → 100%)
- **Overlay:** Fade in/out

### 5.2 Button Hover

- **Duration:** 150ms ease
- **Effect:** Background color change, slight transform (translateY(-1px))
- **Shadow:** Subtle shadow on hover

### 5.3 Form Field Focus

- **Duration:** 150ms ease
- **Effect:** Border color change, box-shadow glow

### 5.4 Search Filtering

- **Duration:** 150ms ease
- **Effect:** List items fade out/in as they are filtered

### 5.5 Theme Switch

- **Duration:** 150ms ease
- **Effect:** All colors transition smoothly

---

## 6. Error States

### 6.1 Form Validation Errors

```
[Input field with red border]
Error message in red text below the field
```

### 6.2 API Errors

```
[Red banner at top of form/modal]
Error message in red text
[Retry button if applicable]
```

### 6.3 Page Errors

```
[Full-page error with illustration]
Error message
[Retry button]
```

### 6.4 Network Errors

```
[Red banner]
"Unable to connect to the server. Please check your connection and try again."
[Retry button]
```

---

## 7. Empty States

### 7.1 No Projects

```
[📁 Icon]
No projects yet
Create your first project below to start testing APIs.
[Create Project button]
```

### 7.2 Search No Results

```
🔍 Icon
No projects match your search
Try adjusting your search terms or [clear search].
```

### 7.3 No APIs (Dashboard)

```
[🔵 Status badge]
Not configured
No APIs have been imported yet.
Import your first API to get started.
```

---

## 8. Accessibility Checklist

### 8.1 Screen Reader

- [ ] All pages have `<main>` landmark
- [ ] All pages have `<nav>` landmark for sidebar
- [ ] All pages have `<header>` landmark
- [ ] All form fields have `<label>` elements
- [ ] All buttons have accessible names
- [ ] All icons have `aria-hidden="true"`
- [ ] Modal dialogs have `role="dialog"` and `aria-modal="true"`
- [ ] Modal dialogs have `aria-labelledby` and `aria-describedby`
- [ ] Project list has `role="list"` and items have `role="listitem"`
- [ ] Status indicators use `aria-live`
- [ ] Error messages are associated with form fields via `aria-describedby`

### 8.2 Keyboard Navigation

- [ ] All interactive elements are reachable via Tab
- [ ] Tab order is logical (top to bottom, left to right)
- [ ] Enter key activates buttons and links
- [ ] Escape key closes modals
- [ ] Focus is trapped within modals
- [ ] Focus is visible on all interactive elements
- [ ] Initial focus is set in modals

### 8.3 Visual Accessibility

- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 for normal text)
- [ ] Color is not the sole means of conveying information
- [ ] Focus indicators are visible in both themes
- [ ] Font size is readable without zooming (minimum 14px)
- [ ] Touch targets are at least 44px × 44px

### 8.4 ARIA Attributes

- [ ] `aria-current="page"` on active navigation items
- [ ] `aria-pressed` on theme switcher buttons
- [ ] `aria-busy="true"` on loading buttons
- [ ] `aria-invalid="true"` on invalid form fields
- [ ] `aria-describedby` on form fields with errors
- [ ] `aria-label` on icon-only buttons

---

*End of UX Specification — Sprint 01: Project Foundation*
