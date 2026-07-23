# STEP 5.8 — Run Persistence + Results + History Report

## 1. FILES CREATED/MODIFIED

### Created
- `test-step-5.8-run-persistence.js` — 38 backend tests for run persistence, project isolation, secret safety, historical immutability, and test-data isolation

### Modified
- `frontend/src/features/test-prepare/ExecutionPanel.tsx` — Added "View Full Results" button after execution completes, navigates to `#results?runId={id}`
- `frontend/src/features/test-prepare/ExecutionService.ts` — Added `runId` and `run` fields to `ExecuteDependentResponse` interface

### Already existed (no changes needed)
- `src/domain/RunRepository.js` — File-based persistence with `saveRun`, `getRun`, `listRuns`, `deleteRun`
- `frontend/src/features/runs/RunService.ts` — Frontend service for `GET /api/active/runs` and `GET /api/active/runs/:runId`
- `frontend/src/features/results/ResultsPage.tsx` — Full persisted run detail view
- `frontend/src/features/history/HistoryPage.tsx` — Project-scoped run history list
- `src/server.js` — Active run API endpoints + execute-dependent persistence integration

---

## 2. EXISTING RUN/REPORTING CODE AUDIT

| Component | File | Classification | Notes |
|-----------|------|---------------|-------|
| **RunRepository** | `src/domain/RunRepository.js` | **ACTIVE** | Project-scoped, file-based, used by active workflow |
| **Active run API routes** | `src/server.js` (lines 214-230) | **ACTIVE** | `GET /api/active/runs` and `GET /api/active/runs/:runId` |
| **execute-dependent handler** | `src/server.js` (lines 329-429) | **ACTIVE** | Persists run after execution, redacts secrets |
| **RunService (frontend)** | `frontend/src/features/runs/RunService.ts` | **ACTIVE** | Calls active run API endpoints |
| **ResultsPage** | `frontend/src/features/results/ResultsPage.tsx` | **ACTIVE** | Renders persisted run detail |
| **HistoryPage** | `frontend/src/features/history/HistoryPage.tsx` | **ACTIVE** | Lists project-scoped run summaries |
| **ExecutionPanel** | `frontend/src/features/test-prepare/ExecutionPanel.tsx` | **ACTIVE** | Now has "View Full Results" navigation |
| **ExecutionService** | `frontend/src/features/test-prepare/ExecutionService.ts` | **ACTIVE** | Calls execute-dependent, returns runId |
| **Legacy executionEngine** | `src/execution/executionEngine.js` | **LEGACY** | Uses Scenario model, called by legacy `/api/runs/execute` |
| **Legacy reportGenerator** | `src/reporting/reportGenerator.js` | **LEGACY** | HTML report generation for legacy runs |
| **Legacy storage.js** | `src/storage.js` | **LEGACY** | Flat-file storage for legacy runs (data/runs/*.json) |
| **Legacy GET /api/runs** | `src/server.js` (line 135) | **LEGACY** | Returns legacy run summaries via storage.listRunSummaries() |
| **Legacy GET /api/runs/:id** | `src/server.js` (line 147) | **LEGACY** | Returns legacy run via storage.readJson |
| **Legacy POST /api/runs/execute** | `src/server.js` (line 431) | **LEGACY** | Calls executionEngine + reportGenerator |
| **Legacy ConfigureRunPanel** | `frontend/src/features/execution/ConfigureRunPanel.tsx` | **LEGACY** | Uses Scenario types, calls `/api/runs/execute` |
| **Legacy ExecutionService** | `frontend/src/features/execution/ExecutionService.ts` | **LEGACY** | Calls `/api/runs/execute` |
| **Legacy ExecutionTypes** | `frontend/src/features/execution/ExecutionTypes.ts` | **LEGACY** | Types for old execution flow |
| **Legacy execution index** | `frontend/src/features/execution/index.ts` | **LEGACY** | Re-exports |
| **Legacy data/runs/*.json** | `data/runs/` | **LEGACY** | Flat files from old execution runs |
| **httpExecutor** | `src/execution/httpExecutor.js` | **REUSABLE** | Shared by both legacy and active executors |
| **dependencyAwareExecutor** | `src/execution/dependencyAwareExecutor.js` | **ACTIVE** | Used by execute-dependent handler |

---

## 3. FINAL CANONICAL RUN SHAPE

```json
{
  "id": "string",
  "projectId": "string",
  "title": "string",
  "description": "string",
  "status": "passed | failed",

  "testSpecification": {
    "id": "string",
    "title": "string",
    "description": "string",
    "requirementRefs": [{ "acIndex": 0, "acText": "string" }],
    "operationRefs": [{ "serviceId": "string", "operationId": "string", "method": "string", "path": "string" }],
    "expectedBehavior": { "status": 200, "responseAssertions": ["string"] }
  },

  "executionPlanSummary": {
    "target": { "serviceId": "string", "operationId": "string" },
    "stepCount": 3,
    "operations": [{ "serviceId": "string", "operationId": "string", "method": "string", "path": "string" }]
  },

  "targetOperation": { "serviceId": "string", "operationId": "string" },

  "results": [{
    "step": 0,
    "operation": { "serviceId": "string", "operationId": "string", "method": "string", "path": "string" },
    "status": "passed | failed | blocked",
    "request": { "method": "string", "url": "string", "headers": {}, "body": null },
    "response": { "status": 200, "statusText": "OK", "headers": {}, "body": {} },
    "validation": { "assertions": ["string"], "passed": true, "failed": false },
    "error": "string | undefined"
  }],

  "errors": ["string"],
  "startedAt": "ISO timestamp",
  "completedAt": "ISO timestamp",
  "durationMs": 1800
}
```

**Key properties:**
- Self-contained: has all data to render without project state
- Preserves requirement traceability via `testSpecification.requirementRefs`
- Preserves operation identity via `results[].operation`
- Preserves PASSED/FAILED/BLOCKED distinction
- Preserves already-redacted technical evidence
- No raw secrets (redacted before persistence in server.js)
- No external references that would require recomputation

---

## 4. PERSISTENCE FOLDER STRUCTURE

```
data/runs/
  {projectId}/
    {runId}.json
```

Example:
```
data/runs/
  my-project/
    spec-abc-1712345678901.json
    spec-def-1712345678902.json
  another-project/
    spec-ghi-1712345678903.json
```

**Project isolation:** Each project has its own subdirectory. `listRuns(projectId)` only reads from that project's directory. `getRun(projectId, runId)` constructs the path as `data/runs/{projectId}/{runId}.json`, so cross-project access is structurally impossible.

---

## 5. RunRepository API

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `saveRun` | `(projectId, runData)` | `{ id, projectId }` | Persists run, returns metadata |
| `getRun` | `(projectId, runId)` | `Object | null` | Full run detail or null |
| `listRuns` | `(projectId)` | `RunSummary[]` | Lightweight summaries, newest first |
| `deleteRun` | `(projectId, runId)` | `boolean` | Removes run file |

**RunSummary shape:**
```json
{
  "id": "string",
  "projectId": "string",
  "testSpecificationId": "string",
  "title": "string",
  "description": "string",
  "status": "passed | failed | unknown",
  "targetServiceId": "string",
  "targetOperationId": "string",
  "stepCount": 3,
  "passedSteps": 2,
  "failedSteps": 1,
  "blockedSteps": 0,
  "startedAt": "ISO timestamp",
  "completedAt": "ISO timestamp",
  "durationMs": 1800
}
```

---

## 6. EXECUTE-DEPENDENT PERSISTENCE BEHAVIOR

The `POST /api/runs/execute-dependent` handler in server.js:

1. Validates project, testSpecification, and executionPlan
2. Loads apiModels for request building
3. Executes via `executeTestSpecification` (dependency-aware executor)
4. **Redacts secrets** from all request/response evidence using `redactHeaders` and `redactSecretsFromObject`
5. Constructs canonical Run object with testSpecification, executionPlanSummary, results, timestamps
6. **Persists via `saveRun(projectId, runData)`**
7. Returns execution response with `runId` and `run` metadata

**Important:** A test that returns FAILED is still a successfully recorded Run. The run is persisted regardless of test outcome. Only infrastructure failures before a meaningful run can be constructed return an API error.

**One execution = at most one persisted run.** No double execution, no internal endpoint calls, no regeneration.

---

## 7. EXACT RUN API ROUTES

| Route | Method | Purpose | Active/Legacy |
|-------|--------|---------|---------------|
| `/api/active/runs?projectId={id}` | GET | List run summaries (newest first) | **ACTIVE** |
| `/api/active/runs/:runId?projectId={id}` | GET | Get full run detail | **ACTIVE** |
| `/api/runs/execute-dependent` | POST | Execute + persist run | **ACTIVE** |
| `/api/runs` | GET | Legacy run summaries (flat) | LEGACY |
| `/api/runs/:id` | GET | Legacy run detail | LEGACY |
| `/api/runs/execute` | POST | Legacy execution | LEGACY |
| `/api/runs/:id` | DELETE | Legacy run deletion | LEGACY |

**Decision:** Added clearly scoped active endpoints (`/api/active/runs`) rather than modifying legacy routes. This avoids breaking any existing consumers of the legacy `/api/runs` endpoints while providing a clean, project-scoped API for the new workflow.

---

## 8. RunSummary SHAPE

```typescript
interface RunSummary {
  id: string;
  projectId: string;
  testSpecificationId: string;
  title: string;
  description: string;
  status: "passed" | "failed" | "unknown";
  targetServiceId: string;
  targetOperationId: string;
  stepCount: number;
  passedSteps: number;
  failedSteps: number;
  blockedSteps: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}
```

**Lightweight:** Does NOT include full request/response payloads. Suitable for history list rendering.

---

## 9. ResultsPage BEHAVIOR

- Reads `runId` from URL query parameter (`?runId=...`)
- Fetches full run detail via `GET /api/active/runs/:runId?projectId={id}`
- Displays:
  - **Test title** and human-readable description
  - **Overall status** (PASSED/FAILED) with color-coded banner
  - **Step summary** (X steps · Y passed · Z failed · W blocked)
  - **Duration** and **completion timestamp**
  - **Target API** (serviceId::operationId)
  - **Execution flow** (for multi-step runs) with TARGET highlight
  - **Step details** with expandable technical details (request/response/validation)
- States: Loading, Error, Empty ("No run selected"), No project selected
- **Does NOT recompute** TestCases, matching, TestSpecification, or ExecutionPlan
- Renders only persisted evidence

---

## 10. HistoryPage BEHAVIOR

- Project-scoped: fetches runs for `activeProjectId`
- Shows newest runs first
- Each run displays:
  - **Status badge** (P/F with color)
  - **Test title**
  - **Target operation** (serviceId::operationId)
  - **Step summary** (X/Y steps passed, failed count, blocked count)
  - **Date/time** (Today/Yesterday/date format)
  - **Duration**
- Clicking a run navigates to `#results?runId={id}`
- States: Loading, Error, Empty ("No test runs yet for this project"), No project selected

---

## 11. NAVIGATION AFTER EXECUTION

After `POST /api/runs/execute-dependent` returns successfully:

1. **Inline result** still appears in ExecutionPanel (PASSED/FAILED banner + step details)
2. **"View Full Results" button** appears below the overall result banner
3. Clicking navigates to `#results?runId={runId}` which loads the ResultsPage with the persisted run
4. User is NOT automatically forced away from inline results

---

## 12. PROJECT-ISOLATION PROOF

**Tested and verified:**
- `saveRun(PROJECT_A, run)` → visible in `listRuns(PROJECT_A)`
- `listRuns(PROJECT_B)` → does NOT include PROJECT_A runs
- `getRun(PROJECT_B, "run-from-A")` → returns null
- `getRun(PROJECT_B, "run-from-B")` → returns run

**Architecture:** Each project has its own subdirectory `data/runs/{projectId}/`. The `projectDir()` function sanitizes the projectId and creates an isolated directory. `listRuns` only reads from that directory. `getRun` constructs the path with the projectId, making cross-project access structurally impossible.

---

## 13. HISTORICAL-IMMUTABILITY PROOF

**Tested and verified:**
- Historical run contains its own `testSpecification`, `executionPlanSummary`, and `results`
- No external references that would require recomputation
- JSON serialization does not contain "compute" or "recalculate" references
- Run renders correctly even if project state changes later

**Architecture:** Each persisted run is a self-contained JSON document with all data needed to render the result. Viewing historical results does NOT call:
- TestCase generation
- API matching
- TestSpecification preparation
- ExecutionPlan building
- AI services

---

## 14. SECRET-PERSISTENCE PROOF

**Tested and verified:**
- `redactHeaders()` redacts Authorization, token, secret, password, apiKey headers → `[REDACTED]`
- `redactSecretsFromObject()` redacts token/secret/password fields recursively → `[REDACTED]`
- `redactSecrets()` redacts Bearer token strings → `[AUTH_TOKEN_REDACTED]`
- Simulated server.js redaction pipeline produces safe persisted data (8 dangerous patterns verified absent)
- RunRepository faithfully stores what it receives (no accidental redaction of non-secrets)

**Architecture:** Redaction happens at the API boundary in server.js BEFORE calling `saveRun()`. The RunRepository is a simple file store that faithfully persists whatever data it receives. This means:
- The persistence boundary is safe
- The repository is simple and predictable
- Redaction logic is centralized in httpExecutor.js

---

## 15. EXAMPLE SUCCESSFUL PERSISTED RUN

```json
{
  "id": "run-passed-1",
  "projectId": "test-project-a",
  "title": "Verify user can update profile",
  "description": "Test that a logged-in user can successfully update their profile information",
  "status": "passed",
  "testSpecification": {
    "id": "spec-1",
    "title": "Verify user can update profile",
    "description": "Test that a logged-in user can successfully update their profile information",
    "requirementRefs": [{ "acIndex": 0, "acText": "User should be able to update profile" }],
    "operationRefs": [{ "serviceId": "user-service", "operationId": "updateProfile", "method": "PUT", "path": "/profile" }],
    "expectedBehavior": { "status": 200, "responseAssertions": ["profile updated successfully"] }
  },
  "executionPlanSummary": {
    "target": { "serviceId": "user-service", "operationId": "updateProfile" },
    "stepCount": 1,
    "operations": [{ "serviceId": "user-service", "operationId": "updateProfile", "method": "PUT", "path": "/profile" }]
  },
  "targetOperation": { "serviceId": "user-service", "operationId": "updateProfile" },
  "results": [{
    "step": 0,
    "operation": { "serviceId": "user-service", "operationId": "updateProfile", "method": "PUT", "path": "/profile" },
    "status": "passed",
    "request": { "method": "PUT", "url": "http://localhost:8080/profile", "headers": { "Content-Type": "application/json" }, "body": { "name": "Updated Name" } },
    "response": { "status": 200, "statusText": "OK", "headers": { "content-type": "application/json" }, "body": { "status": "profile updated successfully" } },
    "validation": { "assertions": ["status === 200", "response has body"], "passed": true, "failed": false }
  }],
  "errors": [],
  "startedAt": "2026-07-23T10:00:00.000Z",
  "completedAt": "2026-07-23T10:00:01.800Z",
  "durationMs": 1800
}
```

---

## 16. EXAMPLE FAILED/BLOCKED PERSISTED RUN

```json
{
  "id": "run-blocked-1",
  "projectId": "test-project-a",
  "title": "Verify logged-in user can update profile (3-step)",
  "description": "End-to-end test for profile update with auth dependency",
  "status": "failed",
  "testSpecification": {
    "id": "spec-3",
    "title": "Verify logged-in user can update profile (3-step)",
    "description": "End-to-end test for profile update with auth dependency",
    "requirementRefs": [{ "acIndex": 0, "acText": "User should be able to update profile" }],
    "operationRefs": [{ "serviceId": "auth-service", "operationId": "generateToken", "method": "POST", "path": "/token" }],
    "expectedBehavior": { "status": 200, "responseAssertions": [] }
  },
  "executionPlanSummary": {
    "target": { "serviceId": "user-service", "operationId": "updateProfile" },
    "stepCount": 3,
    "operations": [
      { "serviceId": "auth-service", "operationId": "generateToken", "method": "POST", "path": "/token" },
      { "serviceId": "auth-service", "operationId": "login", "method": "POST", "path": "/login" },
      { "serviceId": "user-service", "operationId": "updateProfile", "method": "PUT", "path": "/profile" }
    ]
  },
  "targetOperation": { "serviceId": "user-service", "operationId": "updateProfile" },
  "results": [
    {
      "step": 0,
      "operation": { "serviceId": "auth-service", "operationId": "generateToken", "method": "POST", "path": "/token" },
      "status": "passed",
      "request": { "method": "POST", "url": "http://localhost:8080/token", "headers": {}, "body": {} },
      "response": { "status": 200, "statusText": "OK", "headers": {}, "body": { "access_token": "[REDACTED]" } },
      "validation": { "assertions": [], "passed": true, "failed": false }
    },
    {
      "step": 1,
      "operation": { "serviceId": "auth-service", "operationId": "login", "method": "POST", "path": "/login" },
      "status": "failed",
      "request": { "method": "POST", "url": "http://localhost:8080/login", "headers": { "Authorization": "[REDACTED]" }, "body": {} },
      "response": { "status": 401, "statusText": "Unauthorized", "headers": {}, "body": { "error": "Invalid credentials" } },
      "error": "Login failed with HTTP 401.",
      "validation": { "assertions": [], "passed": false, "failed": true }
    },
    {
      "step": 2,
      "operation": { "serviceId": "user-service", "operationId": "updateProfile", "method": "PUT", "path": "/profile" },
      "status": "blocked",
      "error": "Blocked due to failed prerequisite: auth-service/login"
    }
  ],
  "errors": ["Login failed with HTTP 401."],
  "startedAt": "2026-07-23T10:10:00.000Z",
  "completedAt": "2026-07-23T10:10:02.500Z",
  "durationMs": 2500
}
```

---

## 17. TEST-DATA ISOLATION BEHAVIOR

**Architecture:** Tests use `config.dataDir` injection to redirect RunRepository to a temporary directory (`os.tmpdir()`). After tests complete, the temporary directory is deleted.

**Verified:**
- Test run files are created in `TEMP_DIR/data/runs/{projectId}/`
- No test data leaks to the original `data/runs/` directory
- Original `dataDir` is restored after tests

**Unresolved:** The `config.dataDir` mutation approach works but is not thread-safe. A proper solution would use dependency injection for the storage root. This is acceptable for the current test suite which runs sequentially.

---

## 18. LEGACY EXECUTION/REPORTING CLEANUP CLASSIFICATION

| Component | Classification | Cleanup Priority | Notes |
|-----------|---------------|-----------------|-------|
| `src/execution/executionEngine.js` | **LEGACY BUT EXTERNALLY REACHABLE** | STEP 5.9 | Called by `POST /api/runs/execute` in server.js |
| `src/reporting/reportGenerator.js` | **LEGACY BUT EXTERNALLY REACHABLE** | STEP 5.9 | Called by `POST /api/runs/execute` in server.js |
| `src/storage.js` | **LEGACY BUT EXTERNALLY REACHABLE** | STEP 5.9 | Used by legacy `/api/runs` GET/DELETE routes |
| `POST /api/runs/execute` | **LEGACY BUT EXTERNALLY REACHABLE** | STEP 5.9 | Route still exists in server.js |
| `GET /api/runs` | **LEGACY BUT EXTERNALLY REACHABLE** | STEP 5.9 | Route still exists in server.js |
| `GET /api/runs/:id` | **LEGACY BUT EXTERNALLY REACHABLE** | STEP 5.9 | Route still exists in server.js |
| `DELETE /api/runs/:id` | **LEGACY BUT EXTERNALLY REACHABLE** | STEP 5.9 | Route still exists in server.js |
| `frontend/src/features/execution/` | **SAFE TO DELETE NOW** | STEP 5.9 | Not imported by any active workflow file |
| `data/runs/*.json` (flat files) | **LEGACY** | STEP 5.9 | Old format, not compatible with project-scoped structure |

**IMPORTANT:** Do NOT delete legacy components in STEP 5.8. They are externally reachable and removal requires careful verification that no consumers depend on them. The legacy frontend components (`ConfigureRunPanel`, `ExecutionService`, `ExecutionTypes`) are safe to delete as they are not imported by the active workflow.

---

## 19. EXACT TEST/BUILD RESULTS

### Backend Tests (all pass)

| Suite | Result |
|-------|--------|
| **Run Persistence (STEP 5.8)** | **38/38 passed** |
| DependencyResolver | 7/7 passed |
| ExecutionPlan | 9/9 passed |
| RuntimeContext | 10/10 passed |
| DependencyAwareOrchestrator | 8/8 passed |
| Match (step-5.5d) | 10/10 passed |
| Prepare (step-5.5e) | 14/14 passed |
| Dependency-Aware Execution API (unit) | 26/26 passed |

### TypeScript Typecheck
- **2 errors in legacy only** (ConfigureRunPanel, ExecutionService — missing ScenarioTypes module)
- **0 errors in new workflow files** (ExecutionPanel, ExecutionService, ResultsPage, HistoryPage, RunService, App, WorkspacePage)

### Server Syntax/Startup
- ✓ Server starts successfully on port 4173

---

## 20. NEWLY DISCOVERED ISSUES

| Issue | Priority | Classification |
|-------|----------|---------------|
| Legacy `/api/runs/execute` still reachable | LOW | Pre-existing, not workflow-related |
| Legacy flat `data/runs/*.json` files coexist with new project-scoped structure | LOW | No conflict — different paths |
| `config.dataDir` mutation for test isolation is not thread-safe | NEGLIGIBLE | Acceptable for sequential test suite |
| Legacy files have TS errors (missing ScenarioTypes) | NEGLIGIBLE | Pre-existing, not workflow-related |

---

## FINAL VERDICT

**RUN PERSISTENCE + RESULTS/HISTORY: PASS**

The run persistence integration is complete:

- ✅ Canonical Run model defined and persisted
- ✅ RunRepository with project-scoped file-based storage
- ✅ execute-dependent persists exactly one run per execution
- ✅ Failed test execution still creates a run
- ✅ Active API surface: `GET /api/active/runs` and `GET /api/active/runs/:runId`
- ✅ RunSummary for lightweight history listing
- ✅ ResultsPage renders persisted run detail
- ✅ HistoryPage shows project-scoped run history
- ✅ "View Full Results" navigation after execution
- ✅ Project isolation (structural + tested)
- ✅ Historical immutability (self-contained runs)
- ✅ Secret safety (redacted before persistence)
- ✅ Test-data isolation (temporary directory)
- ✅ 38 backend persistence tests all pass
- ✅ All existing backend test suites pass
- ✅ TypeScript typecheck clean (workflow files)
- ✅ Server starts successfully
- ✅ Legacy execution/reporting classified for STEP 5.9 cleanup
- ✅ No AI used
- ✅ No TestCase regeneration
- ✅ No API rematching
- ✅ No ExecutionPlan rebuilding
- ✅ No HTML/PDF reporting added
- ✅ No new execution engine created