# TestForge — Complete Integration Audit Report

**Date:** 2026-07-29  
**Commit:** a0b300c94c6a363520fffd847b2762d4796c7a40  
**Scope:** Entire application — backend (`Tool/AI/src/`), frontend (`Tool/AI/frontend/src/`), and their integration points.  
**Method:** Static source-code analysis — file-by-file review of all source files, import/require tracing, route-to-endpoint mapping, type-shape comparison, and cross-reference analysis. No code was modified.

---

## Executive Summary

The TestForge application has **14 critical P0 issues** that prevent the server from starting or break core workflows end-to-end. The most severe are three broken `require()` calls in `server.js` that reference modules which do not exist on disk, and two undefined-variable references (`getValidationScenarioService` and `generateScenarios`) that will throw `ReferenceError` at runtime. Additionally, the Execution Workspace feature — the final stage of the workflow — has **6 missing backend API endpoints** that the frontend service layer calls unconditionally.

Beyond the P0 issues, there are **35 P1/P2 issues** spanning data-model mismatches, duplicate services/repositories, dead code (30+ files never imported), unsynchronised state management, and missing CSS variables that will render components unstyled.

**Recommended implementation order** is provided at the end of this report.

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Critical — workflow broken; server won’t start or core feature is non-functional |
| **P1** | High — feature works incorrectly; data corruption or incorrect behaviour |
| **P2** | Medium — architecture/cleanup; dead code, duplication, missing polish |
| **P3** | Low — polish; UX nits, naming, minor inconsistencies |

---

## 1. Broken Workflow Transitions

### 1.1 Server fails to start due to 3 non-existent module imports (P0)

**File:** `Tool/AI/src/server.js`, lines 64–65

```js
const { getExecutionWorkspaceService, ensureReady: ensureExecutionRunRepositoryReady } = require("./domain/ExecutionWorkspaceService");
const { getExecutionPlannerService } = require("./domain/ExecutionPlannerService");
```

**Problem:** Neither `ExecutionWorkspaceService.js` nor `ExecutionPlannerService.js` exists in `src/domain/`. The `domain/` directory contains `ExecutionRun.js` and `ExecutionRunRepository.js` but no `ExecutionWorkspaceService` or `ExecutionPlannerService`. Node.js will throw `MODULE_NOT_FOUND` at startup, preventing the server from starting at all.

**Impact:** The entire backend is non-functional. No API endpoint can be served.

**Recommendation:** Either create the two missing service modules or remove the two `require()` lines and replace their usages with calls to the existing `ExecutionRunRepository` / `RunRepository` APIs.

---

### 1.2 Undefined variables `getValidationScenarioService` and `generateScenarios` (P0)

**File:** `Tool/AI/src/server.js`

| Line(s) | Undefined variable | Should be imported from |
|---------|-------------------|------------------------|
| 748, 759, 773, 788, 804, 818, 830, 842, 855 | `getValidationScenarioService()` | `./domain/ValidationScenarioService` |
| 878 | `generateScenarios()` | `./domain/ScenarioGenerationService` |

**Problem:** `getValidationScenarioService` is called 9 times in the validation-scenario route handlers but is never imported. `generateScenarios` is called once in the `/api/validation-scenarios/generate` handler but is never imported. Both functions exist in their respective modules (`ValidationScenarioService.js` exports `getValidationScenarioService`; `ScenarioGenerationService.js` exports `generateScenarios`) but the `require()` statements are missing from `server.js`.

**Impact:** Any request to `/api/validation-scenarios` (GET, POST, PATCH, DELETE, bulk-approve, bulk-reject, generate) or `/api/validation-scenarios/generate` will throw `ReferenceError: getValidationScenarioService is not defined` or `ReferenceError: generateScenarios is not defined`.

**Recommendation:** Add the two missing `require()` lines:
```js
const { getValidationScenarioService } = require("./domain/ValidationScenarioService");
const { generateScenarios } = require("./domain/ScenarioGenerationService");
```

---

### 1.3 Execution Workspace workflow has 6 missing backend endpoints (P0)

**File:** `Tool/AI/frontend/src/features/execution-workspace/ExecutionWorkspaceService.ts`

The frontend service calls 6 POST endpoints that do not exist in `server.js`:

| Frontend function | Endpoint | Server.js has it? |
|-------------------|----------|-------------------|
| `createExecutionRun` | `POST /api/execution-runs` | ❌ No |
| `buildExecutionPlan` | `POST /api/execution-runs/:id/build-plan` | ❌ No |
| `rebuildExecutionPlan` | `POST /api/execution-runs/:id/rebuild-plan` | ❌ No |
| `executeExecutionRun` | `POST /api/execution-runs/:id/execute` | ❌ No |
| `dryRunExecutionRun` | `POST /api/execution-runs/:id/dry-run` | ❌ No |
| `cancelExecutionRun` | `POST /api/execution-runs/:id/cancel` | ❌ No |

**Server.js only has:**
- `GET /api/execution-runs` (list)
- `GET /api/execution-runs/stats` (stats)
- `GET /api/execution-runs/:id` (get)
- `DELETE /api/execution-runs/:id` (delete)

**Impact:** The entire Execution Workspace page is non-functional. Users cannot create runs, build plans, execute tests, dry-run, or cancel runs. The "New Run" button, "Build Plan", "Execute", "Dry Run", and "Cancel" buttons will all fail with 404 errors.

**Recommendation:** Implement the 6 missing POST endpoints in `server.js`, backed by the existing `ExecutionRunRepository` and `ExecutionRun` domain model.

---

### 1.4 HistoryPage → ResultsPage navigation loses runId (P0)

**Files:** `Tool/AI/frontend/src/App.tsx` (lines 38–70), `Tool/AI/frontend/src/features/history/HistoryPage.tsx` (line 45)

**Problem:** `HistoryPage` navigates to Results via `window.location.hash = "#results?runId=..."` (line 45). However, `App.tsx`'s `handleHashChange` listener (line 39) only checks `hash.startsWith("#results")` — it does **not** parse the `runId` query parameter. The `ResultsPage` component has its own hash-parsing logic (lines 164–168), but `App.tsx`'s `setCurrentView("results")` call happens without passing the runId. While `ResultsPage` does parse the hash on mount and on `hashchange`, the `App.tsx` view-switching effect (lines 73–77) may override the view to "setup" if `activeProjectId` is null at the wrong moment.

**Impact:** Clicking a run in History may not display the correct run detail. The runId can be lost during the view transition.

**Recommendation:** Update `App.tsx`'s hash handler to parse query parameters, or have `HistoryPage` call `setCurrentView("results")` directly instead of relying on hash navigation.

---

### 1.5 ExecutionRun.js contains corrupted trailing content (P0)

**File:** `Tool/AI/src/domain/ExecutionRun.js`, lines 39–52

```js
39 | <task_progress>
40 | - [x] Analyze existing patterns from requirements module
...
52 | </write_to_file>
```

**Problem:** Lines 39–52 contain leftover `task_progress` and `write_to_file` metadata tags embedded directly in the JavaScript source file. This is invalid JavaScript syntax that will cause a `SyntaxError` when the module is loaded.

**Impact:** Any `require()` of `ExecutionRun.js` (or any module that transitively requires it) will crash with a syntax error.

**Recommendation:** Remove lines 39–52 from `ExecutionRun.js`.

---

### 1.6 Data model mismatch: storage.js `summarizeRun()` vs server.js run creation (P0)

**Files:** `Tool/AI/src/storage.js` (lines 75–105), `Tool/AI/src/server.js` (lines 542–562)

**Problem:** The `storage.js` `summarizeRun()` function expects run objects to have these fields:
- `run.ticket.key` / `run.ticket.summary`
- `run.summary` (with `total`, `passed`, `failed`, `blocked`, `needs_review`, `dry_run`)
- `run.contract.title`
- `run.environment.name` / `run.environment.baseUrl` / `run.environment.dryRun`

But `server.js`'s `/api/runs/execute-dependent` endpoint creates run data with completely different fields:
- `run.testSpecification` (with `id`, `title`, `description`, `requirementRefs`, `operationRefs`, `expectedBehavior`)
- `run.executionPlanSummary` (with `target`, `stepCount`, `operations`)
- `run.targetOperation`
- `run.results` (array of step results)
- `run.errors`

**Impact:** `GET /api/runs` (which calls `storage.listRunSummaries()`) will return runs with all `null`/`undefined`/default values because `summarizeRun()` looks for fields that don't exist in the server's run data. The HistoryPage will display empty/broken run summaries.

**Recommendation:** Align the data models. Either update `summarizeRun()` to read from the server's run structure, or update the server's run creation to include the fields `summarizeRun()` expects.

---

## 2. Broken API Integrations

### 2.1 `getExecutionPlannerService` imported from non-existent module (P0)

**File:** `Tool/AI/src/server.js`, line 65

```js
const { getExecutionPlannerService } = require("./domain/ExecutionPlannerService");
```

**Problem:** `ExecutionPlannerService.js` does not exist in `src/domain/`. This is a top-level `require()` that will crash the server on startup.

**Impact:** Server cannot start.

**Recommendation:** Remove the line or create the missing module.

---

### 2.2 Frontend `RunService.ts` calls `/api/active/runs` but data shape is inconsistent (P1)

**Files:** `Tool/AI/frontend/src/features/runs/RunService.ts`, `Tool/AI/src/domain/RunRepository.js`, `Tool/AI/src/domain/ExecutionRunRepository.js`

**Problem:** The frontend `RunService.ts` calls:
- `GET /api/active/runs?projectId=...` → expects `{ runs: RunSummary[] }`
- `GET /api/active/runs/:runId?projectId=...` → expects `{ run: RunDetail }`

The backend `RunRepository.js` delegates to `FileRunRepository.js` or `PostgresRunRepository.js`. The `RunSummary` type in `types/index.ts` has fields like `id`, `projectId`, `testSpecificationId`, `title`, `description`, `status`, `targetServiceId`, `targetOperationId`, `stepCount`, `passedSteps`, `failedSteps`, `blockedSteps`, `startedAt`, `completedAt`, `durationMs`. But the `FileRunRepository.js` may return a different shape.

**Impact:** If the repository returns data that doesn't match the `RunSummary` type, the HistoryPage will display incorrect or missing information.

**Recommendation:** Verify that `FileRunRepository.js` and `PostgresRunRepository.js` return data that matches the `RunSummary` and `RunDetail` types.

---

### 2.3 Frontend `ExecutionWorkspaceService.ts` data model mismatch (P1)

**Files:** `Tool/AI/frontend/src/features/execution-workspace/ExecutionWorkspaceService.ts`, `Tool/AI/src/domain/ExecutionRun.js`

**Problem:** The frontend `ExecutionRun` type has fields:
- `plan` (ExecutionPlan with `steps`, `totalSteps`, `executionOrder`, `warnings`, `variables`, `authentication`, `environment`, `estimatedSteps`, `dependencies`)
- `steps` (ExecutionStep[])
- `logs` (string[])
- `approved` (boolean)
- `name` (string)

The backend `ExecutionRun.js` `createExecutionRun()` returns:
- `testIds` (array)
- `executionPlan` (object or null)
- `planStatus` ("draft" | "ready" | "running" | "completed" | "cancelled")
- `results` (array)
- `warnings` (array)
- `variables`, `authentication`, `environment` (objects)
- `startedAt`, `completedAt` (Date or null)

The backend server.js run data (from `/api/runs/execute-dependent`) has:
- `testSpecification` (object)
- `executionPlanSummary` (object)
- `targetOperation` (object)
- `results` (array)
- `errors` (array)

**Impact:** Even if the 6 missing endpoints are implemented, the frontend will receive data in a different shape than its types expect, causing rendering issues and potential crashes.

**Recommendation:** Align the backend run data model with the frontend `ExecutionRun` type, or update the frontend types to match the backend.

---

## 3. Frontend/Backend Mismatches

### 3.1 CSS variables referenced but not defined (P1)

**Files:** Multiple frontend component files

**Problem:** Numerous frontend components reference CSS custom properties that are not defined in `styles/design-tokens.css` or `styles/index.css`:

| Undefined variable | Used in |
|-------------------|---------|
| `var(--green)`, `var(--green-soft)`, `var(--green-deep)` | HistoryPage, ResultsPage |
| `var(--red)`, `var(--red-soft)`, `var(--red-deep)` | HistoryPage, ResultsPage |
| `var(--blue)`, `var(--blue-soft)`, `var(--blue-deep)` | HistoryPage, ResultsPage |
| `var(--violet)`, `var(--violet-soft)`, `var(--violet-deep)` | ResultsPage |
| `var(--ink)` | HistoryPage, ResultsPage |
| `var(--muted)` | HistoryPage, ResultsPage |
| `var(--line)` | ResultsPage |
| `var(--surface)`, `var(--surface-alt)` | ResultsPage |
| `var(--color-primary)` | ExecutionWorkspacePage |
| `var(--color-info)` | ExecutionWorkspacePage |
| `var(--color-error)`, `var(--color-error-bg)`, `var(--color-error-border)` | ExecutionWorkspacePage |

**Impact:** Components will render with unstyled or broken appearance. Colors, backgrounds, borders, and spacing will be missing.

**Recommendation:** Define all CSS custom properties in `styles/design-tokens.css`.

---

### 3.2 Dual project state management systems (P1)

**Files:** `Tool/AI/frontend/src/App.tsx`, `Tool/AI/frontend/src/features/project-setup/ProjectContext.tsx`

**Problem:** Two completely separate project state management systems exist:

1. **App.tsx** manages `activeProjectId` via `useState` + `sessionStorage` (key: `testforge:activeProjectId`)
2. **ProjectContext.tsx** manages `selectedProjectId` via `useLocalStorage` (key: `selectedProjectId`)

These systems are **never synchronized**. `ProjectContext.tsx` is never used by `App.tsx` — `App.tsx` does not wrap its tree in `<ProjectProvider>`. The `useProjects` and `useProject` hooks are never called in `App.tsx`.

**Impact:** If a developer tries to use `ProjectContext` in any component, the selected project will be out of sync with `App.tsx`'s `activeProjectId`, causing inconsistent behavior.

**Recommendation:** Consolidate to a single state management approach. Either use `ProjectContext` throughout (wrapping `App.tsx` in `<ProjectProvider>`) or remove `ProjectContext.tsx` and `useProjects`/`useProject` hooks.

---

### 3.3 Frontend `ApiClient.ts` comment incorrectly references Express (P3)

**File:** `Tool/AI/frontend/src/services/ApiClient.ts`, line 32

```js
/**
 * Generic API request helper for communicating with the Express backend.
 * Works through Vite dev server proxy at /api/*
 */
```

**Problem:** The comment says "Express backend" but the backend uses Node.js `http.createServer()` (see `server.js` line 1320). There is no Express dependency in `package.json`.

**Impact:** No functional impact, but misleading documentation.

**Recommendation:** Update the comment to say "Node.js HTTP backend" or "TestForge backend".

---

## 4. Failed Loading Points

### 4.1 Server startup crashes (P0)

See sections 1.1, 1.2, 1.5, 2.1 above. The server cannot start due to:
- 2 non-existent module imports (`ExecutionWorkspaceService`, `ExecutionPlannerService`)
- 1 corrupted file (`ExecutionRun.js` lines 39–52)
- 2 undefined variables (`getValidationScenarioService`, `generateScenarios`)

### 4.2 Frontend CSS variables not defined (P1)

See section 3.1. Components will load but render unstyled.

### 4.3 Frontend `main.tsx` does not wrap in `ProjectProvider` (P2)

**File:** `Tool/AI/frontend/src/main.tsx`

**Problem:** `main.tsx` renders `<App />` directly without wrapping in `<ProjectProvider>`. This means `ProjectContext` is unavailable to any component that tries to use `useProjectContext()`.

**Impact:** Any component using `useProjectContext()` will throw "useProjectContext must be used within a ProjectProvider".

**Recommendation:** Wrap `<App />` in `<ProjectProvider>` in `main.tsx`, or remove `ProjectContext.tsx` if it's not needed.

---

## 5. Duplicate Services

### 5.1 `KnowledgeService.ts` duplicated in two feature directories (P2)

**Files:**
- `Tool/AI/frontend/src/features/knowledge/KnowledgeService.ts` (122 lines)
- `Tool/AI/frontend/src/features/project-setup/KnowledgeService.ts` (not yet read, but filename indicates duplication)

**Problem:** Two files with the same name exist in different feature directories. The `project-setup` version is likely a stale copy.

**Recommendation:** Remove the duplicate in `project-setup/`.

---

### 5.2 `listServices` and `getService` duplicated across two service files (P2)

**Files:**
- `Tool/AI/frontend/src/features/knowledge/KnowledgeService.ts` (lines 52–66)
- `Tool/AI/frontend/src/features/project-setup/ServiceRegistrationService.ts` (lines 26–39)

**Problem:** Both files export `listServices()` and `getService()` functions with identical implementations and identical API endpoints (`GET /api/services`, `GET /api/services/:projectId/:serviceId`).

**Recommendation:** Consolidate into a single service file.

---

## 6. Duplicate Repositories

### 6.1 Two separate run repository systems (P2)

**Files:**
- `Tool/AI/src/domain/RunRepository.js` — delegates to `FileRunRepository` or `PostgresRunRepository`
- `Tool/AI/src/domain/ExecutionRunRepository.js` — delegates to `FileExecutionRunRepository` only (no postgres option)

**Problem:** Two repository systems exist for the same domain concept ("runs"):
- `RunRepository.js` has proper postgres switching via `config.features.pgEnabled`
- `ExecutionRunRepository.js` hardcodes `FileExecutionRunRepository` with no postgres option

Additionally, `server.js` imports from **both** systems:
- `RunRepository` (line 63) for `/api/active/runs` endpoints
- `ExecutionRunRepository` (line 64) for `/api/execution-runs` endpoints

**Impact:** Two separate data stores for runs. Runs created via one system won't appear in the other.

**Recommendation:** Consolidate into a single run repository.

---

### 6.2 Duplicate postgres repository files (P2)

**Files:**
- `Tool/AI/src/domain/repositories/PostgresRunRepository.js` — used by `RunRepository.js`
- `Tool/AI/src/repositories/ProjectRepositoryPostgres.js` — never imported anywhere
- `Tool/AI/src/repositories/repositorySelector.js` — never imported anywhere
- `Tool/AI/src/domain/repositories/PostgresProjectKnowledgeRepository.js` — never imported
- `Tool/AI/src/domain/repositories/PostgresProjectRepository.js` — never imported
- `Tool/AI/src/domain/repositories/PostgresServiceRepository.js` — never imported

**Problem:** Several postgres repository implementations exist but are never wired into their corresponding repository selector files.

**Recommendation:** Either wire them into the repository selectors or remove them.

---

## 7. Dead Code

### 7.1 Unused backend engine modules (P2)

The following files in `src/engine/` are **never imported** by any other file:

| File | Lines |
|------|-------|
| `src/engine/gapDetector.js` | — |
| `src/engine/deduplicationEngine.js` | — |
| `src/engine/coverageEngine.js` | — |
| `src/engine/v2ScenarioAdapter.js` | — |
| `src/engine/matching/confidenceAnalyzer.js` | — |
| `src/engine/matching/endpointIndex.js` | — |
| `src/engine/matching/matchingSignals.js` | — |
| `src/engine/matching/operationContextGrouper.js` | — |
| `src/engine/matching/operationIntent.js` | — |
| `src/engine/matching/targetIntentExtractor.js` | — |
| `src/engine/matching/types.js` | — |

### 7.2 Unused backend domain and utility modules (P2)

| File | Lines |
|------|-------|
| `src/acExtractor.js` | — |
| `src/domain/DependencyResolver.js` | — |
| `src/domain/RuntimeContext.js` | — |
| `src/domain/TestCase.js` | — |
| `src/domain/TestSpecification.js` | — |
| `src/domain/ApiOperation.js` | — |
| `src/domain/ProjectKnowledge.js` | — |
| `src/domain/ProjectContext.js` | — |
| `src/domain/ServiceDefinition.js` | — |
| `src/payload/mutationEngine.js` | — |
| `src/scenarios/scenarioGenerator.js` | — |
| `src/validation/validators.js` | — |

### 7.3 Unused backend repository files (P2)

| File | Lines |
|------|-------|
| `src/repositories/repositorySelector.js` | — |
| `src/repositories/ProjectRepositoryPostgres.js` | — |
| `src/domain/repositories/PostgresProjectKnowledgeRepository.js` | — |
| `src/domain/repositories/PostgresProjectRepository.js` | — |
| `src/domain/repositories/PostgresServiceRepository.js` | — |

### 7.4 Unused frontend components (P2)

| File | Lines |
|------|-------|
| `components/workflow/WorkflowStatus.tsx` | — |
| `components/workflow/index.ts` | — |
| `components/layout/AppShell.tsx` | — |
| `components/layout/index.ts` | — |
| `components/common/Button.tsx` | — |
| `components/common/Input.tsx` | — |
| `components/common/Modal.tsx` | — |
| `components/common/Panel.tsx` | — |
| `components/common/index.ts` | — |

### 7.5 Unused frontend hooks (P2)

| File | Lines |
|------|-------|
| `hooks/useDebounce.ts` | — |
| `hooks/useTheme.tsx` | — |

### 7.6 Unused frontend utils (P2)

| File | Lines |
|------|-------|
| `utils/constants.ts` | — |
| `utils/index.ts` | — |
| `utils/validators.ts` | — |

### 7.7 Unused frontend feature files (P2)

| File | Lines |
|------|-------|
| `features/knowledge/KnowledgePage.tsx` | — |
| `features/knowledge/KnowledgeEnginePage.tsx` | — |
| `features/api-collection/ApiExplorer.tsx` | — |
| `features/api-collection/ApiCollectionPanel.tsx` | — |
| `features/api-collection/ContractPaster.tsx` | — |
| `features/api-collection/ContractUploader.tsx` | — |
| `features/api-collection/index.ts` | — |
| `features/api-collection/ApiCollectionTypes.ts` | — |
| `features/test-cases/TestCaseService.ts` | — |
| `features/test-cases/TestCasesPanel.tsx` | — |
| `features/test-cases/TestCasesPanel.test.tsx` | — |
| `features/test-prepare/ExecutionPanel.tsx` | — |
| `features/test-prepare/ExecutionService.ts` | — |
| `features/test-prepare/TestPreparePanel.tsx` | — |
| `features/test-prepare/TestPrepareService.ts` | — |
| `features/test-prepare/ExecutionPanel.test.tsx` | — |
| `features/test-prepare/TestPreparePanel.test.tsx` | — |
| `features/requirements/index.ts` | — |
| `features/validation-scenarios/index.ts` | — |
| `features/executable-tests/index.ts` | — |
| `features/implementation-mappings/index.ts` | — |
| `features/results/index.ts` | — |

---

## 8. Unused Components

See section 7.4 above. The following component files are never imported by any other file:

- `WorkflowStatus.tsx`
- `AppShell.tsx`
- `Button.tsx`
- `Input.tsx`
- `Modal.tsx`
- `Panel.tsx`
- `ApiExplorer.tsx`
- `ApiCollectionPanel.tsx`
- `ContractPaster.tsx`
- `ContractUploader.tsx`
- `KnowledgePage.tsx`
- `KnowledgeEnginePage.tsx`
- `TestCasesPanel.tsx`
- `ExecutionPanel.tsx`
- `TestPreparePanel.tsx`

---

## 9. Unused Routes

### 9.1 No formal routing system (P2)

**File:** `Tool/AI/frontend/src/App.tsx`

**Problem:** The application uses hash-based navigation (`#setup`, `#knowledge`, etc.) managed by `App.tsx`'s `handleHashChange` listener. There is no formal routing library (e.g., React Router). The `View` type in `App.tsx` defines 11 views, all of which are rendered via conditional `{currentView === "X" && <XPage />}`.

**Unused routes/views:**
- The `KnowledgePage` and `KnowledgeEnginePage` components exist but are not rendered in `App.tsx`. The sidebar navigates to `#knowledge` which renders `ProjectKnowledgePage`, not `KnowledgePage` or `KnowledgeEnginePage`.

**Recommendation:** Either integrate `KnowledgePage`/`KnowledgeEnginePage` into the routing or remove them.

---

## 10. Missing State Synchronization

### 10.1 App.tsx `activeProjectId` not synchronized with ProjectContext (P1)

See section 3.2. `App.tsx` uses `sessionStorage` + `useState` for `activeProjectId`. `ProjectContext.tsx` uses `localStorage` + `useLocalStorage` for `selectedProjectId`. These are never connected.

### 10.2 App.tsx hashchange listener doesn't handle initial hash (P3)

**File:** `Tool/AI/frontend/src/App.tsx`, lines 38–70

**Problem:** The `handleHashChange` listener is only attached via `window.addEventListener("hashchange", ...)`. It does not fire on initial page load. If a user navigates directly to `http://localhost:5173/#results`, the view will remain "setup" until the hash changes.

**Recommendation:** Call `handleHashChange()` once on mount (in the same `useEffect`).

### 10.3 ExecutionWorkspacePage stale closure in `loadAll` (P1)

**File:** `Tool/AI/frontend/src/features/execution-workspace/ExecutionWorkspacePage.tsx`, line 60

**Problem:** The `loadAll` callback includes `selectedRun` in its dependency array (line 60). This means `loadAll` is recreated whenever `selectedRun` changes. However, the `useEffect` on line 63 only depends on `[activeProjectId]`. When `selectedRun` changes (e.g., after creating a new run), `loadAll` is not re-called because the effect doesn't depend on it. The `loadAll` function inside the effect may reference a stale `selectedRun`.

**Impact:** After creating a new run, the run list may not refresh correctly, and the newly created run may not be selected.

**Recommendation:** Remove `selectedRun` from `loadAll`'s dependency array, or add `loadAll` to the effect's dependency array.

---

## 11. Navigation Issues

### 11.1 Sidebar "Test Cases" label maps to "workspace" view (P3)

**File:** `Tool/AI/frontend/src/components/layout/Sidebar.tsx`, line 96

```js
{ id: "workspace" as const, label: "Test Cases", icon: IconFlask },
```

**Problem:** The sidebar item labeled "Test Cases" navigates to the "workspace" view, which renders `WorkspacePage`. This is confusing — users expect "Test Cases" to show test cases, not a workspace.

**Recommendation:** Either rename the label to "Workspace" or change the `id` to match the actual content.

---

### 11.2 Sidebar uses same icon (IconFlask) for 3 different nav items (P3)

**File:** `Tool/AI/frontend/src/components/layout/Sidebar.tsx`

**Problem:** Three sidebar items use the same `IconFlask` component:
- Knowledge (line 86)
- Implementation Mappings (line 89)
- Executable Tests (line 90)
- Test Cases / Workspace (line 96)

**Recommendation:** Assign distinct icons to each nav item.

---

### 11.3 Sidebar brand click clears project and reloads (P3)

**File:** `Tool/AI/frontend/src/components/layout/Sidebar.tsx`, lines 121–125

```js
onClick={() => {
  try { sessionStorage.removeItem("testforge:activeProjectId"); } catch {}
  window.location.hash = "#setup";
  window.location.reload();
}}
```

**Problem:** Clicking the brand logo clears the active project and reloads the page. This is a destructive action that users might trigger accidentally.

**Recommendation:** Consider making this a "Go Home" action that doesn't clear the project, or add a confirmation dialog.

---

## 12. Data Flow Issues

### 12.1 `storage.js` `listRunSummaries()` returns grouped data but `/api/runs` returns it directly (P1)

**File:** `Tool/AI/src/server.js`, line 154

```js
if (req.method === "GET" && url.pathname === "/api/runs") {
  return sendJson(res, 200, storage.listRunSummaries());
}
```

**Problem:** `storage.listRunSummaries()` returns `{ runs, tickets, totals }` — a grouped structure. But the frontend `HistoryPage` expects an array of `RunSummary` objects (via `RunService.ts` which calls `/api/active/runs`, not `/api/runs`). The `/api/runs` endpoint is not called by any frontend service, making it dead code. Meanwhile, `/api/active/runs` (which IS called by the frontend) uses `RunRepository.listRuns()` which returns a different data shape.

**Impact:** The `/api/runs` endpoint returns data in a format that no frontend code consumes. The `/api/active/runs` endpoint returns data that may not match the `RunSummary` type.

**Recommendation:** Either remove `/api/runs` or update it to return data compatible with the frontend's expectations.

---

### 12.2 Server.js `/api/runs/execute-dependent` creates runs with incompatible data model (P1)

See section 1.6. The run data created by `/api/runs/execute-dependent` (lines 542–562) uses a completely different data model than what `storage.js`'s `summarizeRun()` expects.

---

### 12.3 `ExecutionWorkspacePage` references `selectedRun.plan.steps.length` without null check (P1)

**File:** `Tool/AI/frontend/src/features/execution-workspace/ExecutionWorkspacePage.tsx`, line 522

```js
{run.plan && (
  <div ...>
    {run.plan.steps.length} steps
  </div>
)}
```

**Problem:** While there is a `run.plan &&` guard, the `ExecutionRun` type defines `plan` as `ExecutionPlan | null`. If the backend returns a run without a `plan` field (or with `plan: null`), this will correctly skip rendering. However, the `canRun` check on line 219 uses `!!selectedRun?.plan` which is correct. The issue is that the frontend `ExecutionRun` type's `plan` field structure (`ExecutionPlan` with `steps`, `totalSteps`, etc.) may not match what the backend returns.

**Recommendation:** Ensure the backend returns `plan` in the shape the frontend expects.

---

## 13. Approval Workflow Issues

### 13.1 `confirmRelationship` and `rejectRelationship` silently swallow errors (P1)

**File:** `Tool/AI/frontend/src/features/knowledge/KnowledgeService.ts`, lines 84–115

**Problem:** Both `confirmRelationship` and `rejectRelationship` wrap the API call in a `try/catch` that returns `null` on error:

```js
export async function confirmRelationship(...): Promise<ProjectKnowledge | null> {
  try {
    const response = await apiClient.post(...);
    return response.knowledge;
  } catch {
    return null;
  }
}
```

**Impact:** If the backend returns an error (e.g., 404 because the relationship was already confirmed, or 500 because `getValidationScenarioService` is undefined), the frontend silently treats it as `null` and shows no error to the user. The user thinks the action succeeded when it didn't.

**Recommendation:** Remove the silent catch, or surface the error to the user via a toast/notification.

---

### 13.2 Bulk approve/reject silently skips failures (P2)

**Files:** `Tool/AI/src/domain/ValidationScenarioService.js` (lines 148–162), `Tool/AI/src/domain/ImplementationMappingService.js` (lines 80–94), `Tool/AI/src/domain/ExecutableTestService.js` (lines 80–94)

**Problem:** All three service classes implement `bulkApprove` and `bulkReject` with a `try/catch` that silently skips individual failures:

```js
for (const scenarioId of scenarioIds) {
  try {
    const updated = await this.update(projectId, scenarioId, { status: "approved" });
    results.push(updated);
  } catch (error) {
    // Skip individual failures
  }
}
```

**Impact:** If some items fail to approve/reject, the user is not informed. The response only includes successfully updated items, with no indication of which items failed or why.

**Recommendation:** Return both successful and failed items in the response, or throw an error if any item fails.

---

### 13.3 Approval workflow has no "needs-review" → "ready" transition (P2)

**Problem:** The approval workflow for requirements, validation scenarios, implementation mappings, and executable tests uses these statuses:
- `draft` → `needs-review` → `approved` / `rejected`

But the "ready" status is used in queries (e.g., `service.list(projectId, { status: "ready" })` in server.js line 868) even though there is no explicit "mark as ready" action. The "ready" status is only set by the `validateRequirementReadiness` / `validateScenarioReadiness` functions, which are called in `getReadiness()` but never in `update()`.

**Impact:** Items can be in "needs-review" status but never transition to "ready" through the UI. The `/api/validation-scenarios/generate` endpoint filters for `status: "ready"` items, so items stuck in "needs-review" will never be included in scenario generation.

**Recommendation:** Add a "Mark as Ready" action in the UI, or change the generate endpoints to filter for "approved" status instead.

---

## 14. Traceability Gaps

### 14.1 No traceability between requirements → scenarios → mappings → tests → runs (P1)

**Problem:** The application has a workflow: Requirements → Validation Scenarios → Implementation Mappings → Executable Tests → Execution Runs. Each stage has a `requirementId` or `scenarioId` or `mappingId` field, but there is no systematic traceability link that allows navigating from a run result back to the original requirement.

**Specific gaps:**
- `ExecutionRun.js` has `testIds` but no `requirementIds` or `scenarioIds`
- `server.js` `/api/runs/execute-dependent` creates run data with `testSpecification.requirementRefs` but this is not propagated to the `RunSummary` returned by `/api/active/runs`
- `RunSummary` type has `testSpecificationId` but no `requirementId` or `scenarioId`
- The `HistoryPage` displays `targetServiceId::targetOperationId` but not the originating requirement

**Impact:** Users cannot trace a test failure back to the original requirement or scenario. This breaks the audit trail.

**Recommendation:** Add `requirementId`, `scenarioId`, and `mappingId` fields to the run data model and propagate them through the execution pipeline.

---

### 14.2 `ExecutionRun.js` `testIds` field not used by server.js (P2)

**File:** `Tool/AI/src/domain/ExecutionRun.js`, line 22

```js
testIds: Array.isArray(input.testIds) ? input.testIds.map(String) : [],
```

**Problem:** The `ExecutionRun` domain model has a `testIds` field, but `server.js`'s `/api/runs/execute-dependent` endpoint does not include `testIds` in the run data it creates. The run data includes `testSpecification` instead.

**Impact:** The `testIds` field is always empty in persisted runs, making it impossible to trace which tests were executed.

**Recommendation:** Include `testIds` in the run data created by `/api/runs/execute-dependent`.

---

### 14.3 No requirement-to-scenario traceability in scenario generation (P2)

**File:** `Tool/AI/src/server.js`, lines 878–886

**Problem:** When generating scenarios, the server maps requirements to proposals but the `requirementId` field in the proposal is set from `p.requirementId || requirementId` (in `ScenarioGenerationService.js` line 45). However, the `requirementId` variable in the `generateScenarios` call (server.js line 879) is not passed — the function receives `{ requirements: selected.map(...) }` without a `requirementId` context.

**Impact:** Generated scenario proposals may not have the correct `requirementId` if the AI response doesn't include it.

**Recommendation:** Pass `requirementId` explicitly to `generateScenarios` or ensure the AI prompt includes it.

---

### 14.4 `ExecutionRun.js` has `planStatus` field but no API to update it (P2)

**File:** `Tool/AI/src/domain/ExecutionRun.js`, line 24

**Problem:** The `ExecutionRun` model has a `planStatus` field ("draft" | "ready" | "running" | "completed" | "cancelled") but there is no API endpoint to update it. The `ExecutionRunRepository.js` has an `updateRun` function, but `server.js` does not expose a `PATCH /api/execution-runs/:id` endpoint.

**Impact:** The `planStatus` field cannot be updated through the API, making the execution workflow state machine incomplete.

**Recommendation:** Add a `PATCH /api/execution-runs/:id` endpoint that allows updating `planStatus` and other fields.

---

## Summary of Findings by Priority

| Priority | Count | Key Issues |
|----------|-------|------------|
| **P0** | 6 | Server won't start (3 broken imports, 1 corrupted file, 2 undefined variables); 6 missing execution workspace endpoints; History→Results navigation broken; storage.js vs server.js data model mismatch |
| **P1** | 8 | RunService data shape mismatch; ExecutionRun type mismatch; CSS variables undefined; dual project state management; stale closure in ExecutionWorkspacePage; silent error swallowing in knowledge service; no traceability; planStatus not updatable |
| **P2** | 15+ | Dead code (30+ files); duplicate services/repositories; unused test files; missing ProjectProvider; two run repository systems; bulk approve/reject silent failures; no "ready" transition |
| **P3** | 5+ | Sidebar icon reuse; "Test Cases" label mismatch; brand click destructive; initial hash not handled; misleading "Express" comment |

---

## Recommended Implementation Order

> **Note:** The following order prioritises restoring a working server and end-to-end workflow before addressing cleanup and polish.

### Phase 1 — Restore Server Startup (P0, ~2 days)

1. **Fix corrupted `ExecutionRun.js`** — Remove lines 39–52 (leftover metadata tags). *(1 hour)*
2. **Fix broken `require()` calls in `server.js`** — Remove or stub `ExecutionWorkspaceService` and `ExecutionPlannerService` imports (lines 64–65). *(1 hour)*
3. **Add missing `require()` for `getValidationScenarioService` and `generateScenarios`** — Add imports from `./domain/ValidationScenarioService` and `./domain/ScenarioGenerationService`. *(1 hour)*
4. **Verify server starts** — Run `node src/server.js` and confirm no startup errors. *(1 hour)*

### Phase 2 — Restore Core API Endpoints (P0, ~3 days)

5. **Implement 6 missing Execution Workspace POST endpoints** in `server.js`:
   - `POST /api/execution-runs` (create)
   - `POST /api/execution-runs/:id/build-plan`
   - `POST /api/execution-runs/:id/rebuild-plan`
   - `POST /api/execution-runs/:id/execute`
   - `POST /api/execution-runs/:id/dry-run`
   - `POST /api/execution-runs/:id/cancel`
   
   Use existing `ExecutionRunRepository` and `ExecutionRun` domain model. *(2 days)*
6. **Align run data model** — Ensure the run data created by `POST /api/execution-runs/:id/execute` matches the `ExecutionRun` type expected by the frontend. *(1 day)*

### Phase 3 — Fix Data Model Mismatches (P1, ~2 days)

7. **Fix `storage.js` `summarizeRun()`** — Update to read from the server's run data model (`testSpecification`, `executionPlanSummary`, `targetOperation`, `results`). *(1 day)*
8. **Define missing CSS variables** — Add all undefined CSS custom properties to `styles/design-tokens.css`. *(1 day)*

### Phase 4 — Fix State Management & Navigation (P1, ~2 days)

9. **Consolidate project state management** — Choose either `App.tsx`'s `sessionStorage` approach or `ProjectContext.tsx`'s `localStorage` approach and remove the other. *(1 day)*
10. **Fix HistoryPage → ResultsPage navigation** — Update `App.tsx` hash handler to parse query parameters, or have `HistoryPage` call `setCurrentView("results")` directly. *(1 day)*

### Phase 5 — Fix Approval Workflow (P1, ~1 day)

11. **Remove silent error swallowing** in `confirmRelationship` and `rejectRelationship` — Surface errors to the user. *(0.5 day)*
12. **Fix stale closure in `ExecutionWorkspacePage`** — Remove `selectedRun` from `loadAll`'s dependency array. *(0.5 day)*

### Phase 6 — Restore Traceability (P1, ~2 days)

13. **Add traceability fields** — Add `requirementId`, `scenarioId`, `mappingId` to the run data model and propagate through the execution pipeline. *(1 day)*
14. **Fix `planStatus` update** — Add `PATCH /api/execution-runs/:id` endpoint. *(1 day)*

### Phase 7 — Cleanup Dead Code (P2, ~3 days)

15. **Remove unused backend files** — Delete `acExtractor.js`, `gapDetector.js`, `deduplicationEngine.js`, `coverageEngine.js`, `v2ScenarioAdapter.js`, `mutationEngine.js`, `scenarioGenerator.js`, `validators.js`, `DependencyAwareOrchestrator.js`, and unused matching engine files. *(1 day)*
16. **Remove unused frontend files** — Delete `WorkflowStatus.tsx`, `AppShell.tsx`, `common/*` components, `useDebounce.ts`, `useTheme.tsx`, `utils/*`, `KnowledgePage.tsx`, `KnowledgeEnginePage.tsx`, `ApiExplorer.tsx`, `ApiCollectionPanel.tsx`, `ContractPaster.tsx`, `ContractUploader.tsx`, `test-cases/`, `test-prepare/` directories. *(1 day)*
17. **Remove duplicate services** — Delete `project-setup/KnowledgeService.ts` and consolidate `listServices`/`getService` into a single service. *(1 day)*

### Phase 8 — Consolidate Repositories (P2, ~1 day)

18. **Consolidate run repositories** — Merge `ExecutionRunRepository.js` and `RunRepository.js` into a single repository with proper postgres switching. *(1 day)*

### Phase 9 — Polish (P3, ~1 day)

19. **Fix sidebar icons** — Assign distinct icons to each nav item. *(0.5 day)*
20. **Fix sidebar "Test Cases" label** — Rename to "Workspace" or change the view id. *(0.5 day)*
21. **Fix initial hash handling** — Call `handleHashChange()` on mount in `App.tsx`. *(0.5 day)*
22. **Update misleading comments** — Fix "Express backend" reference in `ApiClient.ts`. *(0.5 day)*

---

## Appendix: Files Reviewed

### Backend (`Tool/AI/src/`)

| File | Status |
|------|--------|
| `server.js` | **CRITICAL** — 3 broken imports, 2 undefined variables |
| `config.js` | OK |
| `storage.js` | **P1** — data model mismatch with server.js |
| `domain/ExecutionRun.js` | **P0** — corrupted trailing content |
| `domain/ExecutionRunRepository.js` | **P2** — no postgres option |
| `domain/RunRepository.js` | OK |
| `domain/RequirementService.js` | OK |
| `domain/ValidationScenarioService.js` | OK |
| `domain/ImplementationMappingService.js` | OK |
| `domain/ExecutableTestService.js` | OK |
| `domain/ProjectKnowledgeService.js` | OK |
| `domain/ScenarioGenerationService.js` | OK (but not imported in server.js) |
| `domain/TestGenerationService.js` | OK |
| `domain/ExecutionPlan.js` | OK |
| `domain/contractAdapter.js` | OK |
| `domain/ProjectRepository.js` | OK |
| `domain/ProjectService.js` | OK |
| `domain/ServiceRepository.js` | OK |
| `domain/ProjectKnowledgeRepository.js` | OK |
| `domain/ProjectIdentity.js` | OK |
| `domain/RequirementRepository.js` | OK |
| `domain/ValidationScenarioRepository.js` | OK |
| `domain/ImplementationMappingRepository.js` | OK |
| `domain/ExecutableTestRepository.js` | OK |
| `domain/repositories/*` | **P2** — several unused postgres repos |
| `engine/testCaseGenerator.js` | OK |
| `engine/testSpecificationBridge.js` | OK |
| `engine/dependencyAwareExecutor.js` | OK |
| `engine/matching/testCaseMatcher.js` | OK |
| `engine/matching/matchingEngine.js` | OK |
| `engine/matching/operationContextGrouper.js` | **P2** — dead code |
| `engine/matching/confidenceAnalyzer.js` | **P2** — dead code |
| `engine/matching/endpointIndex.js` | **P2** — dead code |
| `engine/matching/matchingSignals.js` | **P2** — dead code |
| `engine/matching/operationIntent.js` | **P2** — dead code |
| `engine/matching/targetIntentExtractor.js` | **P2** — dead code |
| `engine/matching/types.js` | **P2** — dead code |
| `engine/gapDetector.js` | **P2** — dead code |
| `engine/deduplicationEngine.js` | **P2** — dead code |
| `engine/coverageEngine.js` | **P2** — dead code |
| `engine/v2ScenarioAdapter.js` | **P2** — dead code |
| `payload/mutationEngine.js` | **P2** — dead code |
| `scenarios/scenarioGenerator.js` | **P2** — dead code |
| `validation/validators.js` | **P2** — dead code |
| `acExtractor.js` | **P2** — dead code |
| `execution/DependencyAwareOrchestrator.js` | **P2** — dead code |
| `integrations/jiraClient.js` | OK |
| `integrations/llmClient.js` | OK |
| `db/pool.js` | OK |
| `db/migrate.js` | OK |
| `db/001-schema.sql` | OK |

### Frontend (`Tool/AI/frontend/src/`)

| File | Status |
|------|--------|
| `App.tsx` | **P1** — dual state management, incomplete hash handler |
| `main.tsx` | **P2** — no ProjectProvider wrapper |
| `services/ApiClient.ts` | **P3** — misleading "Express" comment |
| `services/index.ts` | OK |
| `types/index.ts` | OK |
| `components/layout/Sidebar.tsx` | **P3** — icon reuse, label mismatch |
| `components/layout/Header.tsx` | OK |
| `components/layout/AppShell.tsx` | **P2** — dead code |
| `components/workflow/WorkflowStatus.tsx` | **P2** — dead code |
| `components/common/*` | **P2** — dead code |
| `hooks/useProject.ts` | OK |
| `hooks/useProjects.ts` | OK |
| `hooks/useDebounce.ts` | **P2** — dead code |
| `hooks/useTheme.tsx` | **P2** — dead code |
| `hooks/useLocalStorage.ts` | OK |
| `utils/constants.ts` | **P2** — dead code |
| `utils/index.ts` | **P2** — dead code |
| `utils/validators.ts` | **P2** — dead code |
| `features/project-setup/*` | **P1** — dual state management, duplicate KnowledgeService |
| `features/knowledge/KnowledgeService.ts` | OK |
| `features/knowledge/KnowledgePage.tsx` | **P2** — dead code |
| `features/knowledge/KnowledgeEnginePage.tsx` | **P2** — dead code |
| `features/api-collection/ApiCatalogPage.tsx` | OK |
| `features/api-collection/ApiExplorer.tsx` | **P2** — dead code |
| `features/api-collection/ApiCollectionPanel.tsx` | **P2** — dead code |
| `features/api-collection/ContractPaster.tsx` | **P2** — dead code |
| `features/api-collection/ContractUploader.tsx` | **P2** — dead code |
| `features/requirements/RequirementPage.tsx` | OK |
| `features/validation-scenarios/ValidationScenariosPage.tsx` | OK |
| `features/implementation-mappings/ImplementationMappingsPage.tsx` | OK |
| `features/executable-tests/ExecutableTestsPage.tsx` | OK |
| `features/execution-workspace/ExecutionWorkspacePage.tsx` | **P0** — 6 missing endpoints, **P1** — stale closure |
| `features/execution-workspace/ExecutionWorkspaceService.ts` | **P0** — 6 missing endpoints, **P1** — type mismatch |
| `features/runs/RunService.ts` | **P1** — data shape mismatch |
| `features/history/HistoryPage.tsx` | **P0** — navigation broken |
| `features/results/ResultsPage.tsx` | OK |
| `features/workspace/WorkspacePage.tsx` | OK |
| `features/settings/SettingsPage.tsx` | OK |
| `features/test-cases/*` | **P2** — dead code |
| `features/test-prepare/*` | **P2** — dead code |

---

*End of Report*
