# TestForge — Technical Documentation

## System Architecture

TestForge is a full-stack web application for AI-assisted API validation. It consists of a React frontend and a Node.js backend, communicating via REST APIs.

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (Client)                       │
│  React 18 + TypeScript + Vite + CSS Custom Properties    │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP / JSON
                         ▼
┌──────────────────────────────────────────────────────────┐
│              Node.js HTTP Server (src/server.js)          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  REST API   │  │ Static Files │  │  SPA Fallback  │  │
│  │  /api/*     │  │ /dist/*      │  │  → index.html  │  │
│  └──────┬──────┘  └──────────────┘  └────────────────┘  │
└─────────┼────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────┐
│                    Domain Layer                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Projects │ │ Services │ │Knowledge │ │   Runs   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
└───────┼────────────┼────────────┼────────────┼──────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌──────────────────────────────────────────────────────────┐
│                   Engine Layer                            │
│  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Test Case    │ │ Matching │ │Execution │ │Validat.│ │
│  │ Generation   │ │ Engine   │ │Engine    │ │Engine  │ │
│  └──────────────┘ └──────────┘ └──────────┘ └────────┘ │
└──────────────────────────────────────────────────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌──────────────────────────────────────────────────────────┐
│                 Persistence Layer                         │
│  ┌─────────────────────────┐  ┌──────────────────────┐   │
│  │   File System (JSON)    │  │   PostgreSQL (opt)   │   │
│  └─────────────────────────┘  └──────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## React Frontend Architecture

### Technology Stack

- **React 18** with Strict Mode
- **TypeScript** for type safety
- **Vite** for development server and production builds
- **CSS Custom Properties** for theming (no CSS-in-JS)
- **Inline SVG** for icons (no external icon library)
- **Vitest** for unit testing

### Directory Structure

```
frontend/src/
├── components/          # Shared layout components
│   ├── layout/
│   │   ├── Sidebar.tsx  # Navigation sidebar with brand
│   │   └── Header.tsx   # Top bar with theme switcher
│   └── workflow/        # Workflow status components
├── features/            # Feature modules (domain-driven)
│   ├── project-setup/   # Project creation and selection
│   ├── workspace/       # Main workspace page
│   ├── results/         # Execution results
│   ├── history/         # Run history
│   ├── requirements/    # Jira/manual requirement input
│   ├── test-cases/      # Test case review
│   ├── test-prepare/    # Test preparation and execution
│   ├── api-collection/  # API contract upload/paste
│   ├── api-matching/    # Test-to-API matching
│   └── runs/            # Run service
├── services/            # API client and service layer
│   └── ApiClient.ts     # Generic fetch-based API client
├── styles/
│   └── index.css        # Global CSS with design tokens
├── types/
│   └── index.ts         # TypeScript type definitions
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
├── App.tsx              # Root component with routing
└── main.tsx             # Application entry point
```

### Component Tree

```
<App>
  <div.app-shell>
    <Sidebar />           ← Navigation with brand + nav groups
    <div.main-shell>
      <Header />          ← Badge + title + theme switcher
      <main.app-content>
        <SetupPage />     ← Project selection/creation
        <WorkspacePage /> ← Main workspace (services, tests, execution)
        <ResultsPage />   ← Execution results
        <HistoryPage />   ← Run history
      </main>
    </div>
  </div>
</App>
```

### Theming System

The application uses CSS custom properties for a complete light/dark theme system:

- **Light theme**: `#F7F8FC` background, `#FFFFFF` surfaces, `#6D5DFB` primary
- **Dark theme**: `#0F172A` background, `#182235` surfaces, `#8B7CFF` primary
- Theme persisted in `localStorage` under key `testforge-theme`
- Default follows `prefers-color-scheme` media query
- All theme variables defined in `frontend/src/styles/index.css`

### State Management

The application uses React's built-in `useState` and `useEffect` hooks. There is no external state management library. State flows through:

1. **App.tsx** — Holds `currentView` and `activeProjectId` as top-level state
2. **Feature components** — Each feature manages its own local state
3. **Services** — API calls return promises consumed by components

---

## Backend Architecture

### Technology Stack

- **Node.js 20+** with built-in `http` module
- **No Express** — pure Node.js HTTP server
- **File-based persistence** by default
- **PostgreSQL** support via `pg` package (optional)
- **Jira REST API** integration
- **AI/LLM API** integration (OpenAI-compatible)

### Server Structure

The server (`src/server.js`) is a single-file HTTP server that:

1. Parses incoming requests
2. Routes to API handlers or static file serving
3. Handles CORS headers
4. Provides SPA fallback for client-side routing

### Request Flow

```
HTTP Request
  → handleRequest()
    → OPTIONS → CORS headers (204)
    → /api/* → handleApi()
      → Route matching
      → Business logic
      → JSON response
    → Static file → serveFile()
    → SPA fallback → index.html
```

### API Layer

All API routes are defined in `handleApi()` within `server.js`. The routing is manual pattern matching:

```javascript
if (req.method === "GET" && url.pathname === "/api/projects") {
  return sendJson(res, 200, { projects: await listProjects() });
}
```

---

## Domain Model

### Project

```
Project {
  id: string           // Unique identifier (e.g., "payments-api")
  name: string         // Display name
  createdAt: Date
  updatedAt: Date
}
```

### Service (API Service)

```
ServiceDefinition {
  id: string
  name: string
  protocol: string     // "rest"
  description: string
}
```

### ApiModel

```
ApiModel {
  service: ServiceDefinition
  title: string
  baseUrl: string
  operations: ApiOperation[]
}
```

### ApiOperation

```
ApiOperation {
  id: string
  method: string       // GET, POST, PUT, DELETE, PATCH
  path: string
  summary: string
  description: string
  parameters: Parameter[]
  requestBody: RequestBody
  responses: Response[]
  security: Security[]
}
```

### KnowledgeRelationship

```
KnowledgeRelationship {
  source: {
    serviceId: string
    operationId: string
    location: string   // JSON path to dependency value
  }
  target: {
    serviceId: string
    operationId: string
    location: string
  }
  type: string         // e.g., "auth", "data_dependency"
  status: string       // "proposed" | "confirmed" | "rejected"
}
```

### Run

```
Run {
  id: string
  projectId: string
  title: string
  description: string
  status: string       // "passed" | "failed"
  testSpecification: TestSpecification
  executionPlanSummary: object
  results: ExecutionResult[]
  errors: string[]
  startedAt: string
  completedAt: string
  durationMs: number
}
```

---

## Execution Engine

The execution engine (`src/execution/`) handles running API tests against target environments.

### Components

1. **httpExecutor.js** — Executes a single HTTP request with:
   - Method, URL, headers, body
   - Authentication (Bearer, Basic, API Key)
   - Response capture (status, headers, body)
   - Timing measurement
   - Secret redaction from output

2. **dependencyAwareExecutor.js** — Executes a test specification with:
   - Dependency resolution between steps
   - Automatic token extraction and injection
   - Step ordering based on dependency graph
   - Error propagation

3. **DependencyAwareOrchestrator.js** — Orchestrates multi-step execution:
   - Builds execution plan from test specification
   - Resolves operation dependencies
   - Executes steps in dependency order
   - Collects and returns results

### Execution Flow

```
TestSpecification
  → DependencyAwareOrchestrator
    → Resolve dependencies
    → Build execution plan
    → Execute steps in order
      → httpExecutor.execute()
        → Build request
        → Apply auth
        → Send HTTP request
        → Capture response
        → Redact secrets
      → Extract dependency values
      → Inject into dependent steps
    → Collect results
    → Return Run
```

---

## Test Generation

The test generation engine (`src/engine/`) creates test cases from API contracts and requirements.

### Pipeline

1. **Contract Parsing** (`contractParser.js`)
   - Parses OpenAPI 3.x and Swagger 2.0
   - Parses Postman Collection v2.1
   - Resolves `$ref` references
   - Extracts operations, parameters, schemas

2. **Test Case Generation** (`testCaseGenerator.js`)
   - Generates positive test cases from operation definitions
   - Generates negative test cases (invalid inputs, missing fields)
   - Generates boundary test cases (min/max values)
   - Generates auth test cases (missing/invalid tokens)
   - Generates business rule test cases

3. **Test-to-API Matching** (`matching/`)
   - Matches generated test cases to API operations
   - Uses intent analysis and confidence scoring
   - Groups related operations by context
   - Produces confirmed mappings for execution

4. **Test Specification Bridge** (`testSpecificationBridge.js`)
   - Converts confirmed mappings into executable test specifications
   - Includes dependency information
   - Prepares execution plans

---

## Validation Engine

The validation engine (`src/validation/`) validates HTTP responses against expectations.

### Validators

- **Status code validation** — Expected vs actual HTTP status
- **Schema validation** — Response body structure against OpenAPI schema
- **Response time validation** — Performance thresholds
- **Header validation** — Required response headers

---

## Persistence

### File-based Persistence (Default)

All data is stored as JSON files in the `data/` directory:

```
data/
├── projects/          # {id}.json → Project
├── services/          # {projectId}/{serviceId}.json → Service
├── knowledge/         # {projectId}.json → ProjectKnowledge
├── runs/              # {projectId}/{runId}.json → Run
├── contracts/         # {name}.json → ParsedContract
├── reports/           # {runId}.html → HTMLReport
└── tickets/           # {key}.json → JiraTicket
```

### PostgreSQL Support

When `PG_ENABLED=true`, the application uses PostgreSQL instead of file storage. The repository layer (`src/domain/repositories/`) provides parallel implementations:

- `FileProjectRepository.js` / `PostgresProjectRepository.js`
- `FileServiceRepository.js` / `PostgresServiceRepository.js`
- `FileProjectKnowledgeRepository.js` / `PostgresProjectKnowledgeRepository.js`
- `FileRunRepository.js` / `PostgresRunRepository.js`

The active repository is selected at runtime by `ProjectRepository.js` based on configuration.

### Schema

The PostgreSQL schema (`src/db/001-schema.sql`) includes tables for:

- `projects` — Project definitions
- `services` — API service registrations
- `api_models` — API model definitions
- `api_operations` — Individual API operations
- `project_knowledge` — Knowledge and relationship data
- `runs` — Execution run records
- `run_results` — Individual step results

---

## API Layer

### Request/Response Format

All API responses follow a consistent JSON format:

```json
// Success
{ "projects": [...] }
{ "project": { ... } }
{ "services": [...] }

// Error
{ "error": "Human-readable error message" }
```

### CORS

The server includes CORS headers for development:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### Error Handling

Errors are returned with appropriate HTTP status codes:

- `400` — Bad request (validation error, missing fields)
- `404` — Resource not found
- `500` — Internal server error

---

## Deployment

### Production Build

```bash
# Build frontend
cd Tool/AI/frontend
npm run build

# Start production server
cd Tool/AI
npm start
```

The production server:
1. Serves static files from `frontend/dist/`
2. Routes `/api/*` to REST handlers
3. Falls back to `index.html` for SPA routes

### Environment Configuration

All configuration is through environment variables (see `Tool/AI/README.md` for full list). Configuration is loaded from `.env` file at startup by `src/config.js`.

---

## Extension Points

### Adding a New API Endpoint

1. Add route matching in `src/server.js` `handleApi()` function
2. Implement business logic using domain services
3. Return JSON response with `sendJson()`

### Adding a New Frontend Feature

1. Create a new directory under `frontend/src/features/`
2. Add the feature component
3. Add the route in `App.tsx`
4. Add navigation item in `Sidebar.tsx`

### Adding a New Persistence Backend

1. Create a new repository implementation in `src/domain/repositories/`
2. Implement the same interface as existing repositories
3. Add selection logic in the corresponding `*Repository.js` facade

### Adding a New Validator

1. Add validation function in `src/validation/validators.js`
2. Call it from the execution pipeline
3. Include results in the run output