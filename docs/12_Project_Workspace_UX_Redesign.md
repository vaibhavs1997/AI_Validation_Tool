# TestForge – Project Workspace UX Redesign

## Design Philosophy

TestForge should feel like **Linear meets GitHub meets Azure DevOps**—a modern, guided, workflow-driven experience that never leaves users wondering "what do I do next?"

### Core UX Principles

1. **Single Source of Truth** – One dashboard; no disconnected pages
2. **Progressive Disclosure** – Show essentials first, details on demand
3. **Workflow-First Navigation** – Left nav follows user journey, not technical modules
4. **Actionable Everywhere** – Every screen has one clear next action
5. **State Transparency** – Users always know health, progress, and next steps
6. **Keyboard-First** – Full accessibility without sacrificing power

---

## 1. Complete Project Workspace Dashboard

### Layout: Three-Zone Workspace

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ☰  TestForge                    Project: Payments API      ⚙️  User   │
├────────────┬────────────────────────────────────────────────────────────┤
│            │  Progress Bar                                         ...% │
│  Nav       │  ┌────────────────────────────────────────────────────┐ │
│            │  │ Summary Cards (4-up grid)                            │ │
│  Workspace │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │ │
│  ▶ API Cat │  │ │ API      │ │ Test     │ │ Req      │ │ Health │ │ │
│  ▶ Knowlg  │  │ │ Coverage │ │ Coverage │ │ Coverage │ │ Score  │ │ │
│  ▶ Req     │  │ │   87%    │ │   45%    │ │   12/20  │ │   Good │ │ │
│  ▶ Tests   │  │ └──────────┘ └──────────┘ └──────────┘ └────────┘ │ │
│  ▶ Execute │  └────────────────────────────────────────────────────┘ │
│  ▶ Report  │                                                            │
│  ▶ History │  Quick Actions (4 buttons inline)                         │
│  ▶ Setting │  [Import APIs] [Generate Tests] [Run Now] [View Reports]  │
│            │                                                            │
│  Recent    │  Main Panel (contextual)                                  │
│  • Run #123 │  ┌────────────────────────────────────────────────────┐ │
│  • Run #122 │  │ Recommended Next Step + Guidance                    │ │
│  • Run #121 │  │                                                     │ │
│            │  │  "Import APIs to begin test generation."             │ │
│  Pending   │  │                                                     │ │
│  • 3 reqs  │  │  [Start Import]                                     │ │
│  • 1 fail  │  │                                                     │ │
│            │  │  Recent Activity: 0 executions yet                   │ │
│            │  └────────────────────────────────────────────────────┘ │
└────────────┴────────────────────────────────────────────────────────────┘
```

### Zone Breakdown

#### Zone A: Left Navigation (256px fixed)

- **Collapsible** to icons-only on small screens
- **Active state** with left border accent
- **Badges** for pending items (requirements, failures)
- **Hover tooltips** when collapsed

#### Zone B: Main Content (flex)

- **Top:** Workflow Progress Bar
- **Upper:** Summary Cards (4-up, responsive to 2-up on small screens)
- **Middle:** Quick Actions (inline, always visible)
- **Lower:** Contextual Main Panel (Recommendations, Activity, or Detail)

#### Zone C: Right Panel (optional, 320px)

Shown when user needs deep context:
- Selected operation details
- Test case editor
- Execution logs
- Requirement details

Hidden by default; slides in on demand.

---

## 2. Updated Navigation Architecture

### Left Navigation (Workflow Stages)

```
┌─────────────────────────────────┐
│ TestForge                        │
├─────────────────────────────────┤
│                                  │
│ 🏠  Project Workspace            │
│     State: Health, next action   │
│                                  │
│ 📡  API Catalog                  │
│     State: Imported count        │
│     Badge: 24 endpoints          │
│                                  │
│ 🧠  Knowledge Engine             │
│     State: Graph completeness    │
│     Badge: 87% complete          │
│                                  │
│ 📋  Requirements                 │
│     State: Mapped / total        │
│     Badge: 12/20 mapped          │
│                                  │
│ ⚡  AI Test Generator             │
│     State: Tests generated       │
│     Badge: 156 tests             │
│                                  │
│ 📅  Execution Planner            │
│     State: Last run status       │
│     Badge: ⚠️ Last failed         │
│                                  │
│ ▶️   Execution                    │
│     State: In progress / idle    │
│     Badge: 0 running             │
│                                  │
│ ✔️  Validation                   │
│     State: Pass rate             │
│     Badge: 94.2%                 │
│                                  │
│ 📊  Reports                      │
│     State: Latest report date    │
│     Badge: New                    │
│                                  │
│ 📜  History                      │
│     State: Last execution        │
│     Badge: 2 days ago            │
│                                  │
│ ⚙️  Settings                     │
│     State: Env count             │
│     Badge: 3 environments        │
│                                  │
└─────────────────────────────────┘
```

### Navigation Behavior

- **Persistent** across all workflow stages (not hidden)
- **Section grouping** with subtle dividers:
  - **Core Flow:** Workspace → Reports
  - **Operations:** History, Settings
- **Expandable sections** for sub-navigation where needed (e.g., API Catalog → Services, Operations, Versions)
- **Keyboard shortcut** hints (e.g., `⌘K` for command palette, `⌘/` for help)

---

## 3. Workflow Progress Component

### Purpose

Show users where they are in the end-to-end workflow and what's blocking progress.

### Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Workflow Progress                                                      │
│                                                                         │
│  ✓ Import APIs          ✓ Knowledge Engine        ▶ Requirements (12/20│
│       [24 endpoints]        [87% complete]            mapped)          │
│            │                      │                      │              │
│            ▼                      ▼                      ▼              │
│  ──────────────  ⚠️ BLOCKED HERE ──────────────────────────────────    │
│                                                                         │
│  Next: Add remaining 8 requirements to enable AI test generation.       │
│  [Add Requirements]  [Import from Jira]  [Skip for now]                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### States

| State | Visual | Meaning |
|-------|--------|---------|
| **Complete** | ✅ Green check | Stage finished; downstream stages available |
| **In Progress** | 🔵 Animated spinner | Currently running or user is editing |
| **Blocked** | ⚠️ Orange warning | Prerequisites missing; next stage disabled |
| **Skipped** | ⏭️ Gray dash | User chose to skip; can return later |
| **Error** | ❌ Red X | Stage failed; retry available |

### Interaction

- Click any completed stage to re-open its panel (context panel slides in from right)
- Blocked stages show tooltip explaining what's needed to unblock
- "Skip" allowed on optional stages (Knowledge Engine, certain Requirements)

---

## 4. Project Health Component

### Purpose

Instant visibility into project quality status without leaving the dashboard.

### Design: Health Score Ring

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ┌─────────────┐                          │
│                    │             │                          │
│                    │    87%      │                          │
│                    │   HEALTH    │                          │
│                    │             │                          │
│                    └─────────────┘                          │
│                                                             │
│  API Health        ████████░░  85% (24/28 passing)          │
│  Test Coverage     ██████░░░░  62% (12/20 reqs covered)     │
│  Req Coverage      ███████░░░  75% (15/20 mapped)           │
│  Recent Trend      █████████░  92% (last 7 days)            │
│                                                             │
│  ⚠️  2 endpoints failing health check                       │
│  ❌ 8 requirements without tests                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Sources

| Metric | Calculation | Alert Threshold |
|--------|-------------|-----------------|
| **API Health** | % endpoints returning 2xx/3xx on last execution | <80% = warning |
| **Test Coverage** | % requirements with ≥1 test | <60% = warning |
| **Req Coverage** | % endpoints linked to requirements | <70% = warning |
| **Recent Trend** | 7-day rolling pass rate | <85% = warning |

### Visual Design

- **Ring chart** with gradient color (red → yellow → green)
- **Trend arrow** (↑ ↓ →) with 7-day sparkline
- **Click-through** to Reports for drill-down

---

## 5. Quick Actions Panel

### Purpose

Provide one-touch access to the most common next actions, contextually.

### Design: Action Chips Row

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Quick Actions                                                          │
│                                                                         │
│  [Import APIs]  [Generate Tests]  [Run Execution]  [View Reports]      │
│                                                                         │
│  Suggested: Generate Tests  →  15 unmapped requirements ready          │
│  [Start Generation]                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Action Availability Matrix

| Action | Always | When APIs Imported | When Knowledge Ready | When Reqs Mapped | When Tests Generated | When Plan Ready |
|--------|--------|--------------------|----------------------|------------------|----------------------|-----------------|
| Import APIs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Generate Tests | ✓ (disabled) | ✓ (disabled) | ✓ (disabled) | ✓ | ✓ (disabled) | ✓ (disabled) |
| Run Execution | ✓ (disabled) | ✓ (disabled) | ✓ (disabled) | ✓ (disabled) | ✓ | ✓ |
| View Reports | ✓ (disabled) | ✓ (disabled) | ✓ (disabled) | ✓ (disabled) | ✓ (disabled) | ✓ |

### Primary CTA

Exactly **one** action is highlighted as primary (filled button). All others are secondary (outlined). This eliminates decision paralysis.

---

## 6. Recent Activity Panel

### Purpose

Show recent state changes, executions, and team activity.

### Design: Timeline Feed

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Recent Activity                                         View All →      │
│                                                                         │
│  ● Execution #123 completed 2 hours ago                                 │
│    Status: ✅ Passed (24/24 tests)                                      │
│    Triggered by: CI/CD pipeline                                        │
│                                                                         │
│  ● Test suite updated 5 hours ago                                       │
│    156 tests generated from 12 requirements                             │
│    By: Sarah Chen                                                      │
│                                                                         │
│  ● API import completed 1 day ago                                       │
│    24 endpoints from openapi.yaml                                       │
│                                                                         │
│  ● Knowledge Engine analysis finished 1 day ago                         │
│    87% dependency coverage; 3 manual adjustments                        │
│                                                                         │
│  ● New requirement added 2 days ago                                     │
│    "Payment webhook retries must not exceed 3 attempts"                 │
│    From: Jira PROJ-456                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Activity Types

| Type | Icon | Priority |
|------|------|----------|
| Execution completed | ▶️ | High |
| Tests generated | ⚡ | High |
| Requirement changed | 📋 | Medium |
| API imported | 📡 | Medium |
| Knowledge updated | 🧠 | Medium |
| Report shared | 📊 | Low |
| Settings changed | ⚙️ | Low |

### Interaction

- Click activity item to navigate to relevant module (e.g., execution → History)
- "View All" opens History module filtered by current project
- Hover shows precise timestamp and actor

---

## 7. Empty State Designs

### 7.1 No Project Selected (Projects Page)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                                                                         │
│                     Choose or create a project                          │
│                                                                         │
│              ┌──────────────────┐  ┌──────────────────┐                │
│              │  📁  Select       │  │  ➕  Create New   │                │
│              │  existing project│  │  project          │                │
│              └──────────────────┘  └──────────────────┘                │
│                                                                         │
│                     Recent projects appear here                        │
│                                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Brand New Project (Project Workspace)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Welcome to Payments API! Let's get you started.                      │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  1. Import APIs                               [Start]         │       │
│   │     Upload OpenAPI, Postman, or connect live service         │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  2. Run Knowledge Engine                       [Run Now]      │       │
│   │     Auto-discover dependencies and auth flows               │       │
│   │     🔒 Requires step 1                                      │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  3. Add Requirements                           [Add]          │       │
│   │     Import from Jira, Azure DevOps, or manual entry          │       │
│   │     🔒 Requires steps 1-2                                   │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  4. Generate Tests                             [Generate]     │       │
│   │     AI creates positive, negative, and boundary scenarios     │       │
│   │     🔒 Requires steps 1-3                                   │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│   Skip tour →  Start later                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 No APIs Imported (Workspace)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   📡 No APIs imported yet                                               │
│                                                                         │
│   Import your API collection to begin test generation.                  │
│                                                                         │
│   Supported formats: OpenAPI, Postman, Insomnia, Swagger               │
│                                                                         │
│   [Choose File]  [Paste URL]  [Connect Live Service]                    │
│                                                                         │
│   Or drag and drop anywhere on this page                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.4 No Tests Generated (Workspace)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   ⚡ Ready to generate tests                                             │
│                                                                         │
│   12 requirements are mapped to 24 endpoints.                           │
│   Generate tests to begin validation.                                    │
│                                                                         │
│   [Generate All Tests]  [Review Requirements First]                     │
│                                                                         │
│   Or select specific requirements: [Open Requirements →]                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.5 No Recent Activity (Workspace)

```
┌─────────────────────────────────────────────────────────────────────────
│                                                                         │
│   📊 No activity yet                                                    │
│                                                                         │
│   Start by importing APIs and running your first execution.             │
│                                                                         │
│   [Import APIs]  [Watch Demo]                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. User Journey: Project → Report

### High-Fidelity Wireframe: Workspace with Active Project

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ☰  TestForge                    Payments API              Sofia Chen ▼  │
├────────────┬────────────────────────────────────────────────────────────┤
│            │  ● Workflow Progress  87% complete                        │
│ Workspace  │  ✓ APIs ✓ Knowledge ▶ Requirements ⚡ Tests ▶ Execution   │
│ ---------  ├────────────────────────────────────────────────────────────┤
│ API Catalog│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ Knowledge  │  │ 87%      │ │ 62%      │ │ 12/20    │ │    Good   │     │
│ Requirement│  │ API Cov  │ │ Test Cov │ │ Req Cov  │ │  Health   │     │
│ AI Tests   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│ Execution  │                                                             │
│ Validation │  Quick Actions                                              │
│ Reports    │  [Import APIs] [Generate Tests] [Run Now] [View Reports]    │
│ History    │                                                             │
│ Settings   │  Recommended Next Step                                      │
│            │  ┌─────────────────────────────────────────────────────┐   │
│ Recent     │  │ 8 requirements need tests. Generate tests now.      │   │
│ • #123 ✅  │  │                                                      │   │
│ • #122 ✅  │  │  [Generate Missing Tests]  [Review Requirements]    │   │
│ • #121 ❌  │  └─────────────────────────────────────────────────────┘   │
│            │                                                             │
│ Pending    │  Recent Activity                                            │
│ • 3 reqs   │  • Run #123 completed 2h ago ✅                            │
│ • 1 fail   │  • Test suite updated 5h ago by Sarah                      │
│            │  • API import finished 1d ago                               │
└────────────┴────────────────────────────────────────────────────────────┘
```

### High-Fidelity Wireframe: API Catalog

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ☰  TestForge                    API Catalog                     ...   │
├────────────┬────────────────────────────────────────────────────────────┤
│            │  ┌─────────────────────────────────────────────────────┐   │
│ Workspace  │  │ Search: [🔍 Search endpoints, params...]  [+ Add]  │   │
│ ---------  │  │ Filter: [All methods ▾] [All services ▾] [All ▾]   │   │
│ API Catalog│  └──────────────────────────────────────────────────────┘   │
│ ---------  │                                                             │
│ ▶ Services │  ┌─────────────────────────────────────────────────────┐   │
│ ▶ 24 ops   │  │ Service: payments-api                              │   │
│ ▶ 2 bad    │  │ ┌─────────────────────────────────────────────────┐ │   │
│            │  │ │ POST /v1/payments                         200 ✅  │ │   │
│ Health     │  │ │ Creates a new payment intent                     │ │   │
│ Summary    │  │ │ Auth: Bearer Token | Rate: 45ms                   │ │   │
│            │  │ └─────────────────────────────────────────────────┘ │   │
│ 28 total   │  │ ┌─────────────────────────────────────────────────┐ │   │
│ 24 healthy │  │ │ GET /v1/payments/{id}                       200 ✅  │ │   │
│ 2 failing  │  │ │ Retrieves payment by ID                          │ │   │
│ 2 unknown  │  │ │ Auth: Bearer Token | Rate: 12ms                   │ │   │
│            │  │ └─────────────────────────────────────────────────┘ │   │
│            │  │ ... (22 more)                                       │   │
│            │  └──────────────────────────────────────────────────────┘   │
└────────────┴────────────────────────────────────────────────────────────┘
```

### High-Fidelity Wireframe: Knowledge Engine

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ☰  TestForge                    Knowledge Engine                 ...   │
├────────────┬────────────────────────────────────────────────────────────┤
│            │  Dependency Graph                                         │
│ Workspace  │  ┌─────────────────────────────────────────────────────┐   │
│ ---------  │  │                                                     │   │
│ API Catalog│  │   [Auth] ──→ [Payments] ──→ [Orders]              │   │
│ ---------  │  │      │          │           │                       │   │
│ ▶ Knowlg   │  │      ▼          ▼           ▼                       │   │
│ ▶ Graph    │  │   [Users] ──→ [Inventory] ──→ [Shipping]           │   │
│ ▶ Auth     │  │                                                     │   │
│ ▶ Data     │  │   Node colors: green=complete, yellow=partial,       │   │
│            │  │   red=missing, gray=skipped                          │   │
│ Summary    │  │                                                     │   │
│            │  │   [Zoom In] [Zoom Out] [Fit Screen] [Export PNG]     │   │
│ 87% cov    │  └─────────────────────────────────────────────────────┘   │
│            │                                                             │
│ Confidence │  Detected Relationships                                    │
│ ████████░░ │  • Payments → Orders (order ID ref) [✅ Confirm]          │
│            │  • Payments → Users (created_by) [✅ Confirm]              │
│            │  • Orders → Inventory (reserve stock) [⚠️ Low confidence]  │
│            │  • Shipping → Users (address lookup) [⏭️ Skip]            │
│            │                                                             │
│            │  [Re-run Analysis]  [Manual Add Relationship]              │
└────────────┴────────────────────────────────────────────────────────────┘
```

### High-Fidelity Wireframe: Requirements

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ☰  TestForge                    Requirements                      ...   │
├────────────┬────────────────────────────────────────────────────────────┤
│            │  ┌─────────────────────────────────────────────────────┐   │
│ Workspace  │  │ Total: 20 | Mapped: 12 | Unmapped: 8               │   │
│ ---------  │  │ Filter: [All ▾] [Mapped] [Unmapped] [From Jira]     │   │
│ API Catalog│  │ Search: [🔍 Search requirements...]  [+ Add]        │   │
│ ---------  │  └──────────────────────────────────────────────────────┘   │
│ Knowledge  │                                                             │
│ ---------  │  ┌─────────────────────────────────────────────────────┐   │
│ ▶ Reqs     │  │ REQ-001  ✅ Mapped                  Payment create   │   │
│ ▶ 20 total │  │ "Payment intent must be created with valid..."       │   │
│ ▶ 12 mapped│  │ Operations: POST /v1/payments                        │   │
│            │  │ Tests: 4 | Coverage: 100%                             │   │
│            │  └─────────────────────────────────────────────────────┘   │
│            │                                                             │
│ Sources    │  ┌─────────────────────────────────────────────────────┐   │
│ • Jira 12  │  │ REQ-002  ⚠️ Unmapped                Payment retry   │   │
│ • Manual 8 │  │ "Failed payments should retry up to 3 times"         │   │
│            │  │ Operations: —                                         │   │
│            │  │ Tests: 0 | Coverage: 0%                               │   │
│            │  │                                                    [Map]│   │
│            │  └─────────────────────────────────────────────────────┘   │
│            │                                                             │
│            │  ... (18 more)                                              │
└────────────┴────────────────────────────────────────────────────────────┘
```

### High-Fidelity Wireframe: Execution

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ☰  TestForge                    Execution                         ...   │
├────────────┬────────────────────────────────────────────────────────────┤
│            │  Plan: Production Run #124                                 │
│ Workspace  │  Status: ▶ Running (14/24 tests complete)                  │
│ ---------  │  ETA: 4m 23s remaining                                     │
│ API Catalog│                                                             │
│ ---------  │  ┌─────────────────────────────────────────────────────┐   │
│ Knowledge  │  │ ▶ POST /v1/payments               ✅ Pass  450ms    │   │
│ ---------  │  │ ▶ GET /v1/payments/{id}           ✅ Pass  120ms    │   │
│ ▶ Execute  │  │ ▶ POST /v1/payments/{id}/refund   ⏳ Running...    │   │
│ ▶ Running  │  │ ⏸ POST /v1/refunds                Pending         │   │
│ ▶ Log      │  │ ⏸ GET /v1/balance                 Pending         │   │
│ ▶ History  │  │ ... (19 more)                                        │   │
│            │  └─────────────────────────────────────────────────────┘   │
│ Config     │                                                             │
│ Env: prod  │  Environment: production (us-east-1)                       │
│ Retries: 3 │  Auth: Reusing token from /auth/login (expires in 23m)     │
│ Parallel: 8│                                                             │
│            │  [Pause]  [Stop]  [Open Logs]  [View Plan]                 │
└────────────┴────────────────────────────────────────────────────────────┘
```

### High-Fidelity Wireframe: Reports

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ☰  TestForge                    Reports                           ...   │
├────────────┬────────────────────────────────────────────────────────────┤
│            │  Executive Summary                                         │
│ Workspace  │  ┌─────────────────────────────────────────────────────┐   │
│ ---------  │  │                                                     │   │
│ API Catalog│  │   Run: #123  |  2025-01-15 14:32 UTC               │   │
│ ---------  │  │   Triggered by: CI/CD (main branch)                 │   │
│ Knowledge  │  │                                                     │   │
│ ---------  │  │   Result: ✅ PASSED                                 │   │
│ ▶ Report   │  │   24/24 tests passed                                │   │
│ ▶ Summary  │  │   Duration: 6m 42s                                  │   │
│ ▶ Coverage │  │                                                     │   │
│ ▶ Failures │  │   Coverage: 94.2% API, 60% Requirements            │   │
│ ▶ Insights │  │                                                     │   │
│            │  │   Trend: ↑ +2.3% vs last run                       │   │
│ Tabs       │  └─────────────────────────────────────────────────────┘   │
│            │                                                             │
│ Export     │  [View Details]  [Download PDF]  [Share]                    │
│ [PDF] [CSV]│                                                             │
│            │  ─────────────────────────────────────────────────────────  │
│            │                                                             │
│            │  Coverage Heatmap                                          │
│            │  ┌─────────────────────────────────────────────────────┐   │
│            │  │ Service     | Endpoints | Tested | Coverage        │   │
│            │  │ payments    │    12     │   12   │  100%  ████████ │   │
│            │  │ authentication│  6     │    5   │   83%  ██████░░ │   │
│            │  │ inventory   │     8     │    3   │   38%  ██░░░░░░ │   │
│            │  └─────────────────────────────────────────────────────┘   │
└────────────┴────────────────────────────────────────────────────────────┘
```

---

## 9. Project Health Component

### Visual Design: Health Score Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Project Health                                          Last 7 days ↓   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │                                                             │       │
│   │                     Overall: GOOD (87%)                     │       │
│   │                                                             │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│  API Health        Test Coverage      Req Coverage      Trend           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐   │
│  │  ████████░░  │  │  ██████░░░░  │  │  ███████░░░  │  │  ↑ 92%   │   │
│  │    85%       │  │    62%       │  │    75%       │  │  +2.3%    │   │
│  │  24/28 pass  │  │  12/20 cov   │  │  15/20 map    │  │  vs prev  │   │
│   └──────────────┘   └──────────────┘   └──────────────┘   └───────────┘   │
│                                                                         │
│  ⚠️  Alerts (2)                                                         │
│  • 2 endpoints failing health check (see API Catalog)                   │
│  • 8 requirements without tests (generate tests)                        │
│                                                                         │
│  Open Issues                                                             │
│  • 1 failing execution (Run #121)                                       │
│  • 3 outdated dependencies                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Interaction

- Click any metric card → detailed module view (e.g., API Health → API Catalog filtered to failing endpoints)
- Alerts are actionable: click to navigate to fix
- Trend sparkline shows 7-day rolling window

---

## 10. Empty State Designs

### 10.1 No Project Selected (Landing)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                                                                         │
│                     Welcome to TestForge                                │
│                                                                         │
│             The AI-powered API Quality Engineering Platform            │
│                                                                         │
│                                                                         │
│              ┌──────────────────────────────────────────┐               │
│              │  📁  Select an existing project             │               │
│              │      Choose from your organization         │               │
│              └──────────────────────────────────────────┘               │
│                                                                         │
│              ┌──────────────────────────────────────────┐               │
│              │  ➕  Create a new project                   │               │
│              │      Start fresh with guided setup         │               │
│              └──────────────────────────────────────────┘               │
│                                                                         │
│                                                                         │
│   Recent projects:                                                      │
│   • Payments API (active 2h ago)                                        │
│   • Auth Service (last active 3d ago)                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Brand New Project (Onboarding)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   🎉 Welcome to Payments API!                                            │
│                                                                         │
│   Complete these 4 steps to start testing:                              │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  1. Import APIs                               [Start]         │       │
│   │     Upload OpenAPI, Postman, or connect a live service       │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  2. Run Knowledge Engine                       [Run Now]      │       │
│   │     Auto-discover dependencies and authentication flows      │       │
│   │     🔒 Requires step 1                                      │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  3. Add Requirements                           [Add]          │       │
│   │     Import from Jira, Azure DevOps, or manual entry          │       │
│   │     🔒 Requires steps 1-2                                   │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  4. Generate Tests                             [Generate]     │       │
│   │     AI creates positive, negative, and boundary scenarios     │       │
│   │     🔒 Requires steps 1-3                                   │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│   Skip tour →  I'll explore myself                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.3 No APIs (Workspace)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                                                                         │
│                     📡                                                │
│                                                                         │
│                     No APIs imported yet                                │
│                                                                         │
│   Import your API collection to begin智能测试 generation.            │
│                                                                         │
│   Supported formats:                                                    │
│   OpenAPI 3.0/3.1  •  Postman Collection  •  Insomnia Export            │
│   Swagger 2.0  •  GraphQL Schema  •  gRPC (future)                     │
│                                                                         │
│                                                                         │
│   [Choose File]  [Paste URL]  [Connect Live Service]                    │
│                                                                         │
│   Or drag and drop anywhere on this page                                │
│                                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.4 No Tests Generated (Workspace)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                     ⚡                                                 │
│                                                                         │
│                     Ready to generate tests                             │
│                                                                         │
│   12 requirements are mapped to 24 endpoints.                           │
│   Generate tests to begin validation.                                    │
│                                                                         │
│   [Generate All Tests]  [Review Requirements First]                     │
│                                                                         │
│   Or select specific requirements:                                      │
│   [Open Requirements →]                                                  │
│                                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.5 No Activity Yet (Workspace)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                     📊                                                 │
│                                                                         │
│                     No activity yet                                     │
│                                                                         │
│   Start by importing APIs and running your first execution.             │
│                                                                         │
│   [Import APIs]  [Watch 2-min Demo]                                     │
│                                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.6 All Tests Passing (Reports)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                     ✅                                                 │
│                                                                         │
│                     All tests passing!                                  │
│                                                                         │
│   Run #123 completed with 100% success rate.                            │
│   24/24 tests passed | Coverage: 94.2% API, 60% Requirements          │
│                                                                         │
│   [View Report]  [Run Again]  [Share]                                   │
│                                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.7 Execution Failed (Workspace)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                     ❌                                                 │
│                                                                         │
│                     Execution failed                                    │
│                                                                         │
│   Run #121 failed at 14:32 UTC                                          │
│   20/24 tests passed | 3 failed | 1 skipped                             │
│                                                                         │
│   Common causes:                                                        │
│   • Authentication token expired                                        │
│   • Environment variable missing                                         │
│   • API endpoint unreachable                                            │
│                                                                         │
│   [View Failures]  [Re-run with Fixes]  [Download Logs]                 │
│                                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Component Specifications

### 11.1 Project Workspace (Main Layout)

**Component:** `ProjectWorkspace`

**Props:**
- `projectId: string`
- `projectName: string`
- `children: ReactNode` (main content area)

**State (from ProjectContext):**
- `selectedProjectId: string | null`
- `selectedProject: Project | null`

**Subcomponents:**
- `WorkflowProgress` – Step indicator
- `SummaryCards` – 4-up metric cards
- `QuickActions` – Contextual CTA row
- `RecommendedNextStep` – Primary guidance banner
- `RecentActivity` – Timeline feed
- `PendingWork` – Alerts and blockers

### 11.2 Workflow Progress

**Component:** `WorkflowProgress`

**Props:**
- `stages: WorkflowStage[]`
- `currentStage: string`

**Stage interface:**
```typescript
interface WorkflowStage {
  id: string;
  label: string;
  status: 'complete' | 'in_progress' | 'blocked' | 'skipped' | 'error';
  description?: string;
  metric?: string; // e.g., "24 endpoints"
}
```

**Behavior:**
- Horizontal step indicator
- Click completed stage → navigate to module
- Blocked stages show tooltip with unlock criteria
- Current stage highlighted with pulse animation

### 11.3 Summary Cards

**Component:** `SummaryCards`

**Cards:**
1. `ApiCoverageCard` – % endpoints tested
2. `TestCoverageCard` – % requirements covered
3. `RequirementCoverageCard` – mapped / total
4. `HealthScoreCard` – ring chart + trend

**Behavior:**
- Responsive grid: 4-up → 2-up → 1-up
- Click card → navigate to detail module
- Hover shows tooltip with breakdown

### 11.4 Quick Actions

**Component:** `QuickActions`

**Props:**
- `actions: QuickAction[]`
- `primaryAction: QuickAction`

**Action interface:**
```typescript
interface QuickAction {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
}
```

**Behavior:**
- Primary action: filled button
- Secondary actions: outlined buttons
- Disabled: opacity 0.5, no hover
- Badge: small notification count

### 11.5 Recommended Next Step

**Component:** `RecommendedNextStep`

**Props:**
- `title: string`
- `description: string`
- `primaryAction: { label: string; onClick: () => void }
- `secondaryActions?: Array<{ label: string; onClick: () => void }>

**Behavior:**
- Banner-style with left border accent
- Contextual based on workflow state
- Exactly one primary action
- Optional secondary actions (less prominent)

### 11.6 Recent Activity

**Component:** `RecentActivity`

**Props:**
- `activities: Activity[]`
- `maxItems?: number`

**Activity interface:**
```typescript
interface Activity {
  id: string;
  type: 'execution' | 'test_generated' | 'requirement_added' | 'api_imported' | 'knowledge_updated' | 'report_shared';
  title: string;
  description: string;
  timestamp: Date;
  actor?: string;
  status?: 'success' | 'warning' | 'error';
  link?: string;
}
```

**Behavior:**
- Sorted by timestamp descending
- Click navigates to related module
- Hover shows exact time
- "View All" link opens History filtered to project

### 11.7 Project Health

**Component:** `ProjectHealth`

**Props:**
- `metrics: HealthMetrics`

**Behavior:**
- Ring chart with gradient
- Trend sparkline (7-day)
- Clickable cards for drill-down
- Alert badges for failures

### 11.8 Pending Work

**Component:** `PendingWork`

**Props:**
- `items: PendingItem[]`

**Behavior:**
- Alert icon + count
- Click opens filter in relevant module
- Dismissable (mark as "will fix later")

---

## 12. Navigation Routes (Post-Project Setup)

```
/workspace/:projectId
  → ProjectWorkspace (home after project selection)

/catalog/:projectId
  → ApiCatalog (import, browse, validate APIs)

/knowledge/:projectId
  → KnowledgeEngine (dependency graph, auth flows)

/requirements/:projectId
  → Requirements (list, add, traceability)

/tests/:projectId
  → TestGenerator (generate, review, edit tests)

/plan/:projectId
  → ExecutionPlanner (order, parallelize, configure)

/execute/:projectId
  → Execution (run, monitor, logs)

/validate/:projectId
  → Validation (compare, coverage, regressions)

/reports/:projectId
  → Reports (executive summary, downloads)

/history/:projectId
  → History (timeline, trends, rerun)

/settings
  → Settings (global, environments, integrations)

```

---

## 13. Dark/Light Theme & Accessibility

- All colors use CSS custom properties
- High contrast ratios (WCAG 2.1 AA)
- Focus indicators on all interactive elements
- `aria-labels` on icon-only buttons
- Keyboard navigation: `Tab` order logical; `Enter`/`Space` activate; `Escape` closes modals
- `role` attributes on custom widgets
- `aria-live` regions for dynamic updates (execution progress, new alerts)

---

## 14. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| **>= 1200px** | Full 3-zone layout |
| **1024-1199px** | Left nav collapses to icons; main content expands |
| **768-1023px** | Main content stacks vertically; right panel hidden by default |
| **< 768px** | Single column; bottom navigation bar; full-width cards; no side panels |

---

## 15. Implementation Notes

### Phase 1: Core Layout (Week 1)

- [ ] Implement 3-zone layout with fixed header/nav
- [ ] Build `WorkflowProgress` component
- [ ] Build `SummaryCards` with mock data
- [ ] Implement responsive breakpoints

### Phase 2: Quick Actions & Empty States (Week 2)

- [ ] Build `QuickActions` with contextual availability
- [ ] Implement all empty states
- [ ] Add onboarding tour (4 steps)

### Phase 3: Panels & Polish (Week 3)

- [ ] Build `RecentActivity` with real data
- [ ] Build `ProjectHealth` ring chart
- [ ] Implement `RecommendedNextStep`
- [ ] Add keyboard shortcuts
- [ ] Refine animations and transitions

### Phase 4: Content Modules (Week 4+)

- [ ] API Catalog (list, search, detail)
- [ ] Knowledge Engine (graph visualization)
- [ ] Requirements (list, traceability)
- [ ] Test Generator (review, edit)
- [ ] Execution (monitor, logs)
- [ ] Reports (executive, drill-down)
- [ ] History (timeline, trends)

---

## 16. Anti-Patterns to Avoid

❌ **Disconnected pages** – Every screen must connect to the workflow
❌ **Decision paralysis** – Never show >3 primary actions
❌ **Dead ends** – Always show "what's next"
❌ **Hidden state** – Health and progress must be visible at a glance
❌ **Modal overload** – Use inline panels before modals
❌ **Generic empty states** – Every empty state must be actionable
❌ **Navigation sprawl** – Left nav stays fixed; no nested mega-menus
❌ **Data dumping** – Show summaries, drill-down on demand
❌ **Ignoring keyboard** – Every action must be keyboard accessible
❌ **Theme breaking** – Respect light/dark/high-contrast everywhere

---

## 17. Success Criteria

### Usability

- New user reaches first API import in <60 seconds
- New user reaches first execution in <10 minutes
- Users can complete core workflow without documentation

### Engagement

- >80% of users complete onboarding tour
- >60% of users progress to Execution within first week
- <5% drop-off at any stage

### Performance

- Dashboard loads in <1s
- Navigation switches in <200ms
- Search results in <100ms

### Accessibility

- WCAG 2.1 AA compliance
- Full keyboard navigation verified
- Screen reader tested with NVDA/VoiceOver

---

## 18. Wireframe Legend

```
┌─────────────────────────────┐
│ Header / Title bar          │
├────────────┬────────────────┤
│ Sidebar    │ Main Content   │
│ (fixed)    │ (scrollable)   │
└────────────┴────────────────┘

[Button]        – Primary action
[Button]        – Secondary action
[Disabled]      – Unavailable action
🔍 Search       – Search input field
📊 Metric       – Data/KPI display
⚠️ Alert        – Warning message
✅ Success      – Success state
❌ Error        – Error state
🔒 Locked       – Prerequisite not met
▶ Active        – Current/selected item
📁 Folder       – Navigation group
💡 Tip          – Helpful hint
📋 List         – Content list
📈 Sparkline    – Trend graph
```

---

## Appendix: ASCII Design System

### Colors (Semantic)

```
Primary:    ████████  Blue (#2563eb)
Success:    ████████  Green (#16a34a)
Warning:    ████████  Orange (#f59e0b)
Error:      ████████  Red (#dc2626)
Info:       ████████  Sky (#0ea5e9)
Background: ░░░░░░░░  White / Dark (#0a0a0a)
Surface:    ▒▒▒▒▒▒▒▒  Light gray / Dark gray (#171717)
Border:     ▓▓▓▓▓▓▓▓  Gray (#e5e7eb / #333333)
Text:       ████████  Near-black / White
Muted:      ▒▒▒▒▒▒▒▒  Mid-gray (#6b7280)
```

### Spacing Scale

```
xs = 4px   (0.25rem)
sm = 8px   (0.5rem)
md = 16px  (1rem)
lg = 24px  (1.5rem)
xl = 32px  (2rem)
2xl = 48px (3rem)
```

### Typography Scale

```
Display:  2.5rem / 40px (bold)   – Page titles
H1:       1.875rem / 30px (bold) – Section headers
H2:       1.5rem / 24px (semibold) – Card titles
H3:       1.25rem / 20px (semibold) – Subtitles
Body:     1rem / 16px (regular)  – Main content
Small:    0.875rem / 14px (medium) – Captions, helper text
Caption:  0.75rem / 12px (regular) – Timestamps, metadata
```

### Border Radius

```
sm:  4px   – Inputs, small buttons
md:  8px   – Cards, panels
lg:  12px  – Modals, large containers
full: 9999px – Pills, avatars