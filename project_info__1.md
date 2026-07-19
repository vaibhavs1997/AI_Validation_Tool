# AI API Validation Tool — Codebase Overview

## Summary
A local Node.js MVP that automates API validation by converting Jira tickets and API contracts into executable test scenarios. The tool parses Jira issues or free-form text to extract acceptance criteria, matches them against OpenAPI/Postman/HAR contracts, generates positive/negative/boundary/auth/edge-case test scenarios, mutates request payloads accordingly, executes API calls (dry-run or live), validates responses, and produces rich HTML/JSON reports. It's designed for QA engineers and API teams who need a traceable, repeatable validation pipeline without managing a full test automation framework.

## Architecture

### Architectural Pattern
**File-based, request-reply server with deterministic local logic plus optional AI enhancement.** There is no database, no build step, and no async worker queue. Every request to the server triggers synchronous file I/O for persistence, and the execution engine uses parallel batch processing (5 at a time). The system is fundamentally a **thin HTTP wrapper around a local workflow pipeline**: parse ticket → parse contract → generate scenarios → mutate payloads → execute → validate → report.

### Major Subsystems (in pipeline order)
1. **Contract Parser** (`src/contracts/`) — Auto-detects OpenAPI 3.x, Postman v2.1, or HAR format and normalizes to a unified endpoint model with request/response schemas.
2. **Scenario Generator** (`src/scenarios/`) — Extracts acceptance criteria from ticket text using heuristic parsing, scores each test case against each endpoint to find the best match, and produces prioritized scenarios with mutations.
3. **Payload Mutation Engine** (`src/payload/`) — Takes a base payload and applies a sequence of deterministic mutation operations (remove field, nullify, boundary min/max, invalid type, etc.).
4. **Execution Engine** (`src/execution/`) — Executes scenarios in parallel batches of 5 against a target environment, with support for auth auto-discovery (autoBearer token acquisition), path parameter filling, and retry on transient failures.
5. **Validator** (`src/validation/`) — Validates response status codes, response schemas, and response time thresholds.
6. **Report Generator** (`src/reporting/`) — Generates a self-contained single-file HTML report with dark/light theme, search/filter, expand/collapse, and print support. No external HTML template engine.

### Technology Stack
- **Runtime**: Node.js 20+ (native `http` module — no Express, no frameworks)
- **No build step**: Zero compile/transpile. Run directly via `node src/server.js`
- **No database**: File-based JSON storage in `data/` directory (created on first run)
- **HTTP client**: Global `fetch()` (Node 18+ native)
- **AI integration**: OpenAI-compatible API (works with OpenAI, Groq, or any compatible provider)
- **Frontend**: Vanilla JavaScript, no frameworks, no SPA router
- **Container**: Docker + docker-compose for production deployment

### How Execution Starts
```
START_SERVER.BAT (Windows), npm run dev, or docker-compose up -d
    → node src/server.js
        → config.js loads .env
        → storage.ensureStorage() creates data/ buckets
        → http.createServer(handleRequest).listen(4173)
        → native HTTP router: /api/* → handleApi(), otherwise serve static from public/
```

There is **no lifecycle hook, no middleware pipeline, no dependency injection container**. The server is a single async function `handleRequest` with a `switch`-like dispatch over URL path patterns.

## Directory Structure

```
AI_Validation_Tool/
├── START_SERVER.BAT                    # Windows quick-start (kills old node, starts server)
├── README.md                           # Top-level overview
│
└── Tool/AI/                            # Main application root
    ├── package.json                    # name: "ai-api-validation-mvp", no dependencies
    ├── .env.example                    # Template for JIRA + AI config
    ├── .dockerignore
    ├── Dockerfile
    ├── docker-compose.yml
    │
    ├── src/
    │   ├── config.js                   # .env loader, config singleton
    │   ├── server.js                   # HTTP server, router, API handlers
    │   ├── storage.js                  # File-system JSON bucket storage
    │   │
    │   ├── integrations/
    │   │   ├── jiraClient.js           # Jira REST API v3 client
    │   │   └── llmClient.js            # OpenAI-compatible LLM client
    │   │
    │   ├── contracts/
    │   │   ├── contractParser.js       # OpenAPI / Postman / HAR parser
    │   │   └── openapiDiff.js          # Contract version diff tool
    │   │
    │   ├── scenarios/
    │   │   └── scenarioGenerator.js    # AC extraction, endpoint scoring, scenario building
    │   │
    │   ├── payload/
    │   │   └── mutationEngine.js       # Payload mutation operations
    │   │
    │   ├── execution/
    │   │   └── executionEngine.js      # Scenario runner with auth, retry, parallel batches
    │   │
    │   ├── validation/
    │   │   └── validators.js           # Status, schema, and response-time validators
    │   │
    │   └── reporting/
    │       └── reportGenerator.js      # Single-file HTML report generator (inline CSS + JS)
    │
    ├── public/
    │   ├── index.html                  # Main SPA shell (sidebar + panels)
    │   ├── app.js                      # ~900-line vanilla JS client with state management
    │   └── styles.css                  # Themed CSS with CSS custom properties
    │
    ├── sample-data/
    │   ├── jira-ticket.json            # Demo Jira ticket (PAY-1234)
    │   ├── httpbin-test.json           # Demo contract for httpbin.org testing
    │   └── openapi-refund.json         # Demo OpenAPI refund/settlement spec
    │
    └── data/                           # Created at runtime: tickets/, contracts/, runs/, reports/
```

## Key Abstractions

### 1. Config (`src/config.js`)
- **File**: `src/config.js` (all of it)
- **Responsibility**: Loads `.env` file at module import time, provides a frozen `config` singleton. Bootstraps environment variables before any other module reads them.
- **Notable**: `loadDotEnv()` is called at module scope. This means importing `config.js` has a side effect — it reads and sets `process.env`. The helper functions `boolEnv()` and `intEnv()` handle common patterns.
- **Lifecycle**: Executed once on first `require()`. Immutable after that (no runtime config reload).

### 2. Storage (`src/storage.js`)
- **File**: `src/storage.js` (lines 1-end)
- **Responsibility**: File-system JSON bucket storage with safe filename sanitization. Provides CRUD for four buckets: `tickets/`, `contracts/`, `runs/`, `reports/`.
- **Key functions**:
  - `saveJson(bucket, id, data)` → writes `data/{bucket}/{safeName(id)}.json`
  - `readJson(bucket, id)` → reads and parses from the same path
  - `listRunSummaries()` → reads all run JSON files, aggregates them into ticket-grouped summary
  - `saveReport(id, html)` → writes `.html` file to reports bucket
  - `deleteRun(id)` → deletes both run JSON and report HTML
- **Quirk**: `safeName()` strips special characters and truncates to 120 characters. Uses `crypto.randomUUID()` as fallback if the ID is falsy.
- **Important**: `listRunSummaries()` does not use `listJson()`. It has custom logic to parse each run, handle parse errors gracefully (returns "unreadable"), and group runs by ticket key for the dashboard.

### 3. Server (`src/server.js`)
- **File**: `src/server.js` (all 160+ lines)
- **Responsibility**: Native HTTP server, URL router, body parser, static file server, and the glue that wires all other modules together.
- **Architecture**: Pure function `handleRequest(req, res)` → URL starts with `/api/`? → `handleApi(req, res, url)`. Otherwise, serve static files from `public/` or `sample-data/`.
- **API dispatch**: A cascade of `if`/`else if` blocks matching `url.pathname` with regex and string comparison. POST handlers read the full body via `readBody()` with a 10MB limit.
- **Security**: `serveFile()` has a directory traversal check (`path.relative` must not start with `..`). No other auth, no CORS headers.
- **Lifecycle**: Single `server.listen()` call. No graceful shutdown handler.

### 4. Contract Parser (`src/contracts/contractParser.js`)
- **File**: `src/contracts/contractParser.js` (all 250+ lines)
- **Responsibility**: Accepts a JSON input (string or parsed object), auto-detects format (OpenAPI, Postman, HAR), normalizes to a unified contract structure with an `endpoints[]` array.
- **Key internal functions**:
  - `resolveRef(root, value)` — Follows `$ref` pointers (only local `#/...` refs)
  - `resolveSchema()` — Deep-resolves all `$ref`s in a schema tree
  - `mergeAllOf()` — Flattens `allOf` into a single object with merged properties
  - `createSampleValue()` — Generates example values from a schema (field-name-aware: `email` → `qa.user@example.com`, `amount` → `10`)
  - `parseOpenApi()`, `parsePostman()`, `parseHarLog()` — Format-specific parsers
- **Postman specifics**: Handles `{{variable}}` patterns, `url.path` arrays, nested `item` trees (recursive `walkPostmanItems`), and variable substitution for `baseUrl`.
- **Limitation**: Only JSON-based OpenAPI/Postman/HAR. No YAML, no RAML, no GraphQL.

### 5. Scenario Generator (`src/scenarios/scenarioGenerator.js`)
- **File**: `src/scenarios/scenarioGenerator.js` (all 400+ lines)
- **Responsibility**: Most complex module. Accepts a ticket and contract, extracts acceptance criteria, generates test cases, scores each against all endpoints, and produces a prioritized list of scenarios.
- **Key sub-algorithms**:
  - `extractAcceptanceCriteria()` in `jiraClient.js` (shared logic duplicated in `app.js`): Heuristic parser that finds "Acceptance Criteria" / "AC" headers in ADF or plain text, then extracts bullet/number list items.
  - `createTestCasesFromTicket()`: Deduplication via `dedupKey()` (type + mutation signature + first 2 assertions). Generates positive scenarios (1 per AC unless it's a constraint), negative scenarios (missing fields, empty fields, duplicates, boundary violations), auth scenarios, password policy tests, email format tests, SQL injection/XSS edge cases.
  - `scoreEndpointForTestCase()`: Assigns a score (0-20+) based on: HTTP method match (+10/-5), path segment overlap (+8 per segment, +4 for partial), operationId/summary keywords (+5), tags (+3), description (+2). Minimum threshold of 3 to assign.
  - `assignEndpointsToTestCases()`: Takes the best-matching endpoint per test case. Unmatched cases become "unlinked" scenarios with `unlinked: true`.
  - `prioritizeScenarios()`: Sorts by risk score (high > medium > low), then by matchScore, then alphabetically.
  - `generateScenarios()`: Orchestrator — tries to parse raw contract input, calls local generation, optionally sends to AI provider for enhancement, merges AI-generated scenarios (only new ones by title dedup).
- **Smart behaviors**: Detects field types from AC text (`email`, `password`, `username`, `role`), maps action verbs to HTTP methods (`create` → POST, `fetch` → GET), and generates password policy tests (length/uppercase/number/special).
- **Performance**: Limited to top 10 ACs per ticket. AI sends only first 8 ACs and first 5 endpoints.

### 6. Execution Engine (`src/execution/executionEngine.js`)
- **File**: `src/execution/executionEngine.js` (all 300+ lines)
- **Responsibility**: Executes scenarios against a target environment. Handles auth setup (bearer, basic, custom, autoBearer), path parameter filling, query string building, parallel batching, and retry.
- **Key functions**:
  - `executeRun()`: Top-level orchestrator — acquires auth token first, then delegates to parallel execution, computes summary.
  - `acquireBearerToken()`: If auth type is `autoBearer`, calls the token endpoint, searches for the token at a configurable JSON path (defaults to `access_token`, but also checks `token`, `jwt`, `data.access_token`, etc.).
  - `executeScenario()`: Single scenario execution — builds URL, headers, and body, sends request with timeout, calls `validateResponse()` on the result.
  - `executeScenarioParallel()`: Batches scenarios into groups of 5, runs each batch with `Promise.all`.
- **Retry logic**: Only retries on network errors (AbortError, fetch failure). Uses exponential backoff: `500ms * (attempt + 1)`. Maximum 1 retry. HTTP errors are NOT retried.
- **Error handling**: If `acquireBearerToken` fails, `executeRun` returns a complete run object with ALL scenarios set to "blocked" status and the auth error message attached. The run is still persisted.
- **URL building**: `joinUrl()` combines base URL + path. If path is already absolute (`http...`), ignores base URL. Resolves `{{variable}}` patterns via `resolveVariables()`.

### 7. Validator (`src/validation/validators.js`)
- **File**: `src/validation/validators.js` (all ~90 lines)
- **Responsibility**: Validates HTTP responses. Three validation dimensions: status code, response schema, response time.
- **Key functions**:
  - `validateResponse()`: Runs all checks, returns `{ assertions, passed, failed, responseTimeMs }`. An assertion with `passed: null` means "requires manual review" (e.g., acceptance criteria assertions that can't be verified automatically).
  - `validateSchema()`: Recursive type checking and required-field validation. Handles `nullable: true`. Does NOT validate `pattern`, `minLength`, `maxLength`, `minimum`, `maximum` — only `type`, `required`, and `properties`.
  - `validateResponseTime()`: Simple threshold check (default 5000ms, configurable per scenario/endpoint).
- **Edge case**: A scenario with no deterministic assertions (all `passed: null`) will have `passed: false` and `failed: false` — this is the "needs_review" state.

### 8. Report Generator (`src/reporting/reportGenerator.js`)
- **File**: `src/reporting/reportGenerator.js` (all ~280 lines)
- **Responsibility**: Generates a single self-contained HTML file with all CSS and JS inlined.
- **Key features**: Dark/light theme toggle (saved via `localStorage` in the report), search/filter, expand/collapse all, print-friendly styles, progress bar with segmented colors, collapsible request/response details.
- **CSS architecture**: CSS custom properties with `[data-theme="dark"]` overrides for all colors.
- **JS in the report**: ~50 lines of inline script for theme toggle, filtering, expand/collapse. No external dependencies.
- **No external template**: HTML is built via string concatenation with manual `escapeHtml()` calls. This is a security-sensitive area — all user-provided data is escaped.

### 9. Jira Client (`src/integrations/jiraClient.js`)
- **File**: `src/integrations/jiraClient.js` (all 160+ lines)
- **Responsibility**: Jira REST API v3 integration with ADF-to-text conversion and acceptance criteria extraction.
- **Key functions**:
  - `fetchIssue(issueKey)`: Fetches a Jira issue with `?expand=names`, normalizes it.
  - `searchIssues(jql)`: POST to `rest/api/3/search/jql` with JQL query.
  - `normalizeIssue()`: Converts Jira API response to a standardized ticket object. Handles ADF (Atlassian Document Format) description via `adfToText()`.
  - `extractAcceptanceCriteria()`: Same heuristic logic as the client-side version — finds "Acceptance Criteria" or "AC" header, extracts bullet items.
  - `findCustomAcceptance()`: Searches all fields where the field name indicates acceptance criteria.
- **Edge case**: Handles inline AC lists like "ACs: 1.foo, 2.bar" by splitting on commas and numbered items.

### 10. LLM Client (`src/integrations/llmClient.js`)
- **File**: `src/integrations/llmClient.js` (all 120+ lines)
- **Responsibility**: OpenAI-compatible chat completion client for AI-enhanced scenario generation.
- **Key behavior**: Sends ticket summary + first 8 ACs + compacted contract (first 5 endpoints) + first 10 local scenarios as context. Parses the AI response with fallback for markdown fences and JSON extraction. Merges AI-generated scenarios with local ones (adds only new scenarios by title dedup, preserves endpoint info from local scenarios).
- **Error handling**: If AI is not configured or fails, gracefully falls back to local generation with a warning.
- **Provider flexibility**: Works with any OpenAI-compatible API (OpenAI, Groq, etc.) via `OPENAI_BASE_URL`.

## Data Flow

### Primary Flow: Ticket → Contract → Scenarios → Execution → Report

1. **User loads ticket** (Step 1 in UI):
   - Click "Sample" → fetches `sample-data/jira-ticket.json` → stores in `state.ticket`
   - Or type ticket key → POST `/api/jira/ticket` → `jiraClient.fetchIssue()` → stores in `data/tickets/`
   - Or paste JSON/plain text → `parseTicketInput()` → client-side extraction of ACs

2. **User loads contract** (Step 2):
   - Click "Sample" → fetches `sample-data/openapi-refund.json`
   - Or upload file → POST `/api/contracts/parse` → `contractParser.parseContract()` → detects format → normalizes to unified structure → stored in `data/contracts/`

3. **User clicks "Generate"** (Step 3):
   - POST `/api/scenarios/generate` → `scenarioGenerator.generateScenarios()`
   - `createTestCasesFromTicket()` produces 10-40+ test cases from ACs
   - `assignEndpointsToTestCases()` scores each against all endpoints, picks best match
   - If AI enabled: POST to LLM API → parses response → merges new scenarios
   - Returns `{ scenarios: [...], unusedEndpoints: [...] }`

4. **User configures environment** (Step 4):
   - Sets base URL, auth type, dry-run toggle
   - For autoBearer: optionally auto-detects token endpoint from contract

5. **User clicks "Execute"**:
   - POST `/api/runs/execute` → `executionEngine.executeRun()`
   - `acquireBearerToken()` if needed
   - `executeScenarioParallel()` batches of 5
   - For each scenario: `applyMutations()` → `executeScenario()` → `validateResponse()`
   - Run saved to `data/runs/{id}.json`
   - `reportGenerator.generateHtmlReport()` → saved to `data/reports/{id}.html`
   - Returns `{ run, reportUrl }`

6. **User views results** (Step 5):
   - Client-side: `renderRun()` shows stats + clickable details
   - Links to JSON API and HTML report view

### Secondary Flow: Run History
- GET `/api/runs` → `storage.listRunSummaries()` → reads all `data/runs/*.json` → computes ticket-grouped summaries → returns `{ runs, tickets, totals }`
- DELETE `/api/runs/:id` → deletes run JSON + report HTML

## Non-Obvious Behaviors & Design Decisions

### Hidden Invariants

1. **The config module has a side effect at import time.** `loadDotEnv()` runs when `config.js` is first required. This means the `.env` file is read before any other module reads `process.env`. If you import something before `config.js`, environment variables won't be set.

2. **Storage directory `data/` is created lazily.** `ensureStorage()` is called by `saveJson()` and `listJson()` and at server startup, but NOT at module load time. This means the data directory won't exist until the first write operation.

3. **Run IDs are NOT UUIDs.** They're constructed as `{ticketKey}-{timestamp}` (e.g., `PAY-1234-1712345678901`). If a ticket has no key, it falls back to `manual-{timestamp}`. This means run IDs are predictable and can collide if two runs happen in the same millisecond for the same ticket.

4. **The scenario generator deduplicates by a hash of type + mutations + first 2 assertions.** This means two test cases with identical mutations but different assertion text are treated as duplicates. It's possible to lose test cases this way if they share the same mutation pattern.

5. **`severity` (typo) is used instead of `severity` in some error messages.** This is cosmetic but present.

### Design Decisions

1. **No Express, no frameworks.** The entire server uses Node's native `http` module. This was an intentional choice to keep dependencies at zero — the only dependency listed in `package.json` is nothing. The trade-off is manual URL parsing, manual body parsing, and no middleware ecosystem.

2. **No asynchronous job queue.** Even though running 20+ API calls can take minutes, the server blocks the request handler until all results come back. This means the browser's `fetch()` to `/api/runs/execute` will hang open for potentially minutes. The client doesn't show a progress bar — just a toast "Running all scenarios..." and then the results appear.

3. **AI is an optional enhancement, not a core path.** If AI is not configured, the system generates deterministic scenarios based on heuristics. The AI is only called to generate *additional* scenarios beyond the local ones — it cannot override or remove local scenarios. AI scenarios are merged only if their title is unique.

4. **Client-side AC extraction duplicates server-side logic.** `extractAcceptanceCriteria()` exists in both `jiraClient.js` (server) and `app.js` (client) with similar but not identical implementations. The client needs it because it handles manual ticket text input that never reaches the server.

5. **Filenames are sanitized with a naive approach.** `safeName()` replaces anything not matching `[a-zA-Z0-9._-]` with `-`. This means Unicode, spaces, and special characters are silently replaced. Two inputs that differ only in special characters could collide.

6. **The UI auto-loads sample data on page load.** `boot()` calls both `loadSampleTicket()` and `loadSampleContract()` with `silent: true`. This means a fresh page load already has demo data populated — useful for demos, but potentially confusing for new users who want to start from scratch.

7. **`Run All (Auto)` button provides a zero-click demo experience.** It loads sample ticket + sample contract (if not loaded), generates scenarios, switches dry-run off, executes, and navigates to results. This is designed for demos and first-time users.

### State Management

- **Client state** (`state` object in `app.js`): All mutable state is in a single global `state` object with properties for ticket, contract, scenarios, run, history, and current view. UI functions read from this state and re-render.
- **Server state**: Stateless per request. All persistent state is in the filesystem under `data/`. Nothing is kept in memory between requests.
- **Mutation point**: The only place data is modified is in `storage.js` via `saveJson()` and `deleteRun()`. There is no in-memory cache, no write queue.

### Error Propagation

- **API handler catches all errors**: `handleApi()` is wrapped in a try/catch that returns `{ error: error.message }` with status 500.
- **Execution failures don't abort the run**: If a single scenario fails (network error, timeout), it returns "blocked" status and the error message. Other scenarios continue executing.
- **Auth token acquisition failure blocks ALL scenarios**: If `acquireBearerToken()` throws, `executeRun()` returns a complete run object where ALL scenarios are "blocked" with the auth error. This is intentional — no point trying API calls if we can't authenticate.
- **AI failure is silent**: If the AI provider fails, the server returns local scenarios with a warning. No error is propagated to the user — just a `warnings` array in the response.

### Performance-Sensitive Paths

- **Parallel execution batches of 5**: `executeScenarioParallel()` groups scenarios into batches of 5 and runs each batch with `Promise.all`. This prevents overwhelming the target API while still providing parallelism.
- **File I/O**: On every API call, the server reads/writes JSON files synchronously (`fs.readFileSync` / `fs.writeFileSync`). For `listRunSummaries()`, it reads ALL run JSON files — this could become slow with hundreds of runs.
- **Schema resolution**: `resolveSchema()` deep-clones schemas with `$ref` resolution. For large OpenAPI specs with deeply nested `$ref`s, this could be expensive. The recursion uses a `seen` Set to prevent infinite loops.

### External Dependencies & Quirks

- **Jira REST API v3**: Uses Basic Auth with email + API token. The API returns field metadata in `names` which is used to find acceptance criteria custom fields.
- **OpenAI-compatible API**: The LLM client works with any provider that exposes `/v1/chat/completions`. Tested with OpenAI and Groq. The prompt instructs the model to return pure JSON with no markdown — but the parser has fallback logic for extracting JSON from markdown fences.
- **No package dependencies**: The project has zero npm dependencies beyond Node.js built-in modules. This is a deliberate architectural choice for simplicity and auditability.
- **`start` script is missing the `dev` vs `start` distinction**: Both `npm run start` and `npm run dev` run the same command. There's no hot-reload or development mode.

### Things the Code Doesn't Explain About Itself

- The `work/` directory with `create_ai_api_validation_pdf.js` and `server.pid` is not documented. `server.pid` suggests there was once a process management layer.
- The `TECHNICAL_DOCUMENTATION.md` file in Tool/AI/ is a pre-existing comprehensive doc that covers all API endpoints and module functions. The root `README.md` references a path `2026-07-04/i` that doesn't exist in this repo — the actual structure uses `Tool/AI/`.
- `test-report.js` and `test-run.js` in Tool/AI/ are not part of the main source tree and their purpose is undocumented.

## Module Reference

| File | Purpose |
|------|---------|
| `src/server.js` | HTTP server, URL routing, request handling, static file serving |
| `src/config.js` | `.env` loader, configuration singleton |
| `src/storage.js` | File-system JSON bucket storage (CRUD for runs, tickets, contracts, reports) |
| `src/contracts/contractParser.js` | Auto-detecting parser for OpenAPI 3.x, Postman v2.1, and HAR files |
| `src/contracts/openapiDiff.js` | Diff tool comparing two contracts for breaking changes |
| `src/scenarios/scenarioGenerator.js` | Acceptance criteria extraction, endpoint scoring/matching, test case generation |
| `src/payload/mutationEngine.js` | Payload mutation operations (remove, nullify, invalidType, boundaryMin/Max, etc.) |
| `src/execution/executionEngine.js` | Scenario execution with auth handling, parallel batching, retry |
| `src/validation/validators.js` | Response status, schema, and response-time validation |
| `src/reporting/reportGenerator.js` | Single-file HTML report generation with inline CSS/JS |
| `src/integrations/jiraClient.js` | Jira REST API v3 client with ADF-to-text and AC extraction |
| `src/integrations/llmClient.js` | OpenAI-compatible chat completion for scenario enhancement |
| `public/index.html` | Main application shell — sidebar, panels, modals |
| `public/app.js` | Client-side state management, API calls, rendering, ~900 lines |
| `public/styles.css` | Themed CSS with light/dark mode support |

## Suggested Reading Order

1. **`src/config.js`** — Start here: understand how configuration works, side effects, environment variables
2. **`src/storage.js`** — The persistence layer; everything else depends on it
3. **`src/server.js`** — The HTTP router and API dispatch; shows how all modules are wired together
4. **`src/contracts/contractParser.js`** — Foundation: how contracts become normalized endpoints
5. **`src/scenarios/scenarioGenerator.js`** — The core logic: AC extraction, endpoint scoring, test generation
6. **`src/execution/executionEngine.js`** — How scenarios become HTTP requests with auth, retry, and parallel execution
