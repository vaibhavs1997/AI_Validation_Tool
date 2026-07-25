# Repository Hygiene Audit Report

**Audit Date:** 2026-07-25  
**Repository:** AI_Validation_Tool (TestForge)  
**Auditor:** Lead Product Architect  
**Scope:** All files in the repository  

---

## 1. Executive Summary

This audit classifies every file in the TestForge repository into four categories: **KEEP**, **MOVE**, **DELETE**, and **REVIEW**. The repository contains a mix of production code, development scripts, temporary validation files, and generated artifacts. The audit identifies 60+ files for deletion, 50+ files to keep, and 15+ files to move or review.

---

## 2. File Classification

### Legend

- **KEEP** — Production code, required documentation, build configuration, CI/CD, runtime assets
- **MOVE** — Useful utilities that belong in a better location, diagnostics, development scripts, reusable tooling
- **DELETE** — Temporary debug files, one-off validation scripts, step-based milestone files, duplicate files, dead code, generated artifacts
- **REVIEW** — Files that may still have value but require a human decision

---

### Root-Level Files

| File | Purpose | Classification | Reason | Suggested Location |
|------|---------|----------------|--------|-------------------|
| `.gitignore` | Git ignore rules | KEEP | Required for version control | Root |
| `package-lock.json` | Root-level lock file | DELETE | Root has no package.json; this is a leftover. Only `Tool/AI/package-lock.json` is needed. | N/A |
| `README.md` | Root README | REVIEW | May be a placeholder or duplicate of `Tool/AI/README.md`. Needs human review. | Root |
| `START_SERVER.BAT` | Quick-start batch script for Windows | KEEP | Useful runtime utility for starting the server | Root |
| `.github/workflows/ci.yml` | CI/CD pipeline | KEEP | Required for automated testing | `.github/workflows/` |

---

### Tool/AI — Configuration & Build Files

| File | Purpose | Classification | Reason | Suggested Location |
|------|---------|----------------|--------|-------------------|
| `.dockerignore` | Docker ignore rules | KEEP | Required for Docker builds | `Tool/AI/` |
| `.env` | Environment variables (runtime) | KEEP | Runtime config (gitignored) | `Tool/AI/` |
| `.env.example` | Environment variable template | KEEP | Template for developers | `Tool/AI/` |
| `.gitignore` | Git ignore rules | KEEP | Required for version control | `Tool/AI/` |
| `.task-progress-9lc2.json` | Task tracking for STEP 9L.2 | DELETE | Temporary task tracker for a completed step. Not needed for production. | N/A |
| `baseline.txt` | Test output baseline (STEP 10.4) | DELETE | Generated test output artifact. Temporary. | N/A |
| `docker-compose.yml` | Docker Compose configuration | KEEP | Required for containerized deployment | `Tool/AI/` |
| `Dockerfile` | Production Docker image | KEEP | Required for containerized deployment | `Tool/AI/` |
| `package.json` | Backend dependencies & scripts | KEEP | Required for Node.js backend | `Tool/AI/` |
| `package-lock.json` | Backend dependency lock file | KEEP | Required for reproducible builds | `Tool/AI/` |
| `README.md` | Backend documentation | KEEP | Required documentation | `Tool/AI/` |
| `TECHNICAL_DOCUMENTATION.md` | Technical architecture documentation | REVIEW | Comprehensive but may duplicate Sprint docs. Needs review to determine if it should be kept as reference or archived. | `Tool/AI/` or `docs/` |

---

### Tool/AI — Debug Scripts (debug-*.js)

| File | Purpose | Classification | Reason | Suggested Location |
|------|---------|----------------|--------|-------------------|
| `debug-scenarios.js` | Debugging scenario generation | DELETE | Temporary debugging script. Never imported. One-time use. | N/A |
| `debug-scenarios2.js` | Debugging scenario generation (v2) | DELETE | Temporary debugging script. Never imported. One-time use. | N/A |
| `debug-score.js` | Debugging score engine | DELETE | Temporary debugging script. Never imported. One-time use. | N/A |
| `debug-score2.js` | Debugging score engine (v2) | DELETE | Temporary debugging script. Never imported. One-time use. | N/A |
| `debug-score3.js` | Debugging score engine (v3) | DELETE | Temporary debugging script. Never imported. One-time use. | N/A |
| `debug-score4.js` | Debugging score engine (v4) | DELETE | Temporary debugging script. Never imported. One-time use. | N/A |
| `debug-score5.js` | Debugging score engine (v5) | DELETE | Temporary debugging script. Never imported. One-time use. | N/A |
| `debug-score6.js` | Debugging score engine (v6) | DELETE | Temporary debugging script. Never imported. One-time use. | N/A |

---

### Tool/AI — Step Scripts (step-*.js)

| File | Purpose | Classification | Reason | Suggested Location |
|------|---------|----------------|--------|-------------------|
| `step-5.4e-e2e-test.js` | STEP 5.4E — E2E test for Ollama generation | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `step-5.4e-register-and-test.js` | STEP 5.4E — Register and test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `step-5.10-audit.js` | STEP 5.10 — Audit | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `step-6.10-mvp-validation.js` | STEP 6.10 — MVP validation | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `step-11-2-test-depth.js` | STEP 11.2 — Test depth analysis | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `step-11.2a-test.js` | STEP 11.2A — Test (variant A) | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `step-11.2b-test.js` | STEP 11.2B — Test (variant B) | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `step-diagnose-ollama.js` | Diagnose Ollama connectivity | DELETE | One-off diagnostic script. Not part of production. | N/A |
| `step-ollama-smoke.js` | Ollama smoke test | DELETE | One-off diagnostic script. Not part of production. | N/A |
| `step-prompt-size.js` | Prompt size analysis | DELETE | One-off analysis script. Not part of production. | N/A |

---

### Tool/AI — Test Scripts (test-*.js)

#### Useful Domain/Integration Tests (KEEP)

These are focused unit/integration tests that validate production domain models and should be retained.

| File | Purpose | Classification | Reason | Suggested Location |
|------|---------|----------------|--------|-------------------|
| `test-api-project-integration.js` | API-level project setup integration tests | KEEP | Tests create/list/get project flow. Useful integration test. | `Tool/AI/` or `tests/` |
| `test-domain-API-models.js` | Unit tests for API models | KEEP | Focused tests for ServiceDefinition, ApiOperation, ApiModel. | `Tool/AI/` or `tests/` |
| `test-domain-DependencyResolver.js` | Unit tests for DependencyResolver | KEEP | Focused tests for dependency resolution. | `Tool/AI/` or `tests/` |
| `test-domain-ExecutionPlan.js` | Unit tests for ExecutionPlan | KEEP | Focused tests for execution plan model. | `Tool/AI/` or `tests/` |
| `test-domain-ProjectContext.js` | Unit tests for ProjectContext | KEEP | Focused tests for project context. | `Tool/AI/` or `tests/` |
| `test-domain-ProjectIdentity.js` | Unit tests for ProjectIdentity | KEEP | Focused tests for project identity validation. | `Tool/AI/` or `tests/` |
| `test-domain-ProjectKnowledge.js` | Unit tests for ProjectKnowledge | KEEP | Focused tests for knowledge persistence. | `Tool/AI/` or `tests/` |
| `test-domain-ProjectKnowledgeAnalyzer.js` | Unit tests for ProjectKnowledgeAnalyzer | KEEP | Focused tests for knowledge analyzer. | `Tool/AI/` or `tests/` |
| `test-domain-ProjectKnowledgeService.js` | Unit tests for ProjectKnowledgeService | KEEP | Focused tests for knowledge service. | `Tool/AI/` or `tests/` |
| `test-domain-ProjectRepository.js` | Unit tests for ProjectRepository | KEEP | Focused tests for project repository (file + PG). | `Tool/AI/` or `tests/` |
| `test-domain-RuntimeContext.js` | Unit tests for RuntimeContext | KEEP | Focused tests for runtime context. | `Tool/AI/` or `tests/` |
| `test-domain-Service-repos.js` | Unit tests for service repos | KEEP | Focused tests for service/ApiModel persistence. | `Tool/AI/` or `tests/` |
| `test-domain-TestCases.js` | Unit tests for TestCase model | KEEP | Focused tests for test case boundary and generation. | `Tool/AI/` or `tests/` |
| `test-domain-TestSpecification.js` | Unit tests for TestSpecification | KEEP | Focused tests for test specification model. | `Tool/AI/` or `tests/` |
| `test-domain-ProjectKnowledge-repos-pg-parity.js` | PG parity test for ProjectKnowledge | KEEP | Tests file vs. PostgreSQL backend consistency. | `Tool/AI/` or `tests/` |
| `test-domain-Run-repos-pg-parity.js` | PG parity test for Run | KEEP | Tests file vs. PostgreSQL backend consistency. | `Tool/AI/` or `tests/` |
| `test-domain-Service-repos-pg-parity.js` | PG parity test for Service | KEEP | Tests file vs. PostgreSQL backend consistency. | `Tool/AI/` or `tests/` |
| `test-e2e-mvp-backend.js` | E2E MVP backend test | REVIEW | May be useful as an integration test, but could also be a one-time validation. Needs review. | `Tool/AI/` or `tests/` |
| `test-e2e-validation.js` | E2E validation test | REVIEW | May be useful as an integration test, but could also be a one-time validation. Needs review. | `Tool/AI/` or `tests/` |

#### Step-Based Validation Tests (DELETE)

These are step-based milestone files (STEP 9L, STEP 10.x) that were one-time validation scripts.

| File | Purpose | Classification | Reason | Suggested Location |
|------|---------|----------------|--------|-------------------|
| `test-9l2a-debug.js` | STEP 9L.2A — Debug test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-9l2a-final.js` | STEP 9L.2A — Final test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-9l2a-invariants.js` | STEP 9L.2A — Invariants test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-9l2a-simple.js` | STEP 9L.2A — Simple test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-9l2b-audit.js` | STEP 9L.2B — Audit test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-9l2c-audit.js` | STEP 9L.2C — Audit test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-9laudit.js` | STEP 9L — Audit test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-10.9a-validation.js` | STEP 10.9A — Validation | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-v2-generator.js` | STEP 10.1 — V2 generator test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-v2-prod-flow.js` | STEP 10.4 — V2 production flow test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-v2-quality.js` | STEP 10.3 — V2 quality test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-step-5.5d-match.js` | STEP 5.5D — Match test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-step-5.5e-prepare.js` | STEP 5.5E — Prepare test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-step-5.5h-generation.js` | STEP 5.5H — Generation test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-step-5.8-run-persistence.js` | STEP 5.8 — Run persistence test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-step-5.11-regression.js` | STEP 5.11 — Regression test | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-regression.js` | STEP 10.7 — Production regression | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |

#### One-Off / Temporary Test Scripts (DELETE)

These are one-time validation or analysis scripts that are not part of the test suite.

| File | Purpose | Classification | Reason | Suggested Location |
|------|---------|----------------|--------|-------------------|
| `test-ac-index-analysis.js` | AC index analysis | DELETE | One-off analysis script. Not part of test suite. | N/A |
| `test-ai-feasibility.js` | AI feasibility test | DELETE | One-off analysis script. Not part of test suite. | N/A |
| `test-ai-regression.js` | AI regression test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-ambiguity-quality.js` | Ambiguity quality test | DELETE | One-off analysis script. Not part of test suite. | N/A |
| `test-analysis.js` | General analysis test | DELETE | One-off analysis script. Not part of test suite. | N/A |
| `test-assert.js` | Assertion test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-auth-scenarios.js` | Auth scenario test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-behavior-group.js` | Behavior group test | DELETE | One-off analysis script. Not part of test suite. | N/A |
| `test-contract.js` | Contract test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-db-foundation.js` | DB foundation test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-db-pool.js` | DB pool test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-debug.js` | Debug test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-dependency-execution.js` | Dependency execution test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-detailed-analysis.js` | Detailed analysis test | DELETE | One-off analysis script. Not part of test suite. | N/A |
| `test-execution-DependencyAwareOrchestrator.js` | Execution orchestrator test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-fingerprint.js` | Fingerprint test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-index.js` | Index test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-match.js` | Match test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-normalization.js` | Normalization test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-planner-integration.js` | Planner integration test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-product.js` | Product test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-project-repository.js` | Project repository test | DELETE | Duplicate of `test-domain-ProjectRepository.js`. Already covered. | N/A |
| `test-simple.js` | Simple pipeline test | DELETE | One-off validation script. Not part of test suite. | N/A |
| `test-after-change.js` | STEP 9L.2A — After change | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-before-change.js` | STEP 9L.2A — Before change | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-full-validation.js` | STEP 9L.2A — Full validation | DELETE | Step-based milestone file. One-time validation. Already completed. | N/A |
| `test-pipeline.js` | Pipeline test | DELETE | One-off validation script. Not part of test suite. | N/A |

---

### Tool/AI — Production Source Code (src/)

| File/Directory | Purpose | Classification | Reason | Suggested Location |
|----------------|---------|----------------|--------|-------------------|
| `src/acExtractor.js` | Acceptance criteria extractor | KEEP | Production code for parsing AC from tickets | `Tool/AI/src/` |
| `src/config.js` | Application configuration | KEEP | Production config (DB, server, etc.) | `Tool/AI/src/` |
| `src/server.js` | HTTP server | KEEP | Production backend server | `Tool/AI/src/` |
| `src/storage.js` | Storage abstraction | KEEP | Production storage layer | `Tool/AI/src/` |
| `src/contracts/` | Contract parsing modules | KEEP | Production code for API contract parsing | `Tool/AI/src/contracts/` |
| `src/db/` | Database modules | KEEP | Production database code | `Tool/AI/src/db/` |
| `src/domain/` | Domain models | KEEP | Production domain code | `Tool/AI/src/domain/` |
| `src/engine/` | Test generation engine | KEEP | Production test generation code | `Tool/AI/src/engine/` |
| `src/execution/` | Test execution modules | KEEP | Production execution code | `Tool/AI/src/execution/` |
| `src/integrations/` | Third-party integrations | KEEP | Production integration code (Jira, LLM) | `Tool/AI/src/integrations/` |
| `src/payload/` | Payload mutation engine | KEEP | Production payload generation code | `Tool/AI/src/payload/` |
| `src/repositories/` | Data repositories | KEEP | Production repository code | `Tool/AI/src/repositories/` |
| `src/scenarios/` | Scenario generation | KEEP | Production scenario code | `Tool/AI/src/scenarios/` |
| `src/validation/` | Validation modules | KEEP | Production validation code | `Tool/AI/src/validation/` |

---

### Tool/AI — Frontend

| File/Directory | Purpose | Classification | Reason | Suggested Location |
|----------------|---------|----------------|--------|-------------------|
| `frontend/index.html` | HTML entry point | KEEP | Production frontend entry point | `Tool/AI/frontend/` |
| `frontend/package.json` | Frontend dependencies | KEEP | Required for frontend build | `Tool/AI/frontend/` |
| `frontend/package-lock.json` | Frontend lock file | KEEP | Required for reproducible builds | `Tool/AI/frontend/` |
| `frontend/tsconfig.json` | TypeScript config | KEEP | Required for TypeScript compilation | `Tool/AI/frontend/` |
| `frontend/tsconfig.tsbuildinfo` | TypeScript build info | DELETE | Generated artifact. Should not be committed. | N/A |
| `frontend/vitest.config.ts` | Vitest config | KEEP | Required for frontend testing | `Tool/AI/frontend/` |
| `frontend/vite.config.ts` | Vite config | KEEP | Required for frontend build | `Tool/AI/frontend/` |
| `frontend/.task_progress.md` | Frontend task tracker | DELETE | Temporary task tracker for STEP 5.5D. Not needed for production. | N/A |
| `frontend/public/` | Static assets | KEEP | Production static assets | `Tool/AI/frontend/public/` |
| `frontend/src/` | Source code | KEEP | Production frontend source code | `Tool/AI/frontend/src/` |
| `frontend/dist/` | Build output | DELETE | Generated artifact. Should not be committed. Add to `.gitignore`. | N/A |
| `frontend/node_modules/` | Dependencies | DELETE | Generated artifact. Should not be committed. Add to `.gitignore`. | N/A |

---

### Tool/AI — Data & Assets

| File/Directory | Purpose | Classification | Reason | Suggested Location |
|----------------|---------|----------------|--------|-------------------|
| `data/projects/default.json` | Default project data | KEEP | Runtime data (gitignored) | `Tool/AI/data/` |
| `data/projects/SBD.json` | SBD project data | KEEP | Runtime data (gitignored) | `Tool/AI/data/` |
| `outputs/ai-api-validation-solution-architecture.pdf` | Solution architecture PDF | REVIEW | Generated artifact. May be useful as documentation, but could also be regenerated. Needs review. | `docs/` or `outputs/` |
| `sample-data/httpbin-test.json` | Sample API contract | KEEP | Sample data for testing | `Tool/AI/sample-data/` |
| `sample-data/jira-ticket.json` | Sample Jira ticket | KEEP | Sample data for testing | `Tool/AI/sample-data/` |
| `sample-data/openapi-refund.json` | Sample OpenAPI spec | KEEP | Sample data for testing | `Tool/AI/sample-data/` |

---

### Tool/AI — Work Directory

| File | Purpose | Classification | Reason | Suggested Location |
|------|---------|----------------|--------|-------------------|
| `work/create_ai_api_validation_pdf.js` | PDF generation script | MOVE | Useful utility script. Belongs in a `scripts/` directory. | `Tool/AI/scripts/` or `scripts/` |

---

### docs/ — Sprint Documentation

| File | Purpose | Classification | Reason | Suggested Location |
|------|---------|----------------|--------|-------------------|
| `docs/sprints/Sprint-01-Project-Foundation/*.md` (10 files) | Sprint 01 documentation | KEEP | Required documentation for Sprint 01 | `docs/sprints/Sprint-01-Project-Foundation/` |

---

## 3. Summary

### Production Files

| Category | Count |
|----------|-------|
| Source code (src/) | ~50 files |
| Frontend source (frontend/src/) | ~40 files |
| Configuration (package.json, Dockerfile, etc.) | 8 files |
| CI/CD | 1 file |
| Documentation | 12 files |
| Data (runtime) | 2 files |
| Sample data | 3 files |
| **Total Production** | **~116 files** |

### Useful Scripts (to MOVE)

| Category | Count |
|----------|-------|
| Utility scripts | 1 file |
| **Total Move** | **1 file** |

### Temporary Scripts (to DELETE)

| Category | Count |
|----------|-------|
| Debug scripts (debug-*.js) | 8 files |
| Step scripts (step-*.js) | 10 files |
| Step-based test scripts (test-step-*.js) | 7 files |
| Step-based test scripts (test-9l*.js, test-v2-*.js) | 10 files |
| One-off test scripts (test-*.js, non-domain) | 28 files |
| Task trackers (.task-progress-*.json, .task_progress.md) | 3 files |
| Test output (baseline.txt) | 1 file |
| Generated artifacts (tsconfig.tsbuildinfo, dist/, node_modules/) | 3+ items |
| Root package-lock.json | 1 file |
| **Total Delete** | **~71 files** |

### Review Required

| Category | Count |
|----------|-------|
| Documentation (TECHNICAL_DOCUMENTATION.md, README.md) | 2 files |
| Generated artifacts (PDF) | 1 file |
| E2E tests | 2 files |
| **Total Review** | **5 files** |

---

## 4. Repository Cleanup Plan

### Phase 1: Safe Deletions

Delete the following files (no risk of data loss — all are temporary/generated):

1. **Debug scripts** (8 files):
   - `debug-scenarios.js`, `debug-scenarios2.js`
   - `debug-score.js` through `debug-score6.js`

2. **Step scripts** (10 files):
   - `step-5.4e-e2e-test.js`, `step-5.4e-register-and-test.js`
   - `step-5.10-audit.js`, `step-6.10-mvp-validation.js`
   - `step-11-2-test-depth.js`, `step-11.2a-test.js`, `step-11.2b-test.js`
   - `step-diagnose-ollama.js`, `step-ollama-smoke.js`, `step-prompt-size.js`

3. **Step-based test scripts** (17 files):
   - `test-9l2a-debug.js`, `test-9l2a-final.js`, `test-9l2a-invariants.js`, `test-9l2a-simple.js`
   - `test-9l2b-audit.js`, `test-9l2c-audit.js`, `test-9laudit.js`
   - `test-10.9a-validation.js`
   - `test-v2-generator.js`, `test-v2-prod-flow.js`, `test-v2-quality.js`
   - `test-step-5.5d-match.js`, `test-step-5.5e-prepare.js`, `test-step-5.5h-generation.js`, `test-step-5.8-run-persistence.js`, `test-step-5.11-regression.js`
   - `test-regression.js`

4. **One-off test scripts** (28 files):
   - `test-ac-index-analysis.js`, `test-ai-feasibility.js`, `test-ai-regression.js`
   - `test-ambiguity-quality.js`, `test-analysis.js`, `test-assert.js`
   - `test-auth-scenarios.js`, `test-behavior-group.js`, `test-contract.js`
   - `test-db-foundation.js`, `test-db-pool.js`, `test-debug.js`
   - `test-dependency-execution.js`, `test-detailed-analysis.js`
   - `test-execution-DependencyAwareOrchestrator.js`, `test-fingerprint.js`
   - `test-index.js`, `test-match.js`, `test-normalization.js`
   - `test-planner-integration.js`, `test-product.js`, `test-project-repository.js`
   - `test-simple.js`, `test-pipeline.js`, `test-full-validation.js`
   - `test-after-change.js`, `test-before-change.js`

5. **Task trackers** (3 files):
   - `.task-progress-9lc2.json`
   - `frontend/.task_progress.md`

6. **Test output** (1 file):
   - `baseline.txt`

7. **Root package-lock.json** (1 file):
   - `package-lock.json` (root level — no root package.json)

8. **Generated artifacts**:
   - `frontend/tsconfig.tsbuildinfo`
   - `frontend/dist/` (entire directory)
   - `frontend/node_modules/` (entire directory — if committed)

### Phase 2: Move Reusable Utilities

1. Move `work/create_ai_api_validation_pdf.js` → `scripts/create_ai_api_validation_pdf.js`
2. Consider creating a `tests/` directory and moving the 18 useful `test-domain-*.js` and `test-api-*.js` files there.

### Phase 3: Rename Files

No renames needed. All production files follow consistent naming conventions.

### Phase 4: Update Documentation

1. Update `Tool/AI/.gitignore` to include:
   - `tsconfig.tsbuildinfo`
   - `dist/`
   - `node_modules/`
   - `baseline.txt`
   - `.task-progress-*.json`
   - `*.log`

2. Update root `.gitignore` to include:
   - `package-lock.json` (if root has no package.json)

3. Review `TECHNICAL_DOCUMENTATION.md` — determine if it should be archived or kept as reference.

4. Review `README.md` (root) — determine if it's a placeholder or duplicate.

5. Review `outputs/ai-api-validation-solution-architecture.pdf` — determine if it should be moved to `docs/` or deleted.

### Phase 5: Verify Build

After cleanup:

1. Run `npm install` in `Tool/AI/` to verify backend dependencies
2. Run `npm test` in `Tool/AI/` to verify tests pass (only the 18 useful domain tests remain)
3. Run `npm run build` in `Tool/AI/frontend/` to verify frontend builds
4. Run `npm test` in `Tool/AI/frontend/` to verify frontend tests pass
5. Run `docker build` to verify Docker builds
6. Verify `START_SERVER.BAT` still works

---

## 5. Key Findings

1. **71 files** are temporary/generated and should be deleted
2. **1 file** should be moved to a better location
3. **5 files** require human review
4. **~116 files** are production code and should be kept
5. The repository has a significant amount of step-based milestone files (STEP 9L, STEP 10.x) that were one-time validation scripts
6. The `frontend/node_modules/` and `frontend/dist/` directories may be committed (should be in `.gitignore`)
7. The root `package-lock.json` has no corresponding `package.json` (orphaned file)
8. The useful test suite consists of 18 `test-domain-*.js` and `test-api-*.js` files that follow a consistent pattern

---

*End of Repository Hygiene Audit Report*
