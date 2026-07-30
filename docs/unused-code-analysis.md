# Unused Code & File Analysis Report

**Date:** 2026-07-30  
**Scope:** `Tool/AI/` (backend `src/` + frontend `frontend/src/`)

---

## Summary

This report identifies unused files, unused imports, and dead code across the codebase. The analysis was performed by tracing `require()`/`import` chains from entry points (`src/server.js` for backend, `frontend/src/main.tsx` → `App.tsx` for frontend).

---

## 1. Backend — Completely Unused Files (never `require()`d in production code)

These files exist in `src/` but are **never imported** by any production code path. Some are referenced only by test scripts at the repo root.

| File | Notes |
|------|-------|
| `src/engine/coverageEngine.js` | Not imported anywhere |
| `src/engine/deduplicationEngine.js` | Not imported anywhere |
| `src/engine/gapDetector.js` | Not imported anywhere |
| `src/engine/v2ScenarioAdapter.js` | Not imported anywhere |
| `src/payload/mutationEngine.js` | Not imported anywhere |
| `src/scenarios/scenarioGenerator.js` | Only imported by `test-e2e-validation.js` (root test script) |
| `src/repositories/ProjectRepositoryPostgres.js` | Superseded by `src/domain/repositories/PostgresProjectRepository.js`; not imported by any module |
| `src/domain/ProjectContext.js` | Only imported by root test scripts (`test-domain-ProjectContext.js`, `test-domain-Service-repos.js`); not used by `server.js` or any service |

---

## 2. Backend — Unused Imports in `src/server.js`

| Import | Status |
|--------|--------|
| `createProject` (from `ProjectRepository`) | Imported but never called — server uses `getProjectService().createProject()` instead |
| `listProjects` (from `ProjectRepository`) | Imported but never called — server uses `getProjectService().listProjects()` instead |
| `getProject` (from `ProjectRepository`) | Used directly in a few POST handlers (test-cases, test-specifications, execution) — **keep** |

> `createProject` and `listProjects` from `ProjectRepository` are dead imports.

---

## 3. Backend — Standalone Scripts (not part of the application)

These are root-level test/utility scripts. They are not dead code per se, but they are **not part of the runtime application** and only serve as manual test harnesses.

| File | Notes |
|------|-------|
| `test_require.mjs` | Standalone test script |
| `test-api-project-integration.js` | Manual integration test |
| `test-api-project-rest.js` | Manual REST test |
| `test-domain-API-models.js` | Domain unit test |
| `test-domain-DependencyResolver.js` | Domain unit test |
| `test-domain-ExecutionDomain.js` | Domain unit test |
| `test-domain-ExecutionPipeline.js` | Domain unit test |
| `test-domain-ExecutionPlan.js` | Domain unit test |
| `test-domain-ExecutionRunService.js` | Domain unit test |
| `test-domain-Executor.js` | Domain unit test |
| `test-domain-Orchestrator.js` | Domain unit test |
| `test-domain-project-repository.js` | Domain unit test |
| `test-domain-ProjectContext.js` | Domain unit test |
| `test-domain-ProjectIdentity-validation.js` | Domain unit test |
| `test-domain-ProjectIdentity.js` | Domain unit test |
| `test-domain-ProjectKnowledge-repos-pg-parity.js` | Domain unit test |
| `test-domain-ProjectKnowledge.js` | Domain unit test |
| `test-domain-ProjectKnowledgeAnalyzer.js` | Domain unit test |
| `test-domain-ProjectKnowledgeService.js` | Domain unit test |
| `test-domain-ProjectRepository.js` | Domain unit test |
| `test-domain-ProjectService.js` | Domain unit test |
| `test-domain-Run-repos-pg-parity.js` | Domain unit test |
| `test-domain-RuntimeContext.js` | Domain unit test |
| `test-domain-Service-repos-pg-parity.js` | Domain unit test |
| `test-domain-Service-repos.js` | Domain unit test |
| `test-domain-TestCases.js` | Domain unit test |
| `test-domain-TestSpecification.js` | Domain unit test |
| `test-e2e-mvp-backend.js` | E2E test |
| `test-e2e-validation.js` | E2E test |
| `test-execution-workspace.js` | Domain unit test |
| `work/create_ai_api_validation_pdf.js` | One-off PDF generation utility script |

> **Recommendation:** Consider moving all `test-domain-*.js` and `test-e2e-*.js` scripts into a proper `tests/` directory and wiring them into a test runner (e.g., `node --test` or Jest). The `work/` directory is a scratch/utility folder.

---

## 4. Frontend — Completely Unused Components (never imported)

These components are **exported but never imported** by any other file in the app.

| File | Notes |
|------|-------|
| `frontend/src/components/layout/AppShell.tsx` | Never imported; `App.tsx` builds its own shell layout directly |
| `frontend/src/components/workflow/WorkflowStatus.tsx` | Never imported; referenced in comments only |
| `frontend/src/features/knowledge/KnowledgeEnginePage.tsx` | Never imported; superseded by `ProjectKnowledgePage.tsx` |
| `frontend/src/features/knowledge/KnowledgePage.tsx` | Never imported; superseded by `ProjectKnowledgePage.tsx` |
| `frontend/src/features/api-collection/ApiCollectionPanel.tsx` | Never imported; `ApiCatalogPage.tsx` uses `ContractUploader`/`ContractPaster` directly |
| `frontend/src/features/validation-scenarios/ValidationScenariosPage.tsx` | Never imported by `App.tsx` or any other page |
| `frontend/src/features/project-setup/ProjectDashboard.tsx` | Only imported by its test file (`ProjectDashboard.test.tsx`); `SetupPage.tsx` is used instead |
| `frontend/src/features/requirements/RequirementDetailPanel.tsx` | Never imported by any page (only re-exported via barrel `index.ts`) |
| `frontend/src/features/requirements/RequirementReadinessCard.tsx` | Never imported by any page (only re-exported via barrel `index.ts`) |
| `frontend/src/features/validation-scenarios/CoverageCard.tsx` | Never imported by any file |

---

## 5. Frontend — Unused Imports

| File | Import | Status |
|------|--------|--------|
| `frontend/src/App.tsx` | `TestCasesPage` from `./features/test-cases/TestCasesPage` | Imported but **never rendered** in the JSX (no `currentView === "test-cases"` branch exists) |

---

## 6. Frontend — Unused Barrel/Index Files

These barrel files exist but are **never imported** as barrel imports (all consumers import specific files directly).

| File | Notes |
|------|-------|
| `frontend/src/features/requirements/index.ts` | Re-exports many requirements components/services, but no file imports from `../requirements` or `./index` |
| `frontend/src/features/api-collection/index.ts` | Barrel file, never imported as a barrel |
| `frontend/src/features/executable-tests/index.ts` | Barrel file, never imported as a barrel |
| `frontend/src/features/execution-workspace/index.ts` | Barrel file, never imported as a barrel |
| `frontend/src/features/history/index.ts` | Barrel file, never imported as a barrel |
| `frontend/src/features/implementation-mappings/index.ts` | Barrel file, never imported as a barrel |
| `frontend/src/features/results/index.ts` | Barrel file, never imported as a barrel |
| `frontend/src/features/validation-scenarios/index.ts` | Barrel file, never imported as a barrel |
| `frontend/src/components/common/index.ts` | Barrel file, never imported as a barrel |
| `frontend/src/components/layout/index.ts` | Barrel file, never imported as a barrel |
| `frontend/src/components/workflow/index.ts` | Barrel file, never imported as a barrel |
| `frontend/src/hooks/index.ts` | Barrel file, never imported as a barrel |
| `frontend/src/services/index.ts` | Barrel file — **partially used** (some services import `apiClient` from `../../services`), but most exports unused |
| `frontend/src/utils/index.ts` | Barrel file, never imported as a barrel |

> **Note:** `services/index.ts` is the exception — it is imported via `from "../../services"` in several service files. However, many of its re-exports may be unused.

---

## 7. Frontend — Potentially Unused Type/Utility Files

| File | Notes |
|------|-------|
| `frontend/src/features/requirements/RequirementWorkflow.ts` | Type definitions for workflow; needs verification if consumed (the workflow types are also defined in `RequirementTypes.ts`) |

---

## 8. Summary Counts

| Category | Count |
|----------|-------|
| Backend unused source files | **7** |
| Backend unused imports in `server.js` | **2** |
| Backend standalone test/utility scripts | **31** |
| Frontend unused components | **10** |
| Frontend unused imports | **1** |
| Frontend unused barrel files | **13** |
| **Total unused files** | **~64** |

---

## 9. Recommendations

1. **Safe to delete** (no production impact):
   - `src/engine/coverageEngine.js`
   - `src/engine/deduplicationEngine.js`
   - `src/engine/gapDetector.js`
   - `src/engine/v2ScenarioAdapter.js`
   - `src/payload/mutationEngine.js`
   - `src/repositories/ProjectRepositoryPostgres.js`
   - `frontend/src/components/layout/AppShell.tsx`
   - `frontend/src/components/workflow/WorkflowStatus.tsx`
   - `frontend/src/features/knowledge/KnowledgeEnginePage.tsx`
   - `frontend/src/features/knowledge/KnowledgePage.tsx`
   - `frontend/src/features/api-collection/ApiCollectionPanel.tsx`
   - `frontend/src/features/validation-scenarios/CoverageCard.tsx`

2. **Safe to remove unused imports**:
   - `createProject`, `listProjects` from `server.js` imports
   - `TestCasesPage` from `App.tsx` imports

3. **Needs review before deletion** (may be used in future work or are part of a migration):
   - `src/domain/ProjectContext.js` — used only by tests, but may be intended for future use
   - `src/scenarios/scenarioGenerator.js` — used by E2E test only
   - `frontend/src/features/validation-scenarios/ValidationScenariosPage.tsx` — full page component, may be planned for routing
   - `frontend/src/features/project-setup/ProjectDashboard.tsx` — has tests, may be part of a migration from `SetupPage`
   - `frontend/src/features/requirements/RequirementDetailPanel.tsx` — re-exported via barrel
   - `frontend/src/features/requirements/RequirementReadinessCard.tsx` — re-exported via barrel

4. **Reorganize**:
   - Move all `test-domain-*.js` and `test-e2e-*.js` into a `tests/` directory
   - Move `work/` scripts into a `scripts/` directory
   - Remove or consolidate unused barrel `index.ts` files, or update imports to use them consistently