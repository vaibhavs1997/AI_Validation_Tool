# TestForge — Backend & Frontend

This directory contains the TestForge application — a React + TypeScript frontend and a Node.js HTTP backend.

---

## Architecture

### Backend (`src/`)

The backend is a single-file HTTP server (`src/server.js`) using Node's built-in `http` module. It serves both the REST API and the production React build.

- **No Express dependency** — pure Node.js HTTP
- **REST API** under `/api/*` routes
- **Static files** from `frontend/dist/` for production
- **SPA fallback** — all non-API routes serve `index.html`

### Frontend (`frontend/`)

The frontend is a React 18 application built with TypeScript and Vite.

- **Feature-based** directory structure under `frontend/src/features/`
- **Shared services** in `frontend/src/services/`
- **CSS custom properties** for theming (light/dark)
- **Inline SVG icons** — no external icon library

---

## Directory Structure

```
Tool/AI/
├── frontend/                    # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/          # Shared UI components (Sidebar, Header)
│   │   ├── features/            # Feature modules (setup, workspace, results, etc.)
│   │   ├── services/            # API client and service layer
│   │   ├── styles/              # CSS with design tokens
│   │   ├── types/               # TypeScript type definitions
│   │   ├── hooks/               # Custom React hooks
│   │   ├── utils/               # Utility functions
│   │   └── App.tsx              # Root application component
│   ├── dist/                    # Production build output
│   ├── index.html               # Entry HTML
│   ├── vite.config.ts           # Vite configuration
│   └── package.json
├── src/                         # Backend server
│   ├── server.js                # HTTP server entry point
│   ├── config.js                # Environment configuration
│   ├── storage.js               # File-based storage utilities
│   ├── domain/                  # Domain models and business logic
│   │   ├── ProjectIdentity.js   # Project identity with validation
│   │   ├── ProjectRepository.js # Project persistence (file/Postgres)
│   │   ├── ServiceRepository.js # Service persistence
│   │   ├── RunRepository.js     # Run execution persistence
│   │   ├── ProjectKnowledge/    # Knowledge analysis and storage
│   │   ├── repositories/       # File and Postgres implementations
│   │   └── ...domain models
│   ├── engine/                  # Test generation engine
│   │   ├── testCaseGenerator.js # Generate test cases from contracts
│   │   ├── testSpecificationBridge.js # Prepare test specifications
│   │   ├── matching/           # Test-to-API matching engine
│   │   └── ...engine modules
│   ├── execution/              # HTTP execution and orchestration
│   │   ├── httpExecutor.js      # Single HTTP request executor
│   │   ├── dependencyAwareExecutor.js # Dependency-respecting execution
│   │   └── DependencyAwareOrchestrator.js # Step orchestration
│   ├── contracts/              # API contract parsing
│   │   ├── contractParser.js    # OpenAPI/Postman parser
│   │   └── openapiDiff.js       # Contract diff comparison
│   ├── integrations/           # External service integrations
│   │   ├── jiraClient.js        # Jira REST API client
│   │   └── llmClient.js         # AI/LLM API client
│   ├── db/                     # PostgreSQL database
│   │   ├── pool.js              # Connection pool
│   │   ├── migrate.js           # Schema migration runner
│   │   └── 001-schema.sql       # Initial schema
│   └── validation/             # Response validation
├── sample-data/                # Example contracts and tickets
├── data/                       # Runtime persistence (gitignored)
├── outputs/                    # Generated reports and exports
├── work/                       # Temporary work files
├── .env                        # Environment variables (gitignored)
└── package.json
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port | `4173` |
| `JIRA_BASE_URL` | Jira Cloud instance | — |
| `JIRA_EMAIL` | Jira account email | — |
| `JIRA_API_TOKEN` | Jira API token | — |
| `AI_PROVIDER` | AI provider name | `ollama` |
| `AI_API_KEY` | AI API key | — |
| `AI_MODEL` | AI model name | `llama3.2` |
| `AI_BASE_URL` | AI API base URL | `http://localhost:11434/v1` |
| `AI_TIMEOUT_MS` | AI request timeout | `120000` |
| `REQUEST_TIMEOUT_MS` | API request timeout | `30000` |
| `PG_ENABLED` | Enable PostgreSQL | `false` |
| `DATABASE_URL` | PostgreSQL connection | — |

---

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install backend dependencies
cd Tool/AI
npm install

# Install frontend dependencies
cd frontend
npm install
```

### Run in Development Mode

**Terminal 1 — Backend:**
```bash
cd Tool/AI
npm start
# → http://localhost:4173
```

**Terminal 2 — Frontend (with Hot Module Replacement):**
```bash
cd Tool/AI/frontend
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to the backend automatically.

### Build Frontend for Production

```bash
cd Tool/AI/frontend
npm run build
```

### TypeScript Typecheck

```bash
cd Tool/AI/frontend
npm run typecheck
```

### Run Tests

```bash
cd Tool/AI/frontend
npm test
# or
npm run test:run
```

---

## Running in Production

```bash
cd Tool/AI
npm start
# → http://localhost:4173
```

The production server serves the pre-built React application from `frontend/dist/`. Run `npm run frontend:build` before starting the server if the build is missing or outdated.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/config/status` | Integration configuration status |
| `GET` | `/api/projects` | List all projects |
| `POST` | `/api/projects` | Create a new project |
| `GET` | `/api/projects/:id` | Get project details |
| `GET` | `/api/services` | List services for a project |
| `POST` | `/api/services/register` | Register a service from API contract |
| `GET` | `/api/knowledge` | Get project knowledge |
| `POST` | `/api/knowledge/instructions` | Update instructions and analyze |
| `POST` | `/api/knowledge/relationships/confirm` | Confirm a relationship |
| `POST` | `/api/knowledge/relationships/reject` | Reject a relationship |
| `POST` | `/api/contracts/parse` | Parse an API contract |
| `POST` | `/api/contracts/diff` | Compare two contracts |
| `POST` | `/api/test-cases/generate` | Generate test cases |
| `POST` | `/api/test-cases/match` | Match test cases to API endpoints |
| `POST` | `/api/test-specifications/prepare` | Prepare test specifications |
| `GET` | `/api/runs` | List run summaries |
| `POST` | `/api/runs/execute-dependent` | Execute with dependency resolution |

---

## Persistence

### File-based (Default)

Data is stored as JSON files in `data/`:

```
data/
├── projects/        # Project definitions
├── services/        # Service registrations
├── knowledge/       # Project knowledge and relationships
├── runs/            # Execution run history
├── contracts/       # Parsed API contracts
├── reports/         # HTML report files
└── tickets/         # Cached Jira tickets
```

### PostgreSQL (Optional)

Set `PG_ENABLED=true` and configure `DATABASE_URL` to enable PostgreSQL persistence. The schema is defined in `src/db/001-schema.sql` and migrations run automatically at startup.

---

## Frontend Theming

The frontend supports light and dark themes using CSS custom properties:

- Theme is stored in `localStorage` under the key `testforge-theme`
- Default follows the system preference via `prefers-color-scheme`
- Manual toggle is available in the header theme switcher
- All theme variables are defined in `frontend/src/styles/index.css`