# TestForge – Product Workflow

## 1. Executive Summary

### What TestForge Is

TestForge is an **AI-powered API Quality Engineering Platform** that transforms how teams design, validate, and maintain API test suites. It combines intelligent test generation, dependency-aware execution, and requirement traceability into a single guided workflow—enabling teams to ship reliable APIs faster with less manual effort.

### Who It Is For

- **QA Engineers & SDETs** who design and maintain API test strategies
- **Backend Developers** responsible for API contract validation
- **Platform Engineers** managing CI/CD pipelines and test infrastructure
- **Engineering Managers** tracking quality metrics and release readiness
- **Enterprise Teams** requiring audit trails, compliance reporting, and cross-team visibility

### How TestForge Differs

| Tool | Primary Focus | TestForge Advantage |
|------|---------------|---------------------|
| **Postman** | Manual API exploration & ad-hoc requests | AI-driven test generation, requirement traceability, dependency awareness |
| **Swagger UI** | API documentation & exploration | Automated test scaffolding, knowledge graph, execution intelligence |
| **ReadyAPI** | Functional & performance testing | AI-first scenario generation, natural language requirement import, autonomous dependency discovery |
| **Insomnia** | API client for developers | Enterprise workflow, requirement linking, validation engine, executive reporting |

Unlike point solutions, TestForge treats API testing as an **end-to-end quality engineering discipline**—from initial API cataloging through requirements mapping, intelligent test generation, dependency-aware execution, validation, and executive reporting.

---

## 2. End-to-End User Journey

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   LOGIN                                                                 │
│     │                                                                   │
│     ▼                                                                   │
│   PROJECTS                                                              │
│     │                                                                   │
│     ▼                                                                   │
│   PROJECT WORKSPACE                                                     │
│     │                                                                   │
│     ▼                                                                   │
│   IMPORT API COLLECTION                                                 │
│     │                                                                   │
│     ▼                                                                   │
│   API CATALOG                                                           │
│     │                                                                   │
│     ▼                                                                   │
│   KNOWLEDGE ENGINE                                                      │
│     │                                                                   │
│     ▼                                                                   │
│   REQUIREMENTS                                                          │
│     │                                                                   │
│     ▼                                                                   │
│   AI TEST GENERATION                                                    │
│     │                                                                   │
│     ▼                                                                   │
│   EXECUTION PLANNING                                                    │
│     │                                                                   │
│     ▼                                                                   │
│   EXECUTION                                                             │
│     │                                                                   │
│     ▼                                                                   │
│   VALIDATION                                                            │
│     │                                                                   │
│     ▼                                                                   │
│   REPORTS                                                                │
│     │                                                                   │
│     ▼                                                                   │
│   HISTORY                                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Journey Stages

1. **Login** – Authenticate; access assigned projects
2. **Projects** – Select or create workspace
3. **Project Workspace** – Home base showing health, recent activity, and recommended next step
4. **Import API Collection** – Upload OpenAPI, Postman, Insomnia, or connect live service
5. **API Catalog** – Browse parsed endpoints, validate schemas, manage versions
6. **Knowledge Engine** – AI discovers dependencies, auth chains, data flows
7. **Requirements** – Import from Jira/Azure DevOps or manually define acceptance criteria
8. **AI Test Generation** – Generate positive, negative, boundary, security scenarios
9. **Execution Planning** – Order tests, parallelize, configure retries & variables
10. **Execution** – Run tests with real-time progress, auth reuse, and dependency ordering
11. **Validation** – Compare results against requirements, detect regressions
12. **Reports** – Executive summaries, coverage matrices, failure analysis, downloads
13. **History** – Audit trail of all executions with trend analysis

---

## 3. Module Responsibilities

### 3.1 Project Workspace

**Purpose** – Central home for a selected project. Provide immediate context, quick actions, and recommended next steps.

**Inputs** – Selected project ID, project metadata, recent activity

**Outputs** – Navigable shortcuts to API Catalog, Knowledge, Tests, Reports

**Dependencies** – ProjectContext, Execution Engine (for recent runs), API Catalog (for counts)

**Entry Point** – User selects project from Projects list

**Exit Point** – User navigates to Import, Catalog, Generate Tests, or Reports

**Success Criteria** – User understands project health within 3 seconds; can start next workflow step in 1 click

---

### 3.2 API Catalog

**Purpose** – Single source of truth for all APIs in a project. Enables browsing, validation, and preparation for test generation.

**Inputs** – OpenAPI JSON/YAML, Postman Collection, Insomnia export, live service introspection

**Outputs** – Parsed services, operations, schemas, version mappings, health status

**Dependencies** – Import Service, Knowledge Engine (for dependency hints), Project Context

**Entry Point** – "Import APIs" button or guided from Project Workspace

**Exit Point** – APIs parsed → Knowledge Engine runs → Requirements ready → Generate Tests

**Success Criteria** – 95%+ of endpoints correctly parsed; schema validation errors surfaced; version conflicts highlighted

---

### 3.3 Knowledge Engine

**Purpose** – Automatically build a dependency graph and authentication flow without user configuration.

**Inputs** – API Catalog (endpoints, schemas), sample execution data

**Outputs** – Dependency graph, auth chain map, data flow diagram, relationship confidence scores

**Dependencies** – API Catalog, Execution Engine (optional learning from real traffic)

**Entry Point** – Triggered after API import or on-demand refresh

**Exit Point** – Graph complete → confirmation dialog → feeds AI Test Generator

**Success Criteria** – >90% automatic dependency detection; <10% manual correction rate; graph persists across sessions

---

### 3.4 Requirements

**Purpose** – Map acceptance criteria and business rules to API operations for traceability.

**Inputs** – Jira issues, Azure DevOps work items, manual entries, PDF/documents (OCR)

**Outputs** – Structured requirement objects linked to operations; coverage gaps identified

**Dependencies** – API Catalog, Knowledge Engine (for related operations), External integrations

**Entry Point** – Project Workspace "Add Requirements" or auto-prompt after Knowledge Engine completes

**Exit Point** – Requirements assigned → coverage report generated → ready for AI Test Generation

**Success Criteria** – 100% of critical user journeys traced; gaps flagged; bi-directional sync with issue trackers

---

### 3.5 AI Test Generator

**Purpose** – Transform requirements + API knowledge into executable, human-readable test scenarios.

**Inputs** – Requirements, Knowledge Graph, API Catalog

**Outputs** – Test suites with positive, negative, boundary, security, authorization, and performance scenarios

**Dependencies** – Requirements module, Knowledge Engine, AI/ML service

**Entry Point** – "Generate Tests" button; auto-suggestion after requirements imported

**Exit Point** – Generated tests reviewed/approved → Execution Planner

**Success Criteria** – >85% scenario accuracy; human-readable plain-English output; editable before execution

---

### 3.6 Execution Planner

**Purpose** – Optimize test execution order considering dependencies, parallelism, and authentication reuse.

**Inputs** – Generated tests, Knowledge Graph (dependencies), environment config

**Outputs** – Execution plan (sequential/parallel), variable mapping, retry policy

**Dependencies** – AI Test Generator, Knowledge Engine, Settings

**Entry Point** – After test generation or on-demand re-plan

**Exit Point** – Plan approved → Execution Engine

**Success Criteria** – Optimal parallelization; auth tokens reused; dependency order respected; fail-fast available

---

### 3.7 Execution Engine

**Purpose** – Run planned tests against target environment with real-time monitoring and progress.

**Inputs** – Execution plan, environment config, secrets/vault

**Outputs** – Execution results (pass/fail/skip), logs, timing, artifacts

**Dependencies** – Execution Planner, Knowledge Engine (auth chains), Environments (Settings)

**Entry Point** – User triggers execution or CI/CD webhook

**Exit Point** – All tests complete → Validation Engine

**Success Criteria** – Real-time progress visible; auth chain integrity maintained; partial results available; environment health checks before run

---

### 3.8 Validation Engine

**Purpose** – Compare execution results against requirements and expected outcomes; identify regressions.

**Inputs** – Execution results, Requirements, baseline history

**Outputs** – Validation report (pass/fail per requirement), flakiness detection, regression identification

**Dependencies** – Execution Engine, Requirements, History

**Entry Point** – Post-execution auto-validation or manual re-validation

**Exit Point** – Validation complete → Reports generation

**Success Criteria** – Every requirement validated; flaky tests flagged with confidence score; regression root-cause suggested by AI

---

### 3.9 Reports

**Purpose** – Deliver actionable quality insights to technical and business stakeholders.

**Inputs** – Validation report, execution metrics, knowledge graph, history

**Outputs** – Executive Summary, Coverage Matrix, Failure Analysis, AI Insights, downloadable formats (PDF, CSV, JSON)

**Dependencies** – Validation Engine, History, AI/ML for insights

**Entry Point** – Auto-generated after validation; on-demand from History

**Exit Point** – Shared/downloaded → action items fed back to Requirements or Execution Planner

**Success Criteria** – Executive summary readable in <2 minutes; drill-down available; exportable; shareable via link

---

### 3.10 History

**Purpose** – Maintain chronological record of all executions, validations, and report snapshots.

**Inputs** – Execution results, validation outcomes, report snapshots

**Outputs** – Trend analysis, regression detection, SLA reporting, audit trail

**Dependencies** – Execution Engine, Validation Engine, Reports

**Entry Point** – Sidebar "History" nav or from Report detail view

**Exit Point** – Trend reviewed or specific execution re-run triggered

**Success Criteria** – Full-text search across runs; diff between executions; retention policy configurable

---

### 3.11 Settings

**Purpose** – Manage environments, secrets, integrations, users, and global preferences.

**Inputs** – User configuration, environment variables, API keys

**Outputs** – Configured environments, integration tokens, retention policies

**Dependencies** – All modules consume Settings for environment/auth

**Entry Point** – Top-right user menu or workspace settings gear

**Exit Point** – Changes applied immediately to dependent modules

**Success Criteria** – Centralized config; no hardcoded secrets; role-based access control; audit log of changes

---

## 4. Navigation Architecture

### Left Navigation (Workflow-Oriented)

```
┌──────────────────────────────────────┐
│  TestForge                            │
│  ───────────────────────────────────  │
│                                        │
│  🏠  Project Workspace                 │
│      ↓ "Where am I?" → Context, health │
│                                        │
│  📡  API Catalog                       │
│      ↓ "What can I test?" → Browse ops │
│                                        │
│  🧠  Knowledge Engine                  │
│      ↓ "What depends on what?" → Graph │
│                                        │
│  📋  Requirements                      │
│      ↓ "What must be true?" → Criteria │
│                                        │
│  ⚡  AI Test Generator                 │
│      ↓ "What should I verify?" → Tests │
│                                        │
│  📅  Execution Planner                 │
│      ↓ "In what order?" → Plan         │
│                                        │
│  ▶️   Execution                         │
│      ↓ "Run it." → Results             │
│                                        │
│  ✔️  Validation                        │
│      ↓ "Did we pass?" → Coverage       │
│                                        │
│  📊  Reports                           │
│      ↓ "How do we look?" → Insights    │
│                                        │
│  📜  History                           │
│      ↓ "Show me the trail" → Timeline  │
│                                        │
│  ⚙️  Settings                          │
│      ↓ "Configure platform" → Env      │
│                                        │
└──────────────────────────────────────┘
```

### Navigation Principles

- **Top = Most Frequent** – Project Workspace first; History and Settings last
- **Linear Flow** – Each item logically follows the previous; no "jump to middle" confusion
- **Breadcrumb-Aware** – User always knows where they are and what step is next
- **Recommended Next Step** – Each screen surfaces one primary CTA guiding to the next module
- **Badges & Counts** – Show unread validations, pending requirements, failed executions inline

---

## 5. Data Flow

```
Project
  │
  ▼
API Collection (Import)
  │
  ▼
Services + Operations (Parsed)
  │
  ▼
Dependencies (Knowledge Engine)
  │
  ▼
Authentication Chains (Knowledge Engine)
  │
  ▼
Data Flow Graph (Knowledge Engine)
  │
  ▼
Requirements (Manual / Jira / Azure DevOps)
  │
  ▼
Generated Tests (AI Test Generator)
  │
  ▼
Execution Plan (Execution Planner)
  │
  ▼
Execution Results (Execution Engine)
  │
  ▼
Validation (Validation Engine)
  │
  ▼
Reports (Reports Module)
  │
  ▼
History (History Module)
```

### Data Ownership

| Entity | Owner Module | Consumed By |
|--------|--------------|-------------|
| Project | Project Workspace | All |
| Service / Operation | API Catalog | Knowledge Engine, Test Generator |
| Dependency Graph | Knowledge Engine | Execution Planner, Test Generator |
| Requirement | Requirements | Test Generator, Validation, Reports |
| Test Scenario | AI Test Generator | Execution Planner |
| Execution Plan | Execution Planner | Execution Engine |
| Execution Result | Execution Engine | Validation, Reports, History |
| Validation Outcome | Validation Engine | Reports, History |
| Report | Reports | History, external sharing |
| Environment / Secret | Settings | Execution Engine, Validation |

---

## 6. Project Workspace

### Design Goal

Make the first screen after project selection actionable within 3 seconds.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: Project Name                     [+ Create Project]     │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  Quick Nav   │   Main Content Area                              │
│              │                                                  │
│  • API Cat   │   ┌──────────────────────────────────────────┐  │
│  • Knowlg     │   │ Summary Cards (Health, Coverage, etc.)   │  │
│  • Require    │   └──────────────────────────────────────────┘  │
│  • Tests      │                                                  │
│  • Execute    │   ┌──────────────────────────────────────────┐  │
│  • Reports    │   │ Quick Actions                             │  │
│              │   │ • Import APIs                              │  │
│  Recent Act   │   │ • Generate Tests                           │  │
│  • Run 123    │   │ • Run Execution                            │  │
│  • Run 122    │   │ • View Reports                             │  │
│              │   └──────────────────────────────────────────┘  │
│  Pending      │                                                  │
│  • 3 reqs     │   ┌──────────────────────────────────────────┐  │
│  • 1 fail     │   │ Recommended Next Step                     │  │
│              │   │ "Import APIs to begin test generation."     │  │
│              │   └──────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────────┘
```

### Summary Cards

| Card | Metric | Source |
|------|--------|--------|
| **API Health** | % endpoints passing last execution | Execution Engine |
| **Test Coverage** | % requirements covered by tests | Validation Engine |
| **Requirements** | Total mapped / unmapped | Requirements module |
| **Recent Health** | Last 7-day pass rate trend | History |

### Quick Actions

1. **Import APIs** – Open import dialog / file upload
2. **Generate Tests** – Trigger AI generation for unmapped requirements
3. **Run Execution** – Start latest execution plan
4. **View Reports** – Open latest executive summary

### Recent Activity

- Last 5 executions with status (pass/fail/skip)
- Last 3 requirement changes
- Last AI-generated test batch

### Project Health

- Overall status: Healthy / Degraded / Critical
- Open issues count
- Upcoming scheduled executions

### Recommended Next Step

Contextual CTA based on current state:
- No APIs imported → "Start by importing your API collection"
- APIs imported, no knowledge → "Run Knowledge Engine to discover dependencies"
- Knowledge complete, no requirements → "Add requirements to enable test generation"
- Requirements exist, no tests → "Generate tests from requirements"
- Tests exist, not executed → "Run your first execution"
- Recent failures → "Review validation report for failures"

### Empty States

- **No project selected** – Prompt to select or create project
- **Brand new project** – Welcome checklist with 4 onboarding steps
- **No recent activity** – Friendly illustration + "Import APIs to get started"

---

## 7. API Catalog

### Import

**Supported Formats**
- OpenAPI 3.0 / 3.1 (JSON & YAML)
- Postman Collection v2.1
- Insomnia Export
- Swagger 2.0
- GraphQL Schema
- gRPC Protobuf (future)

**Import Sources**
- File upload
- URL fetch (public/authenticated)
- Git repository sync
- Direct paste

### Parsing

- Extract services, endpoints, methods, paths
- Normalize parameter names and descriptions
- Resolve `$ref` schemas
- Detect version tags and info fields

### Validation

- JSON Schema validation against OpenAPI spec
- Circular `$ref` detection
- Missing required fields flagged
- Duplicate operation IDs highlighted
- Deprecated endpoint warnings

### Grouping

- Group by tag, path prefix, or domain
- User-defined service folders
- Auto-group by subdomain (e.g., `payments.api.company.com` → "Payments")

### Service Discovery

- Health check per base URL
- Response time baseline
- TLS certificate expiry (future)
- Rate limit headers parsed

### Operations

- CRUD display with method badges
- Request/response examples
- Schema explorer
- Example value generator

### Search & Filter

- Full-text search across paths, descriptions, headers
- Filter by method (GET, POST, etc.)
- Filter by tag/service
- Filter by health status

### Versioning

- Support multiple spec versions per service
- Diff view between versions
- Migration impact analysis

### Health

- Visual indicator per endpoint (green/yellow/red)
- Last checked timestamp
- Response time percentiles (p50, p95, p99)

---

## 8. Knowledge Engine

### Dependency Discovery

- **Static Analysis** – Parse request/response schemas for references to other endpoints
- **Heuristic Matching** – ID patterns, naming conventions, path segments
- **Sequence Inference** – Create → Read → Update → Delete chains
- **Manual Override** – User can draw/confirm/adjust edges

### Authentication Chains

- Detect login → token → refresh flows
- Map token propagation across services
- Identify OAuth2 implicit/auth-code flows
- Flag insecure auth patterns

### Data Flow

- Track request/response payload shapes
- Identify shared schema objects
- Map transformation steps (e.g., "User ID → Order User ID")

### Relationship Graph

- Interactive node-edge diagram
- Filter by service, environment, or depth
- Export as PNG/SVG for documentation

### AI Analysis

- Suggest likely missing dependencies
- Highlight circular dependency risks
- Recommend test ordering based on data dependencies

### Manual Confirmation

- Accept/reject AI suggestions with one click
- Add edges/notes that persist across re-analysis
- Confidence score display for each inferred relationship

### Knowledge Persistence

- Versioned snapshots per project
- Diff between knowledge iterations
- Rollback capability

---

## 9. Requirements

### Sources

#### Jira Integration
- OAuth 2.0 / API token auth
- Query issues by JQL
- Map issue fields to requirement fields (summary, description, acceptance criteria)
- Bi-directional sync: status/comment updates in TestForge ↔ Jira

#### Azure DevOps
- PAT token auth
- Query work items by WIQL
- Link test cases to requirements

#### Manual Entry
- Rich text acceptance criteria
- Image attachments
- Hierarchical epics → features → stories

#### Document Import
- PDF text extraction (requirements, specs)
- Word documents
- Excel sheets
- Markdown files

### Requirement Analysis

- Extract unique acceptance criteria from descriptions
- Suggest related API operations using NLP similarity
- Identify ambiguous or missing acceptance criteria

### Traceability

- Link requirement → operation(s) → generated test(s) → execution result(s)
- Coverage heatmap (requirement-level)
- Gap analysis (requirements without tests)

---

## 10. AI Test Generation

### Scenario Categories

| Category | Description | Example |
|----------|-------------|---------|
| **Positive** | Happy path with valid data | 200 OK on valid create |
| **Negative** | Invalid input, auth, permissions | 400 on missing field; 401 on expired token |
| **Boundary** | Min/max lengths, limits, enums | Empty string, max int, boundary dates |
| **Security** | Injection, XSS, authz bypasses | SQL injection in query param |
| **Authorization** | Role-based access matrix | Admin vs. Reader access checks |
| **Performance** | Load, stress, spike scenarios | 1000 RPS burst for 30s |
| **Dependency-Aware** | Use discovered knowledge to sequence | Create → Get → Update → Delete |

### Generation Strategy

- **Requirement-First** – Generate tests directly from acceptance criteria
- **API-First** – Generate edge cases per endpoint schema
- **Hybrid** – Combine requirement traceability with schema coverage

### Human-Readable Output

- Plain-English scenario title
- Step-by-step description
- Expected outcome
- Inline suggestions for modification

---

## 11. Execution

### Execution Plans

- **Sequential** – Preserve dependency order; ideal for stateful APIs
- **Parallel** – Independent tests run concurrently for speed
- **Hybrid** – Parallel groups within sequential stages

### Configuration

- **Variables** – Environment, data-driven loops, CSV/JSON data sources
- **Retries** – Configurable per-test or global (exponential backoff)
- **Timeouts** – Connect/read/idle timeouts
- **Authentication Reuse** – Token sharing per execution context

### Progress

- Real-time progress bar
- Live logs per test
- ETA / elapsed time
- Pause / resume (future)
- Fail-fast option

### Validation During Execution

- Schema assertion per response
- Status code check
- Header verification
- Response time SLA check
- Custom script validation

---

## 12. Reports

### 1. Executive Summary

- One-page overview for leadership
- Pass/fail rate, coverage %, critical failures
- Trend arrow vs. previous execution
- Risk rating

### 2. Coverage

- Requirements coverage matrix
- API operation coverage (hit/miss)
- Code path coverage (future with coverage tools)

### 3. Failures

- Failure categorization (auth, schema, logic, env)
- Root-cause suggested by AI
- Linked to specific requirement and operation

### 4. AI Insights

- Flaky test detection with confidence score
- Suggested test splits for parallelization
- Unused test identification
- Duplicate scenario reduction recommendations

### 5. Requirement Traceability

- Grid: Requirement ↔ Test ↔ Result
- Click-through drill-down
- Missing coverage highlighting

### 6. API Coverage

- Service-level heatmap
- Operation-level hit/miss
- Version coverage

### 7. Dependency Coverage

- Graph-based coverage of knowledge relationships
- Unvisited dependency chains

### Download Formats

- PDF (print-ready)
- CSV (tabular data)
- JSON (machine-readable)
- JUnit XML (CI integration)

### Sharing

- Secure link (email domain restriction)
- Embed in Confluence / Notion
- Export to test management tools

---

## 13. Future Roadmap

### MVP (Months 1-3)

- Login / Projects
- Project Workspace (two-column layout)
- API Catalog (OpenAPI import, search, validation)
- Knowledge Engine (basic dependency detection)
- Requirements (manual entry)
- AI Test Generation (schema-based positive/negative)
- Execution (sequential, parallel)
- Validation (schema + status)
- Reports (PDF, CSV)
- History (basic timeline)

### V2 (Months 4-6)

- Jira / Azure DevOps integration
- Advanced AI scenarios (boundary, security)
- Data-driven execution
- Environment management
- Role-based access control
- Flakiness detection
- Schedule executions
- Webhook notifications

### V3 (Months 7-12)

- Performance testing module
- GraphQL schema support
- gRPC / Protobuf
- Mobile API testing
- Visual regression for API contracts
- Advanced analytics dashboard
- Custom plugins

### Enterprise (Year 2)

- SSO / SAML / LDAP
- Audit logs & compliance
- Multi-tenant SaaS
- Market surveillance pricing tiers
- Dedicated success manager
- On-premise deployment option

### AI & Beyond (Year 2+)

- Autopilot mode: requirements → validated execution without human intervention
- Self-healing tests on contract change
- Natural language test authoring
- Predictive failure analysis
- Test suite optimization via RL

### Plugins & Marketplace

- Community test steps
- Third-party integrations (Slack, Teams, GitHub, GitLab)
- Custom assertions marketplace
- Industry-specific testpackages (payment, health, finance)

---

## 14. Product Principles

| Principle | Manifestation |
|-----------|---------------|
| **Simple** | Guided linear workflow; one primary CTA per screen; onboarding checklist |
| **Guided** | Recommended next step always visible; progressive disclosure of complexity |
| **AI-First** | AI surfaces suggestions, not decisions; human approves/adjusts |
| **Enterprise-Ready** | Audit logs, RBAC, SSO, compliance exports, SLA reporting |
| **Human-Readable** | Plain-English scenarios; executive summaries; explainable AI |
| **Automation-First** | Auto-import, auto-discovery, auto-generation before manual configuration |
| **Scalable** | Architecture supports 1000s of endpoints, 100000s of tests, multi-project orgs |
| **Extensible** | Plugin hooks, webhook triggers, custom steps, open API |
| **Transparent** | Confidence scores on AI suggestions; clear validation pass/fail reasons |
| **Accessible** | Keyboard navigation, ARIA labels, high contrast, screen reader support |

---

## 15. Success Metrics

### Time to Value

- **Time to First Test** – Minutes from project creation to first execution
- **Import Success Rate** – % of API collections parsed without manual fix

### Quality Intelligence

- **Dependency Detection Accuracy** – Precision / recall vs. manual ground truth
- **Test Generation Quality** – % of generated tests requiring human modification
- **False Positive Rate** – Validation failures that are not real bugs

### Execution Reliability

- **Execution Success Rate** – % of runs completing without infrastructure failure
- **Auth Chain Integrity** – % of executions where auth flows complete successfully
- **Flakiness Score** – % of tests with non-deterministic results

### User Productivity

- **Tests per Engineer per Week** – Generated + authored count
- **Time Saved vs. Manual Authoring** – Survey-based and telemetry
- **Reuse Rate** – % of executions using existing plans vs. new ones

### Coverage

- **API Coverage** – % of operations validated
- **Requirement Coverage** – % of acceptance criteria with at least one validation path
- **Dependency Coverage** – % of knowledge graph edges exercised

### Adoption

- **Weekly Active Projects** – Projects with ≥1 execution
- **Feature Adoption Rate** – % of users progressing beyond Import to Execution
- **Retention** – % of projects returning week over week

### Performance

- **Import Latency** – p95 time to parse 1000 endpoints
- **Generation Latency** – p95 time to generate test suite
- **Execution Duration** – p95 wall-clock time for full suite
- **Report Generation** – p95 time to render PDF

### Business

- **Net Promoter Score (NPS)** – Quarterly survey
- **Churn Rate** – % of orgs leaving per quarter
- **Support Ticket Volume** – Trend over time
- **Enterprise Expansion** – % of projects with >10 users