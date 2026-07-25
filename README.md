# TestForge

**AI-Assisted API Validation Platform**

TestForge is a modern, open-source API validation platform that helps QA and API teams transform Jira tickets and API contracts into runnable test scenarios, execute them against target environments, and generate comprehensive reports.

---

## Features

- **Jira Integration** — Pull tickets from Jira Cloud with automatic acceptance criteria extraction
- **API Contract Parsing** — Parse OpenAPI 3.x, Swagger, and Postman collections
- **AI-Powered Test Generation** — Generate positive, negative, boundary, auth, and edge-case scenarios
- **Dependency-Aware Execution** — Execute tests with automatic dependency resolution between API operations
- **Multiple Auth Methods** — Bearer token, Basic Auth, API Key, and auto-token extraction
- **Dual Persistence** — File-based storage (default) or PostgreSQL for production
- **Dark/Light Theme** — System preference detection with manual toggle and persistence
- **Comprehensive Reporting** — JSON evidence files and HTML reports
- **Run History** — Ticket-based grouping for comparison and audit

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│         React + TypeScript + Vite                │
├─────────────────────────────────────────────────┤
│              Node.js HTTP Server                 │
│         REST API  ←→  Static Files               │
├─────────────────────────────────────────────────┤
│  Domain Layer                                    │
│  Projects │ Services │ Knowledge │ Runs          │
├─────────────────────────────────────────────────┤
│  Engine Layer                                    │
│  Test Gen │ Matching │ Execution │ Validation    │
├─────────────────────────────────────────────────┤
│  Persistence Layer                               │
│  File System (default)  │  PostgreSQL (opt)      │
└─────────────────────────────────────────────────┘
```

---

## Repository Structure

```
├── .github/workflows/          # CI/CD workflows
├── Tool/AI/
│   ├── frontend/               # React + TypeScript + Vite
│   │   ├── src/                # Components, features, services
│   │   └── dist/               # Production build output
│   ├── src/                    # Backend Node.js server
│   │   ├── server.js           # HTTP server entry point
│   │   ├── config.js           # Environment configuration
│   │   ├── domain/             # Domain models & repositories
│   │   ├── engine/             # Test generation & matching
│   │   ├── execution/          # HTTP execution engine
│   │   ├── contracts/          # API contract parsing
│   │   ├── integrations/       # Jira & AI integrations
│   │   ├── db/                 # PostgreSQL schema & migration
│   │   └── validation/         # Response validation
│   ├── sample-data/            # Example API contracts & tickets
│   ├── data/                   # Runtime data (gitignored)
│   └── package.json
├── README.md
└── START_SERVER.BAT
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/testforge.git
cd testforge

# Install backend dependencies
cd Tool/AI
npm install

# Install and build frontend
cd frontend
npm install
npm run build
cd ../..

# Start the server
cd Tool/AI
npm start
```

Open **http://localhost:4173** in your browser.

### Development Mode

```bash
# Terminal 1: Start the backend
cd Tool/AI
npm start

# Terminal 2: Start the Vite dev server (with HMR)
cd Tool/AI/frontend
npm run dev
```

The Vite dev server runs on **http://localhost:5173** and proxies API requests to the backend.

---

## Environment Variables

Copy `.env` to `Tool/AI/.env` and configure:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Backend server port | `4173` |
| `JIRA_BASE_URL` | Jira Cloud instance URL | — |
| `JIRA_EMAIL` | Jira account email | — |
| `JIRA_API_TOKEN` | Jira API token | — |
| `AI_PROVIDER` | AI provider (ollama, openai, groq) | `ollama` |
| `AI_MODEL` | AI model name | `llama3.2` |
| `AI_BASE_URL` | AI API base URL | `http://localhost:11434/v1` |
| `PG_ENABLED` | Enable PostgreSQL persistence | `false` |
| `DATABASE_URL` | PostgreSQL connection string | — |

---

## Build Commands

```bash
# Build frontend for production
cd Tool/AI/frontend
npm run build

# TypeScript typecheck
npm run typecheck

# Run tests
npm test
```

---

## Production

The production server serves the React build from `frontend/dist` through the Node.js backend:

```bash
cd Tool/AI
npm start
# → http://localhost:4173
```

---

## Roadmap

- [ ] User authentication and multi-tenant support
- [ ] WebSocket-based real-time execution streaming
- [ ] Test suite scheduling and notifications
- [ ] Environment management (dev/staging/production)
- [ ] OpenAPI specification export
- [ ] Performance regression tracking
- [ ] Plugin system for custom validators

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License.