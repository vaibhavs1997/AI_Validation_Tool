# Sprint 02 – API Catalog Implementation Plan

## Sprint Overview

**Duration:** 1 week (5 working days)
**Team:** 1 Full-stack Engineer
**Goal:** Deliver the core Import → Parse → Review → Save → Browse workflow. Reuse existing parser and UI. Client-side search/filter only. No health checks, version management, or URL import.

---

## 1. Sprint Backlog

### P0 User Stories (Must Have)

| ID | Story | Points | Owner |
|----|-------|--------|-------|
| US-201 | Import API Collection (file upload + paste) | 5 | Frontend |
| US-202 | Parse and Validate API Specs (reuse parser) | 3 | Backend |
| US-203 | View API Catalog (browse services/operations) | 5 | Frontend |
| US-207 | Persist Catalog Across Sessions (save/load) | 3 | Backend |

### P1 User Stories (Should Have)

| ID | Story | Points | Owner |
|----|-------|--------|-------|
| US-204 | Search and Filter APIs (client-side) | 3 | Frontend |

### Out of Scope (Deferred)

- ~~Health Checks (US-205)~~
- ~~Version Management (US-206)~~
- ~~URL Import~~

**Total Points:** 19
**Target Velocity:** 20 points
**Buffer:** 1 point

---

## 2. Task Breakdown

### 2.1 Backend Tasks

#### Task B-01: Extend Parse Endpoint (Day 1)

**Description:** Enhance existing `/api/contracts/parse` to support file uploads and YAML, and add new endpoint to persist catalog to project.

**Subtasks:**
- [ ] Reuse existing `contractParser.js` - no changes needed
- [ ] Extend `/api/contracts/parse` to accept multipart/form-data file upload
- [ ] Add YAML parsing support (install `yaml` package, add to `parseJsonInput`)
- [ ] Add format detection (OpenAPI/Swagger/Postman/HAR) - reuse existing logic
- [ ] Create `POST /api/projects/:projectId/catalog` endpoint to save parsed contract
- [ ] Store catalog JSON in project storage (reuse existing `storage.saveJson`)
- [ ] Return saved contract with generated ID

**Acceptance Criteria:**
- Existing `/api/contracts/parse` works with JSON files
- New endpoint accepts file upload and saves to project
- YAML files parse correctly
- Catalog persisted and retrievable per project

**Estimate:** 3 hours
**Dependencies:** None

---

#### Task B-02: Catalog Retrieval Endpoints (Day 2)

**Description:** Create endpoints to load and delete saved catalog for a project.

**Subtasks:**
- [ ] Implement `GET /api/projects/:projectId/catalog` - returns saved contract or 404
- [ ] Implement `DELETE /api/projects/:projectId/catalog` - removes saved catalog
- [ ] Add project-scoped storage keys (e.g., `contracts/{projectId}/catalog`)
- [ ] Write integration tests

**Acceptance Criteria:**
- Saved catalog loads correctly
- 404 returned when no catalog exists
- Delete removes catalog cleanly

**Estimate:** 2 hours
**Dependencies:** B-01

---



---


---

### 2.2 Frontend Tasks

#### Task F-01: Review Before Save Dialog (Day 2-3)

**Description:** Build the "Review Before Save" dialog shown after parsing.

**Subtasks:**
- [ ] Reuse existing `ApiCollectionPanel.tsx` for initial upload/paste
- [ ] Reuse existing `ContractUploader.tsx` and `ContractPaster.tsx`
- [ ] Create `ReviewDialog.tsx` component
  - Display parsed contract summary (title, version, endpoint count)
  - Show expandable endpoint list with method badges
  - Show warnings/errors from parser
  - "Save Catalog" and "Cancel" buttons
- [ ] Add "Review Before Save" step to `ApiCollectionPanel`
- [ ] Write component tests

**Acceptance Criteria:**
- After parsing, review dialog opens automatically
- User sees full endpoint list before saving
- User can cancel and re-upload
- User can confirm and save to project

**Estimate:** 4 hours
**Dependencies:** Reuse existing components

---

#### Task F-02: Catalog Service Extension (Day 3)

**Description:** Extend frontend service to support save and load.

**Subtasks:**
- [ ] Extend `ApiCollectionService.ts` with:
  - `saveCatalog(projectId, contract)` - POST to `/api/projects/:projectId/catalog`
  - `loadCatalog(projectId)` - GET from `/api/projects/:projectId/catalog`
  - `deleteCatalog(projectId)` - DELETE
- [ ] Add TypeScript types for new responses

**Acceptance Criteria:**
- Service methods call correct endpoints
- Types match backend contract

**Estimate:** 1 hour
**Dependencies:** F-01

---

#### Task F-03: Catalog View Component (Day 4-5)

**Description:** Build main catalog listing with search/filter.

**Subtasks:**
- [ ] Create `ApiCatalogView.tsx` component
  - Header with search input
  - Service grouping (collapsible)
  - Operation list with method badges
- [ ] Create `useCatalog.ts` hook
  - Load catalog on mount
  - Client-side search/filter logic
  - Debounced search (150ms)
- [ ] Create `ServiceGroup.tsx` - collapsible service section
- [ ] Create `OperationRow.tsx` - single operation display
- [ ] Write component tests

**Acceptance Criteria:**
- Catalog displays services and operations
- Search filters in real-time
- Expand/collapse services
- Empty state when no catalog

**Estimate:** 6 hours
**Dependencies:** F-02

---

#### Task F-04: Catalog CSS and Polish (Day 5)

**Description:** Add styling for catalog view.

**Subtasks:**
- [ ] Create `api-catalog.css` with layout and component styles
- [ ] Add responsive breakpoints
- [ ] Test on mobile/tablet/desktop

**Acceptance Criteria:**
- Clean, readable layout
- Responsive at all breakpoints

**Estimate:** 2 hours
**Dependencies:** F-03

---

## 3. Daily Schedule

### Week 1

| Day | Backend | Frontend |
|-----|---------|----------|
| 1 | B-01: DB Schema | F-01: Project Structure |
| 2 | B-02: Parsers | F-02: Import Dialog |
| 3 | B-04: Import Service | F-02: Import Dialog (cont) |
| 4 | B-05: Catalog Retrieval | F-03: Catalog View |
| 5 | B-06: Search Service | F-03: Catalog View (cont) |

### Week 2

| Day | Backend | Frontend |
|-----|---------|----------|
| 6 | B-07: Health Check | F-04: Search/Filter |
| 7 | B-08: Version Mgmt | F-05: Health Summary + Empty States |
| 8 | Buffer / Bug fixes | F-07: Styling and Polish |
| 9 | Buffer / Bug fixes | F-07: Styling (cont) |
| 10 | Final API testing | F-08: E2E Tests |

---

## 4. Dependencies

### External Dependencies

| Dependency | Needed By | Risk | Mitigation |
|------------|-----------|------|------------|
| Backend API server running | F-02 | Medium | Frontend can use mock service if needed |
| Database migrations applied | B-02 | Low | Run migrations on Day 1 morning |
| File upload library (multer) | B-04 | Low | Install in Day 1 |
| YAML parser (yamljs/yaml) | B-02 | Low | Install in Day 1 |
| Postgres FTS enabled | B-06 | Low | Verify in DB setup |

### Internal Dependencies

| Dependency | Needed By | Source |
|------------|-----------|--------|
| Project Context | F-01 | Previous sprint |
| Auth token | F-01 | Auth module |
| API base URL | F-01 | Config |

---

## 5. Risk Management

### Risk 1: Complex OpenAPI Specs Fail to Parse

**Likelihood:** Medium
**Impact:** High
**Mitigation:**
- Start with common patterns (2.0, 3.0.x)
- Collect edge cases from real users
- Iterate on parsers in following sprints
- Fallback: show partial import with error report

### Risk 2: Large Files Cause Performance Issues

**Likelihood:** Medium
**Impact:** High
**Mitigation:**
- Enforce 50MB limit
- Implement streaming parse for large files
- Show progress indicator during import
- Test with 10K endpoint file early

### Risk 3: Search Too Slow

**Likelihood:** Low
**Impact:** Medium
**Mitigation:**
- Implement indexes from Day 1
- Benchmark at 10K operations on Day 5
- Fallback: in-memory search with pagination

### Risk 4: Backend Not Ready

**Likelihood:** Low
**Impact:** High
**Mitigation:**
- Frontend builds with mock service
- API contracts defined in 04_API_Contracts.md
- Backend tasks are front-loaded in sprint

---

## 6. Testing Strategy

### Unit Tests

**Backend:**
- Parsers (4 formats) – 20+ test cases each
- Validator – all validation rules
- Search service – query/filter combinations
- Health check – success/failure scenarios

**Frontend:**
- Components – render, interaction, accessibility
- Hooks – state management, API calls
- Utils – format detection, color mapping

**Coverage Target:** ≥80%

### Integration Tests

- Import → Parse → Store → Retrieve
- Search accuracy (10 sample queries)
- Health check end-to-end
- Version management

### E2E Tests

1. First import journey (file upload → catalog view)
2. Failed import recovery
3. Search and filter interactions
4. Health check workflow

---

## 7. Deployment Plan

### Staging Deployment (Day 9)

1. Run database migrations
2. Deploy backend to staging
3. Deploy frontend to staging
4. Run smoke tests
5. Load test with sample files (1K, 5K, 10K operations)

### Production Deployment (Day 10)

1. Feature flag: `catalog_enabled` (default: false)
2. Deploy backend
3. Deploy frontend
4. Enable feature flag for 10% of users
5. Monitor error rates and latency
6. Gradually increase to 100% over 24h

### Rollback Plan

- Feature flag: disable `catalog_enabled`
- Database migration rollback script ready
- Previous frontend version deployed

---

## 8. Success Criteria

### Functional

- [ ] P0 user stories all working
- [ ] P1 user stories all working
- [ ] P2 user stories working (if time permits)
- [ ] All acceptance criteria met
- [ ] All tests passing

### Performance

- [ ] Import + parse <5s for 1K operations
- [ ] Search results <100ms
- [ ] Filter updates <100ms
- [ ] Health check <30s for 100 endpoints

### Quality

- [ ] Unit test coverage ≥80%
- [ ] No critical bugs
- [ ] Accessibility audit passes (WCAG 2.1 AA)
- [ ] No console errors/warnings

### Business

- [ ] Product owner acceptance sign-off
- [ ] Demo ready for stakeholders
- [ ] Documentation updated

---

## 9. Retrospective Topics

**What went well:**
- 
**What could be improved:**
- 
**Action items for next sprint:**
- 

---

## 10. Sprint Review Demo Script

### Demo 1: First Import (2 min)

1. Navigate to Project Workspace
2. Click "Import APIs"
3. Upload `openapi.yaml`
4. Show validation result: "24 operations across 3 services"
5. Click "Import Catalog"
6. Show API Catalog with services and operations

### Demo 2: Search and Filter (1 min)

1. In API Catalog, type "payment" in search
2. Show filtered results in <100ms
3. Add filter: method = POST
4. Show further refined results
5. Clear all filters

### Demo 3: Health Check (1 min)

1. Click "Run Health Check"
2. Show progress
3. Show results: 2 services healthy, 1 degraded
4. Click degraded service card
5. Show filtered endpoints

### Demo 4: Operation Detail (1 min)

1. Click an operation row
2. Show right drawer with parameters, schemas
3. Click "Re-check Now"
4. Close drawer with Escape

---

## 11. Definition of Done

A user story is considered done when:

- [ ] Code written and reviewed
- [ ] Unit tests written and passing (≥80% coverage)
- [ ] Integration tests passing
- [ ] E2E test added (if applicable)
- [ ] Accessibility verified (keyboard nav, ARIA)
- [ ] Responsive design tested (mobile, tablet, desktop)
- [ ] Performance benchmarked
- [ ] Documentation updated (user help, dev notes)
- [ ] Deployed to staging
- [ ] Product owner acceptance

A sprint is considered done when:

- [ ] All P0 user stories done
- [ ] All P1 user stories done (if time permits)
- [ ] No critical bugs open
- [ ] Staging deployment successful
- [ ] Production deployment successful
- [ ] Retrospective completed

---

## 12. Communication Plan

### Daily Standup (15 min)

- What did you do yesterday?
- What will you do today?
- Any blockers?

### Slack Updates

- Post daily progress in `#eng-sprint-02`
- Tag @design for design reviews
- Tag @product for demo

### Design Review (Day 3)

- Show Import Dialog design
- Show API Catalog layout
- Get feedback on visual design

### Mid-Sprint Demo (Day 5)

- Demo import flow
- Demo catalog view
- Gather feedback

### Sprint Review (Day 10)

- Demo all user stories
- Q&A with stakeholders
- Retrospective