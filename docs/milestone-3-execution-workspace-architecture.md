# TestForge Milestone 3 — Execution Workspace Architecture

**Version:** 1.0  
**Date:** 2026-07-29  
**Status:** Design Document — No Implementation  
**Scope:** Execution Workspace feature for TestForge V1 Core

---

## Table of Contents

1. [User Workflow](#1-user-workflow)
2. [Backend Architecture](#2-backend-architecture)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Execution Lifecycle](#4-execution-lifecycle)
5. [State Machine](#5-state-machine)
6. [API Endpoints](#6-api-endpoints)
7. [Domain Models](#7-domain-models)
8. [Repository Design](#8-repository-design)
9. [UI Wireframe](#9-ui-wireframe)
10. [Report Integration](#10-report-integration)
11. [Error Handling](#11-error-handling)
12. [Retry Strategy](#12-retry-strategy)
13. [Dry Run Behavior](#13-dry-run-behavior)
14. [Authentication Handling](#14-authentication-handling)
15. [Dependency Execution](#15-dependency-execution)
16. [Variable Propagation](#16-variable-propagation)
17. [Progress Tracking](#17-progress-tracking)

---

## 1. User Workflow

### 1.1 High-Level Flow

The Execution Workspace consumes **approved** executable tests and transforms them into executable runs.

```
Approved Executable Tests
         ↓
   Create Execution Run
         ↓
   Build Execution Plan
   (resolve dependencies, order steps)
         ↓
   Execute / Dry Run
   (run steps, capture results)
         ↓
   View Results / Logs
   (analyze pass/fail/blocked)
         ↓
   Continue to Validation Report
```

### 1.2 Detailed User Journey

#### Step 1: Navigate to Execution Workspace
- User is on **Executable Tests** page
- All approved tests exist
- User clicks **Continue → Execution Workspace** (or uses sidebar)
- Navigation is instant; no page refresh

#### Step 2: Create Execution Run
- User sees list of existing runs (if any) on the left panel
- User clicks **New Run**
- System creates a new run with default name: `Run <timestamp>`
- Run appears in list with status: `draft`
- Run detail panel opens on the right

#### Step 3: Build Execution Plan
- User selects the new run
- User clicks **Build Plan**
- System:
  - Fetches all approved executable tests for the project
  - Resolves dependency graph (which tests depend on others)
  - Orders tests for sequential/parallel execution
  - Identifies authentication requirements
  - Populates variables from previous steps
  - Creates an execution plan with ordered steps
- Run status updates to `planned`
- Plan is visible in the detail panel

#### Step 4: Review Plan
- User reviews:
  - Execution order (sequential vs parallel)
  - Step dependencies
  - Authentication requirements
  - Variable usage
  - Estimated execution time
- User can:
  - **Rebuild Plan** — re-analyze dependencies
  - **Dry Run** — validate without making actual API calls
  - **Execute** — run the plan for real

#### Step 5: Execute Run
- User clicks **Execute**
- System:
  - Validates plan exists
  - Sets status to `running`
  - Begins executing steps in order
  - Updates progress in real-time
  - Captures logs for each step
  - Updates step status (pending → running → passed/failed/blocked)
- User sees:
  - Live progress bar
  - Current step highlighted
  - Logs streaming in
  - Timeline updating

#### Step 6: Monitor Execution
- User can:
  - **Cancel** — stop execution gracefully
  - View live logs
  - See which step is running
  - See elapsed time
- System polls for status updates every 2 seconds

#### Step 7: Execution Complete
- Status changes to `completed`, `passed`, or `failed`
- Final results displayed:
  - Total steps: X
  - Passed: Y
  - Failed: Z
  - Blocked: W
  - Duration: N ms
- **Continue to Validation Report** button appears
- User can click to view results/reports

#### Step 8: Continue to Report
- User clicks **View Report**
- Navigates to `#results` with runId parameter
- ResultsPage displays detailed results

### 1.3 User Actions & System Responses

| User Action | System Response |
|-------------|-----------------|
| Click **New Run** | Create run with status `draft`, select it |
| Click **Build Plan** | Generate execution plan from approved tests, status → `planned` |
| Click **Rebuild Plan** | Regenerate plan, preserve existing results if any |
| Click **Execute** | Start execution, status → `running`, begin polling |
| Click **Dry Run** | Validate plan without calling APIs, status → `draft` |
| Click **Cancel** | Stop execution gracefully, status → `cancelled` |
| Click **Delete** | Confirm dialog, delete run, refresh list |
| Click **Refresh** | Reload runs and stats from server |

---

## 2. Backend Architecture

### 2.1 Service Layer

The Execution Workspace backend is organized into three service modules:

```
src/domain/
  ExecutionRun.js                 # Domain model + domain logic
  ExecutionRunRepository.js        # Repository pattern (file-based)
  ExecutionRunService.js           # Business logic (create, build, execute, etc.)
  ExecutionPlan.js                 # Execution plan domain model
```

**Note:** The current codebase has corrupted content in `ExecutionRun.js` (lines 39–52 contain metadata tags). This must be cleaned up before implementation.

### 2.2 Repository Strategy

The repository layer uses the **Repository Pattern** to abstract data storage:

- `ExecutionRunRepository.js` — delegates to either:
  - `FileExecutionRunRepository.js` (default)
  - `PostgresExecutionRunRepository.js` (when `config.features.pgEnabled` is true)

**Current Issue:** `ExecutionRunRepository.js` only supports file-based storage. PostgreSQL support is not yet implemented.

### 2.3 Data Storage

#### File-Based Storage
- Runs are stored as JSON files in a configured directory
- File naming: `<runId>.json`
- Atomic writes using `writeFileSync` with temp file + rename

#### PostgreSQL Storage (Future)
- Table: `execution_runs`
- Columns: id, project_id, name, status, plan, results, warnings, variables, authentication, environment, started_at, completed_at, created_at, updated_at
- JSONB columns for: `plan`, `results`, `warnings`, `variables`, `authentication`, `environment`

### 2.4 Execution Engine

#### Plan Builder
- Input: List of approved executable test IDs + project context
- Process:
  1. Fetch all approved executable tests for project
  2. Build dependency graph from `dependencies` field
  3. Topological sort to determine execution order
  4. Group independent tests for parallel execution (if configured)
  5. Resolve variable references between tests
  6. Validate authentication requirements
  7. Generate execution plan (ordered list of steps)
- Output: `ExecutionPlan` object

#### Executor
- Input: Execution plan + project context
- Process:
  1. For each step in plan:
     - Set step status to `running`
     - Execute API call (or dry-run validation)
     - Capture response, latency, status code
     - Run assertions
     - Store result in step
     - Update run status
     - Extract variables for next steps
  2. Handle failures:
     - If step fails → mark subsequent dependent steps as `blocked`
     - Continue non-dependent steps if configured
  3. Set final run status:
     - `passed` — all steps passed
     - `failed` — one or more steps failed
     - `cancelled` — user cancelled
     - `blocked` — dependencies failed
- Output: Updated run with results

#### Dry Runner
- Input: Execution plan
- Process:
  1. Validate all API operations exist in catalog
  2. Validate all required variables are defined
  3. Validate authentication configuration
  4. Check for circular dependencies
  5. Estimate execution time
- Output: Plan with warnings (no actual API calls)

---

## 3. Frontend Architecture

### 3.1 Component Hierarchy

```
ExecutionWorkspacePage (main container)
  ├── Header (title, subtitle, refresh button)
  ├── Stats Cards (total, running, passed, failed, blocked, skipped)
  ├── Runs List (left sidebar)
  │   └── Run Card (clickable, shows name, status, step count, delete button)
  ├── Selected Run Detail (right main area)
  │   ├── ExecutionToolbar (build, rebuild, execute, dry-run, cancel)
  │   ├── ExecutionPlanCard (plan visualization)
  │   ├── DependencyTree (dependency graph visualization)
  │   ├── ExecutionTimeline (step-by-step progress)
  │   └── ExecutionLogViewer (live logs)
  └── Execution Complete Banner (when run finishes)
```

### 3.2 State Management

The Execution Workspace uses **local state** within `ExecutionWorkspacePage`:

```typescript
interface ExecutionWorkspaceState {
  runs: ExecutionRun[];           // List of all runs for project
  stats: RunStats | null;         // Aggregate statistics
  selectedRun: ExecutionRun | null; // Currently selected run
  loading: boolean;               // Initial load indicator
  error: string;                  // Error message
  loadingAction: string | null;   // Current action (build-plan, execute, etc.)
  polling: boolean;               // Whether polling for updates
}
```

**No global state management** is used. The component manages its own state and refreshes via API calls.

### 3.3 Polling Strategy

For running executions, the frontend polls the backend every 2 seconds:

```typescript
useEffect(() => {
  if (polling && activeProjectId && selectedRun) {
    pollIntervalRef.current = window.setInterval(async () => {
      const updated = await getExecutionRun(activeProjectId, selectedRun.id);
      setSelectedRun(updated);
      if (updated.status !== "running" && updated.status !== "pending") {
        setPolling(false);
      }
    }, 2000);
  }
  return () => clearInterval(pollIntervalRef.current);
}, [polling, activeProjectId, selectedRun]);
```

### 3.4 Keyboard Shortcuts

Power-user shortcuts are implemented:

| Key | Action | Condition |
|-----|--------|-----------|
| `R` | Execute run | `canRun && !loading` |
| `D` | Dry run | `canDryRun && !loading` |
| `B` | Rebuild plan | `canRebuild && !loading` |
| `Escape` | Cancel execution | `canCancel && !loading` |

---

## 4. Execution Lifecycle

### 4.1 Lifecycle States

```
[draft] → [planned] → [running] → [completed]
                ↓           ↓
           [cancelled]  [failed]
                ↓           ↓
           [cancelled]  [passed]
```

### 4.2 State Transitions

| From | To | Trigger | User Action |
|------|----|---------|-------------|
| `draft` | `planned` | Plan built successfully | Build Plan |
| `draft` | `planned` | Dry run successful | Dry Run |
| `planned` | `running` | Execute started | Execute |
| `running` | `cancelled` | User cancels | Cancel |
| `running` | `failed` | Step fails | — (automatic) |
| `running` | `passed` | All steps pass | — (automatic) |
| `planned` | `draft` | Plan rebuilt | Rebuild Plan |
| `planned` | `draft` | New run created | — (automatic) |

### 4.3 Execution Phases

**Phase 1: Plan Building**
- Input: Approved executable tests
- Process: Dependency resolution, ordering, variable mapping
- Output: Execution plan (ordered steps)
- Duration: Typically < 1 second

**Phase 2: Execution**
- Input: Execution plan
- Process: Step-by-step API execution
- Output: Step results + run status
- Duration: Varies (seconds to minutes)

**Phase 3: Completion**
- Input: All step results
- Process: Aggregate statistics, determine final status
- Output: Final run record + results summary
- Duration: Instant

---

## 5. State Machine

### 5.1 Run State Machine

```
                    ┌─────────────────────┐
                    │         draft        │
                    └──────────┬──────────┘
                               │ build plan / dry-run
                               ▼
                    ┌─────────────────────┐
                    │       planned        │
                    └──────────┬──────────┘
                               │ execute
                               ▼
                    ┌─────────────────────┐
                    │       running        │
                    └──────────┬──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
          ┌──────────────┐      ┌──────────────┐
          │    passed     │      │    failed     │
          └──────────────┘      └──────────────┘
                    │                     │
                    └──────────┬──────────┘
                               │ complete
                               ▼
                    ┌─────────────────────┐
                    │      completed       │
                    └─────────────────────┘
```

### 5.2 Step State Machine

```
pending → running → passed
pending → running → failed
pending → running → blocked
pending → blocked (dependency failed)
```

### 5.3 Plan Status States

- `draft` — Initial state, no plan built yet
- `ready` — Plan built and validated
- `running` — Execution in progress
- `completed` — Execution finished
- `cancelled` — Execution cancelled by user

---

## 6. API Endpoints

### 6.1 Existing Endpoints (Already Implemented)

| Method | Endpoint | Purpose | Status |
|--------|----------|---------|--------|
| `GET` | `/api/execution-runs` | List runs for project | ✅ Implemented |
| `GET` | `/api/execution-runs/stats` | Get run statistics | ✅ Implemented |
| `GET` | `/api/execution-runs/:id` | Get single run | ✅ Implemented |
| `DELETE` | `/api/execution-runs/:id` | Delete run | ✅ Implemented |

### 6.2 Missing Endpoints (To Be Implemented)

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| `POST` | `/api/execution-runs` | Create run | `{ name?: string }` | `{ run: ExecutionRun }` |
| `POST` | `/api/execution-runs/:id/build-plan` | Build execution plan | `{ testIds?: string[] }` | `{ run: ExecutionRun }` |
| `POST` | `/api/execution-runs/:id/rebuild-plan` | Rebuild plan | `{}` | `{ run: ExecutionRun }` |
| `POST` | `/api/execution-runs/:id/execute` | Execute run | `{ dryRun?: boolean }` | `{ run: ExecutionRun }` |
| `POST` | `/api/execution-runs/:id/dry-run` | Validate plan | `{}` | `{ run: ExecutionRun }` |
| `POST` | `/api/execution-runs/:id/cancel` | Cancel execution | `{}` | `{ run: ExecutionRun }` |

### 6.3 Endpoint Specifications

#### `POST /api/execution-runs`
**Purpose:** Create a new execution run  
**Auth:** Project member  
**Request:**
```json
{
  "name": "Run 7/29/2026, 4:30:00 PM" // optional, auto-generated if omitted
}
```
**Response:**
```json
{
  "run": {
    "id": "run_123",
    "projectId": "proj_456",
    "name": "Run 7/29/2026, 4:30:00 PM",
    "status": "draft",
    "plan": null,
    "results": [],
    "warnings": [],
    "variables": {},
    "authentication": {},
    "environment": {},
    "startedAt": null,
    "completedAt": null,
    "createdAt": "2026-07-29T11:00:00.000Z",
    "updatedAt": "2026-07-29T11:00:00.000Z"
  }
}
```

#### `POST /api/execution-runs/:id/build-plan`
**Purpose:** Build execution plan from approved tests  
**Auth:** Project member  
**Request:**
```json
{
  "testIds": ["test_1", "test_2"] // optional, uses all approved tests if omitted
}
```
**Response:**
```json
{
  "run": {
    "id": "run_123",
    "status": "planned",
    "plan": {
      "steps": [
        {
          "id": "step_1",
          "order": 1,
          "testId": "test_1",
          "title": "Test User Login",
          "operationRef": {
            "serviceId": "svc_1",
            "operationId": "login"
          },
          "dependencies": [],
          "variablesRequired": ["token"],
          "authenticationRequired": true,
          "status": "pending",
          "result": null
        }
      ],
      "totalSteps": 5,
      "executionOrder": "sequential",
      "warnings": [],
      "variables": {},
      "authentication": {},
      "environment": {}
    }
  }
}
```

#### `POST /api/execution-runs/:id/execute`
**Purpose:** Execute the plan  
**Auth:** Project member  
**Request:**
```json
{
  "dryRun": false
}
```
**Response:**
```json
{
  "run": {
    "id": "run_123",
    "status": "running",
    "plan": { /* updated plan with step results */ },
    "startedAt": "2026-07-29T11:05:00.000Z",
    "completedAt": null
  }
}
```

#### `POST /api/execution-runs/:id/dry-run`
**Purpose:** Validate plan without executing  
**Auth:** Project member  
**Response:**
```json
{
  "run": {
    "id": "run_123",
    "status": "planned",
    "plan": {
      "warnings": ["Variable 'token' is not defined in any preceding step"],
      "valid": false
    }
  }
}
```

#### `POST /api/execution-runs/:id/cancel`
**Purpose:** Cancel running execution  
**Auth:** Project member  
**Response:**
```json
{
  "run": {
    "id": "run_123",
    "status": "cancelled",
    "completedAt": "2026-07-29T11:10:00.000Z"
  }
}
```

### 6.4 Error Responses

All endpoints return standard HTTP status codes:

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad request (invalid input) |
| `401` | Unauthorized |
| `403` | Forbidden (not a project member) |
| `404` | Run not found |
| `409` | Conflict (e.g., execute a run that is already running) |
| `500` | Server error |

Error response format:
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE", // optional
  "details": {} // optional
}
```

---

## 7. Domain Models

### 7.1 ExecutionRun

The core domain model representing a test execution run.

```typescript
interface ExecutionRun {
  id: string;
  projectId: string;
  name: string;
  status: RunStatus;
  plan: ExecutionPlan | null;
  results: ExecutionStepResult[];
  warnings: string[];
  variables: Record<string, any>;
  authentication: AuthenticationContext;
  environment: EnvironmentContext;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type RunStatus = 
  | "draft" 
  | "planned" 
  | "running" 
  | "passed" 
  | "failed" 
  | "cancelled" 
  | "completed";

interface ExecutionPlan {
  steps: ExecutionStep[];
  totalSteps: number;
  executionOrder: "sequential" | "parallel";
  warnings: string[];
  variables: Record<string, VariableDefinition>;
  authentication: AuthenticationContext;
  environment: EnvironmentContext;
  estimatedDuration: number; // milliseconds
}

interface ExecutionStep {
  id: string;
  order: number;
  testId: string;
  title: string;
  description: string;
  operationRef: {
    serviceId: string;
    operationId: string;
  };
  dependencies: string[]; // step IDs this step depends on
  variablesRequired: string[];
  variablesProduced: string[];
  authenticationRequired: boolean;
  authenticationDetails: AuthenticationDetails;
  status: StepStatus;
  result: ExecutionStepResult | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

type StepStatus = 
  | "pending" 
  | "running" 
  | "passed" 
  | "failed" 
  | "blocked" 
  | "skipped" 
  | "cancelled";

interface ExecutionStepResult {
  statusCode: number | null;
  responseBody: any;
  headers: Record<string, string>;
  assertions: AssertionResult[];
  logs: string[];
  error: string | null;
  variablesExtracted: Record<string, any>;
}

interface AssertionResult {
  type: "status" | "body" | "header" | "schema";
  expected: any;
  actual: any;
  passed: boolean;
  message: string;
}

interface VariableDefinition {
  name: string;
  source: "step" | "environment" | "user";
  stepId?: string; // if source is "step"
  extractFrom: "response.body" | "response.header" | "response.status";
  defaultValue?: any;
}

interface AuthenticationContext {
  type: "none" | "bearer" | "basic" | "api-key" | "oauth2";
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  expiresAt?: string;
}

interface EnvironmentContext {
  baseUrl: string;
  headers: Record<string, string>;
  timeout: number; // milliseconds
  retries: number;
  dryRun: boolean;
}
```

### 7.2 Traceability Model

Every execution run maintains traceability to the original artifacts:

```typescript
interface ExecutionRunTraceability {
  runId: string;
  projectId: string;
  testIds: string[];           // Executable tests being executed
  mappingIds: string[];        // Implementation mappings
  scenarioIds: string[];       // Validation scenarios
  requirementIds: string[];    // Original requirements
}
```

This is stored as part of the run data and used for:
- Report generation
- Impact analysis
- Audit trails

---

## 8. Repository Design

### 8.1 ExecutionRunRepository

**File:** `src/domain/ExecutionRunRepository.js`

```javascript
class ExecutionRunRepository {
  async list(projectId, options = {}) {}
  async get(projectId, runId) {}
  async create(projectId, data) {}
  async update(projectId, runId, data) {}
  async delete(projectId, runId) {}
  async getStats(projectId) {}
}
```

### 8.2 File-Based Implementation

**File:** `src/domain/repositories/FileExecutionRunRepository.js`

- Storage location: `data/execution-runs/<projectId>/`
- File format: JSON
- Atomic writes:
  1. Write to temp file
  2. Rename to final file
- Read: `fs.readFileSync` + `JSON.parse`
- List: `fs.readdirSync` + filter by projectId
- Cleanup: Old runs can be archived/deleted manually

### 8.3 PostgreSQL Implementation (Future)

**File:** `src/domain/repositories/PostgresExecutionRunRepository.js`

- Table: `execution_runs`
- JSONB columns for: `plan`, `results`, `warnings`, `variables`, `authentication`, `environment`
- Indexes on: `project_id`, `status`, `created_at`
- Connection pooling via `db/pool.js`

### 8.4 Repository Selection

**File:** `src/domain/ExecutionRunRepository.js`

```javascript
const config = require("../../config");
const FileExecutionRunRepository = require("./repositories/FileExecutionRunRepository");
const PostgresExecutionRunRepository = require("./repositories/PostgresExecutionRunRepository");

const repository = config.features?.pgEnabled 
  ? new PostgresExecutionRunRepository(config)
  : new FileExecutionRunRepository(config);

module.exports = repository;
```

---

## 9. UI Wireframe

### 9.1 Layout Structure

```
┌────────────────────────────────────────────────────────────────────┐
│ Header: Execution Workspace                                      │
│ [Refresh] [New Run]                                              │
├────────────────────────────────────────────────────────────────────┤
│ Stats: Total | Running | Passed | Failed | Blocked | Skipped     │
├──────────────┬───────────────────────────────────────────────────┤
│ Runs List    │ Selected Run Detail                               │
│              │                                                   │
│ [Run 1] ●    │ ┌─────────────────────────────────────────────┐ │
│ [Run 2] ○    │ │ Execution Toolbar                          │ │
│ [Run 3] ○    │ │ [Build Plan] [Execute] [Dry Run] [Cancel] │ │
│              │ └─────────────────────────────────────────────┘ │
│              │                                                   │
│              │ ┌─────────────────────────────────────────────┐ │
│              │ │ Execution Plan Card                        │ │
│              │ │ 5 steps • Sequential • ~2 min              │ │
│              │ └─────────────────────────────────────────────┘ │
│              │                                                   │
│              │ ┌─────────────────────────────────────────────┐ │
│              │ │ Dependency Tree                            │ │
│              │ │ (graph visualization)                      │ │
│              │ └─────────────────────────────────────────────┘ │
│              │                                                   │
│              │ ┌─────────────────────────────────────────────┐ │
│              │ │ Execution Timeline                         │ │
│              │ │ Step 1: passed (1.2s)                      │ │
│              │ │ Step 2: running...                         │ │
│              │ │ Step 3: pending                            │ │
│              │ └─────────────────────────────────────────────┘ │
│              │                                                   │
│              │ ┌─────────────────────────────────────────────┐ │
│              │ │ Execution Log                              │ │
│              │ │ > GET /api/login 200 OK (45ms)             │ │
│              │ │ > POST /api/profile 200 OK (120ms)         │ │
│              │ └─────────────────────────────────────────────┘ │
│              │                                                   │
│              │ ┌─────────────────────────────────────────────┐ │
│              │ │ Execution Complete                          │ │
│              │ │ Continue to Validation Report →             │ │
│              │ └─────────────────────────────────────────────┘ │
└──────────────┴───────────────────────────────────────────────────┘
```

### 9.2 Component Details

#### Runs List (Left Panel)
- **Width:** 320px fixed
- **Content:** Scrollable list of run cards
- **Run Card:**
  - Name (editable on click)
  - Status badge (color-coded)
  - Created timestamp
  - Step count (if plan exists)
  - Delete button (with confirmation)

#### Execution Toolbar
- **Position:** Top of detail panel
- **Buttons:**
  - Build Plan (primary)
  - Rebuild Plan (secondary)
  - Execute (primary, green)
  - Dry Run (secondary)
  - Cancel (danger, red)
- **States:**
  - Disabled when no run selected
  - Loading state during actions

#### Execution Plan Card
- **Content:**
  - Total steps
  - Execution order (sequential/parallel)
  - Estimated duration
  - Warnings list
  - Variable definitions
  - Authentication requirements

#### Dependency Tree
- **Visualization:** Hierarchical tree or directed acyclic graph (DAG)
- **Nodes:** Execution steps
- **Edges:** Dependencies
- **Color coding:** Ready (green), Waiting (yellow), Failed (red)

#### Execution Timeline
- **Content:** Step-by-step list
- **Each step shows:**
  - Step number
  - Title
  - Status badge
  - Duration
  - Expandable details (request/response)

#### Execution Log Viewer
- **Content:** Real-time log stream
- **Format:** Timestamp + log level + message
- **Auto-scroll:** Yes
- **Search:** Yes (future)

---

## 10. Report Integration

### 10.1 Completion Trigger

When a run reaches terminal status (`passed`, `failed`, `cancelled`, `completed`), the UI displays a completion banner:

```tsx
{(selectedRun.status === "completed" ||
  selectedRun.status === "passed" ||
  selectedRun.status === "failed" ||
  selectedRun.status === "cancelled") && (
  <CompletionBanner onContinue={() => {
    window.location.hash = `#results?runId=${selectedRun.id}`;
  }} />
)}
```

### 10.2 Data Passed to Results Page

The `runId` is passed via URL hash parameter:

```
#results?runId=run_123
```

`ResultsPage` parses the hash and fetches the run details to display:
- Execution summary
- Step-by-step results
- Assertion results
- Logs
- Traceability (which requirements/scenarios/mappings/tests were executed)

### 10.3 ResultsPage Integration

`ResultsPage` (already exists) should be enhanced to:
1. Accept `runId` from hash
2. Fetch run details via `GET /api/execution-runs/:id`
3. Display:
   - Run metadata (name, status, duration)
   - Step results table
   - Failed assertions
   - Log viewer
   - Traceability links:
     - View Executable Test
     - View Implementation Mapping
     - View Validation Scenario
     - View Requirement

---

## 11. Error Handling

### 11.1 Error Categories

| Category | Examples | User Experience |
|----------|----------|-----------------|
| **Validation Error** | Missing prerequisites, invalid plan | Show error message, do not proceed |
| **Execution Error** | API call failed, assertion failed | Continue execution, mark step as failed |
| **Network Error** | Backend unreachable, timeout | Show retry option, preserve run state |
| **Authorization Error** | Not a project member | Redirect to project selection |
| **Conflict Error** | Run already running | Show message, suggest cancel or new run |

### 11.2 Error Handling Strategy

#### Frontend
```typescript
try {
  const run = await executeExecutionRun(projectId, runId, {});
  setSelectedRun(run);
} catch (err) {
  // 1. Display user-friendly error message
  setError(err instanceof Error ? err.message : "Failed to execute run.");
  
  // 2. Stop polling
  setPolling(false);
  
  // 3. Do not clear selected run — preserve context
  
  // 4. Log error for debugging
  console.error("Execution failed:", err);
}
```

#### Backend
```javascript
try {
  const run = await executor.execute(projectId, runId);
  return sendJson(res, 200, { run });
} catch (error) {
  if (error.code === "PRECONDITION_FAILED") {
    return sendJson(res, 409, { error: error.message });
  }
  console.error("Execution error:", error);
  return sendJson(res, 500, { error: "Internal server error during execution." });
}
```

### 11.3 Graceful Degradation

- If polling fails, keep showing last known state
- If backend is unreachable, show "Connection lost" with retry button
- If a step fails, continue executing independent steps
- If cancellation is requested, wait for current step to complete (if safe) or force cancel

---

## 12. Retry Strategy

### 12.1 Frontend Retry

For transient errors (network failures, 5xx errors):

```typescript
const executeWithRetry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      if (err.code === "NETWORK_ERROR" || err.status >= 500) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        continue;
      }
      throw err; // Non-retryable error
    }
  }
};
```

### 12.2 Backend Retry

For API calls during execution:

```typescript
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryOn: number[]; // HTTP status codes to retry
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryOn: [408, 429, 502, 503, 504]
};
```

Retry logic:
```typescript
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    const response = await apiClient.call(operation);
    return response;
  } catch (error) {
    if (attempt === maxRetries || !retryOn.includes(error.status)) {
      throw error;
    }
    const delay = Math.min(initialDelay * (backoffFactor ** (attempt - 1)), maxDelay);
    await sleep(delay);
  }
}
```

### 12.3 Retry Display

- Each retry attempt is logged
- Final failure includes retry count in error message
- User sees: "Failed after 3 attempts: Request timed out"

---

## 13. Dry Run Behavior

### 13.1 Purpose

A dry run validates the execution plan **without making actual API calls**. It helps users:
- Verify the plan is valid
- Catch configuration errors early
- Estimate execution time
- Identify missing variables or authentication

### 13.2 Dry Run Process

1. User clicks **Dry Run**
2. Backend:
   - Loads execution plan (if not built, build it first)
   - For each step:
     - Validate API operation exists in catalog
     - Validate required variables are defined
     - Validate authentication configuration
     - Check for circular dependencies
     - Simulate response (mock)
   - Collect warnings
3. Run status: `planned` (does not change)
4. Warnings displayed in plan card

### 13.3 Dry Run Output

```json
{
  "run": {
    "id": "run_123",
    "status": "planned",
    "plan": {
      "steps": [ /* unchanged */ ],
      "warnings": [
        "Step 3 requires variable 'token' which is produced by Step 1",
        "Step 5 uses API key authentication but no API key is configured",
        "Estimated execution time: 2.5 seconds"
      ],
      "valid": true
    }
  }
}
```

### 13.4 Dry Run Validation Checks

| Check | Warning if Failed |
|-------|-------------------|
| All API operations exist in catalog | "Operation 'unknown-op' not found in API catalog" |
| All required variables are defined | "Variable 'token' is not defined" |
| Authentication is configured | "API key required but not configured" |
| No circular dependencies | "Circular dependency detected: Step 2 → Step 3 → Step 2" |
| Step ordering is valid | "Step 5 depends on Step 6 which comes later" |

---

## 14. Authentication Handling

### 14.1 Authentication Sources

Authentication can come from three sources:

1. **Executable Test Definition** — Each test can specify its authentication requirements
2. **Project Knowledge** — Project-level instructions may describe authentication flows
3. **User Input** — Users can provide tokens/credentials at execution time

### 14.2 Authentication Context

```typescript
interface AuthenticationContext {
  type: "none" | "bearer" | "basic" | "api-key" | "oauth2";
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  expiresAt?: string;
}
```

### 14.3 Authentication Resolution

When building the execution plan:

1. **Collect** authentication requirements from all steps
2. **Check** if project has stored credentials (future feature)
3. **Prompt** user for missing credentials (future feature)
4. **Propagate** credentials to steps that need them

For V1 Core:
- Authentication is **static** — defined in the executable test
- No credential prompting
- No credential storage
- Users must manually configure tests with valid credentials

### 14.4 Token Propagation

If a step produces a token (e.g., login response), subsequent steps can use it:

```typescript
// Step 1: Login
variablesProduced: ["token"]

// Step 2: Use token
variablesRequired: ["token"]
authentication: {
  type: "bearer",
  token: "{{token}}"
}
```

The executor replaces `{{token}}` with the actual value from Step 1's response.

---

## 15. Dependency Execution

### 15.1 Dependency Types

1. **Sequential Dependency** — Step B must run after Step A
2. **Data Dependency** — Step B needs output from Step A (variable)
3. **Authentication Dependency** — Step B needs token from Step A

### 15.2 Dependency Resolution Algorithm

```typescript
function buildExecutionPlan(tests: ExecutableTest[]): ExecutionPlan {
  // 1. Create nodes
  const nodes = tests.map(test => ({
    id: generateStepId(),
    testId: test.id,
    dependencies: test.dependencies.map(dep => resolveDependency(dep, tests))
  }));
  
  // 2. Topological sort
  const sorted = topologicalSort(nodes);
  
  // 3. Assign execution order
  sorted.forEach((node, index) => {
    node.order = index + 1;
  });
  
  // 4. Validate no circular dependencies
  if (hasCycles(sorted)) {
    throw new Error("Circular dependency detected");
  }
  
  return { steps: sorted, executionOrder: "sequential" };
}
```

### 15.3 Parallel Execution (Future)

For V1 Core, execution is **strictly sequential**. Parallel execution is deferred to V2.

### 15.4 Blocked Steps

If a step fails, all dependent steps are marked as `blocked`:

```typescript
function executeStep(step: ExecutionStep, run: ExecutionRun): ExecutionStepResult {
  try {
    // Execute API call
    const result = await callApi(step);
    step.status = "passed";
    return result;
  } catch (error) {
    step.status = "failed";
    // Mark dependent steps as blocked
    markDependentsAsBlocked(step.id, run.plan.steps);
    throw error;
  }
}
```

---

## 16. Variable Propagation

### 16.1 Variable Definition

Variables are defined in executable tests and resolved during execution:

```typescript
interface VariableDefinition {
  name: string;
  source: "step" | "environment" | "user";
  stepId?: string;
  extractFrom: "response.body" | "response.header" | "response.status";
  defaultValue?: any;
}
```

### 16.2 Variable Extraction

When a step completes, variables are extracted from the response:

```typescript
function extractVariables(step: ExecutionStep, result: ExecutionStepResult): Record<string, any> {
  const extracted: Record<string, any> = {};
  
  for (const varDef of step.variablesProduced) {
    switch (varDef.extractFrom) {
      case "response.body":
        extracted[varDef.name] = result.responseBody[varDef.path];
        break;
      case "response.header":
        extracted[varDef.name] = result.headers[varDef.headerName];
        break;
      case "response.status":
        extracted[varDef.name] = result.statusCode;
        break;
    }
  }
  
  return extracted;
}
```

### 16.3 Variable Substitution

Before executing a step, variable references are replaced:

```typescript
function substituteVariables(value: any, variables: Record<string, any>): any {
  if (typeof value === "string" && value.startsWith("{{") && value.endsWith("}}")) {
    const varName = value.slice(2, -2);
    return variables[varName] ?? value;
  }
  return value;
}
```

Example:
```json
{
  "url": "/users/{{userId}}",
  "headers": {
    "Authorization": "Bearer {{token}}"
  }
}
```

After substitution (if `userId=123` and `token=abc`):
```json
{
  "url": "/users/123",
  "headers": {
    "Authorization": "Bearer abc"
  }
}
```

---

## 17. Progress Tracking

### 17.1 Polling Mechanism

The frontend polls for updates during execution:

```typescript
const POLL_INTERVAL = 2000; // 2 seconds

useEffect(() => {
  if (polling && activeProjectId && selectedRun) {
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const updated = await getExecutionRun(activeProjectId, selectedRun.id);
        setSelectedRun(updated);
        
        // Stop polling if execution finished
        if (updated.status !== "running" && updated.status !== "pending") {
          setPolling(false);
        }
      } catch {
        // Silently ignore polling errors — will retry on next interval
      }
    }, POLL_INTERVAL);
  }
  
  return () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };
}, [polling, activeProjectId, selectedRun]);
```

### 17.2 Progress Indicators

#### Execution Timeline
Shows each step with its current status:

```
Step 1: Login                     ✅ passed (1.2s)
  GET /api/auth/login
  → 200 OK
  → Extracted: token=abc123

Step 2: Get User Profile          🔄 running...
  GET /api/users/123
  → Waiting for response...

Step 3: Update User Email         ⏳ pending
  PATCH /api/users/123
  → Waiting for Step 2...
```

#### Progress Bar

```
Execution Progress: [████████░░░░░░░░░░░░] 40%
Step 2 of 5 in progress...
```

### 17.3 Statistics

Real-time statistics updated after each step:

| Statistic | Calculation |
|-----------|-------------|
| Total Steps | `plan.steps.length` |
| Completed Steps | `results.filter(r => r.status !== "pending").length` |
| Passed | `results.filter(r => r.status === "passed").length` |
| Failed | `results.filter(r => r.status === "failed").length` |
| Blocked | `results.filter(r => r.status === "blocked").length` |
| Skipped | `results.filter(r => r.status === "skipped").length` |
| Duration | `Date.now() - run.startedAt` |

### 17.4 Log Streaming

Logs are captured in real-time and displayed in the Execution Log Viewer:

```
[2026-07-29T11:05:00.000Z] INFO: Starting execution of run_123
[2026-07-29T11:05:00.050Z] INFO: Executing Step 1: Login
[2026-07-29T11:05:00.100Z] DEBUG: GET /api/auth/login
[2026-07-29T11:05:01.200Z] INFO: Step 1 completed in 1100ms
[2026-07-29T11:05:01.250Z] INFO: Executing Step 2: Get User Profile
[2026-07-29T11:05:01.300Z] DEBUG: GET /api/users/123
```

### 17.5 Timing Metrics

For each step:
- `startedAt` — Timestamp when step started
- `completedAt` — Timestamp when step finished
- `durationMs` — `completedAt - startedAt`

For the entire run:
- `startedAt` — When execution began
- `completedAt` — When execution finished
- Total duration: `completedAt - startedAt`

---

## Appendix A: Assumptions

1. **User Authorization:** Project members can create and execute runs. No separate role-based access control (RBAC) in V1.
2. **Concurrent Executions:** Only one execution run per project at a time. Users must cancel before starting a new run.
3. **Step Timeout:** Each API call has a default timeout of 30 seconds (configurable).
4. **Retry Policy:** Failed steps are retried 3 times with exponential backoff before marking as failed.
5. **Dry Run Accuracy:** Dry run validates structure and configuration but cannot guarantee runtime success (e.g., API might be down).

## Appendix B: Future Enhancements

1. **Parallel Execution:** Execute independent steps concurrently
2. **Variable Prompting:** Prompt user for missing variables at execution time
3. **Credential Storage:** Securely store and reuse API keys/tokens
4. **Scheduled Runs:** Execute runs on a schedule
5. **Webhook Notifications:** Notify on execution completion
6. **Test Data Management:** Manage test data sets for execution
7. **Environment Management:** Manage dev/staging/prod environments
8. **Advanced Reporting:** PDF export, email reports, trend analysis

## Appendix C: Design Decisions

| Decision | Rationale |
|----------|-----------|
| **PostgreSQL JSONB for plan/results** | Flexibility to store nested plans without schema migrations |
| **Polling over WebSockets** | Simpler to implement, no infrastructure changes needed |
| **Strictly sequential execution for V1** | Reduces complexity, easier to debug, predictable ordering |
| **File-based storage as default** | Zero configuration, easier for development and testing |
| **No credential storage in V1** | Security first; avoid storing secrets in plain text |
| **2-second polling interval** | Balance between responsiveness and server load |

---

*End of Architecture Document*