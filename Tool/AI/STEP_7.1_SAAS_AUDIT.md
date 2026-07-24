# STEP 7.1 — SaaS Production Architecture Audit

**Type:** READ-ONLY AUDIT  
**Context:** MVP V1 baseline complete and passing  
**Goal:** Determine minimum architecture changes to turn local MVP into secure multi-user SaaS  
**Rule:** Do NOT implement, refactor, or delete. Audit only.

---

## 1. Current Architecture Risks

| Risk | Severity | Details |
|------|----------|---------|
| **No authentication** | CRITICAL | Zero auth exists. Anyone with network access to port 4173 can access all data. |
| **No user isolation** | CRITICAL | Every entity (project, service, run) is scoped to projectId only. No userId anywhere. |
| **Plaintext secrets** | HIGH | `.env` file stores Jira credentials, AI API keys, and provider URLs as plaintext. Execution tokens are redacted at runtime but original `.env` secrets are unencrypted on disk. |
| **File-based storage** | MEDIUM | All data lives in `data/` directory as JSON files. No concurrency control, no transaction support, no indexing, no backups. Loss of filesystem = total data loss. |
| **Single default project** | MEDIUM | `seedDefaultProject()` creates one hardcoded project. No multi-tenancy path exists. |
| **No request validation** | MEDIUM | Server routes accept raw JSON without ownership checks. No middleware pattern. |
| **CORS wide open** | LOW | `Access-Control-Allow-Origin: *` is acceptable for MVP but needs tightening in production. |
| **No rate limiting** | LOW | No protection against AI API abuse or repeated execution requests. |

---

## 2. Recommended Production Architecture

```
Browser (React SPA)
    │
    HTTPS
    │
    ▼
Reverse Proxy (nginx/Caddy)
    │
    ├── Static files (/api/public or CDN)
    │
    ▼
Backend API (Node.js, same Express-based server)
    │
    ├── Auth Middleware (JWT validation, userId extraction)
    │   └── Passes req.userId downstream
    │
    ├── Ownership Guard (every route checks: does this project belong to this user?)
    │
    ├── Route Handlers (existing /api/* routes, adapted for userId scope)
    │
    └── Database Layer
        │
        └── PostgreSQL
            ├── users
            ├── projects (now user-scoped)
            ├── services/api_models (still project-scoped)
            ├── runs (still project-scoped)
            ├── project_knowledge (still project-scoped)
            └── relationships (still project-scoped)
```

**Key architectural decisions:**
- One monolithic backend (no microservices) — keep it simple.
- React frontend communicates with backend via single origin.
- Database replaces file storage incrementally, one repository at a time.
- Auth is a middleware layer, not a rewrite of route handlers.

---

## 3. Ownership Model

```
User (id, email, password_hash)
  │
  └── owns → Project (id, user_id, name)
                │
                ├── owns → Service/API Model (project_id)
                ├── owns → Project Knowledge (project_id)
                ├── owns → Relationships (project_id)
                ├── owns → Runtime Environments (project_id)
                └── owns → Runs/History (project_id)
```

**Rule:** Every project-scoped request must verify `project.user_id === req.userId`.

**Implementation:** Add `userId` column to projects table. All downstream entities remain scoped to projectId (no direct userId needed on them). The ownership chain is:
1. Authenticate → get `req.userId`
2. Parse `projectId` from request
3. Check: does `projects.user_id = req.userId`?
4. Reject 403 if not

**No need to re-scope:** Services, API models, knowledge, relationships, environments, runs — all already scoped to `projectId`. Only `projects` needs the `userId` column.

---

## 4. Persistence Migration Map

### Current file-based directories

| Directory | Contents | Recommendation | Strategy |
|-----------|----------|---------------|----------|
| `data/projects/` | Project identities | **MIGRATE TO DB** | Replace with `projects` table (add `user_id`) |
| `data/services/{projectId}/` | Service definitions | **MIGRATE TO DB** | Replace with `services` table (project_id FK) |
| `data/api-models/{projectId}/` | API models | **MIGRATE TO DB** | Replace with `api_models` table (project_id FK, JSON column for operations) |
| `data/project-knowledge/` | Knowledge state + relationships | **MIGRATE TO DB** | Replace with `project_knowledge` table (project_id FK, JSON column) |
| `data/runs/{projectId}/` | Run results | **MIGRATE TO DB** | Replace with `runs` table (project_id FK, JSON column for results) |
| `data/tickets/` | Jira ticket cache | **KEEP TEMPORARILY** | Maintain until SaaS caching strategy replaces it |
| `data/contracts/` | Uploaded contract files | **KEEP TEMPORARILY** | Maintain until file upload is tenant-aware |
| `data/reports/` | Generated HTML reports | **KEEP TEMPORARILY** | Can migrate to DB blob or S3 later |
| `data/ai-debug.log` | AI diagnostics | **REMOVE** | Replace with structured logging |

### Database Recommendation: PostgreSQL

**Why PostgreSQL:**
- JSONB columns for flexible schema-free data (operations, results, knowledge)
- Row-level security for tenant isolation
- Mature Node.js driver (pg)
- Can store file content as bytea or use pg_largeobject
- No ORM needed — raw queries with `pg` package suffice for MVP scale

### Minimum Database Schema

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE services (
  id          TEXT NOT NULL,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  name        TEXT NOT NULL,
  protocol    TEXT DEFAULT 'rest',
  description TEXT DEFAULT '',
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, id)
);

CREATE TABLE api_models (
  service_id  TEXT NOT NULL,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  title       TEXT,
  base_url    TEXT,
  operations  JSONB DEFAULT '[]',
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, service_id)
);

CREATE TABLE project_knowledge (
  project_id      TEXT PRIMARY KEY REFERENCES projects(id),
  instructions    TEXT DEFAULT '',
  relationships   JSONB DEFAULT '[]',
  status          TEXT DEFAULT 'active',
  data            JSONB DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE runs (
  id              TEXT NOT NULL,
  project_id      TEXT NOT NULL REFERENCES projects(id),
  title           TEXT,
  description     TEXT DEFAULT '',
  status          TEXT DEFAULT 'pending',
  target_operation JSONB,
  results         JSONB DEFAULT '[]',
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER DEFAULT 0,
  data            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (project_id, id)
);
```

**6 tables. No migrations framework needed for this scale — use raw SQL files.**

---

## 5. Authentication Recommendation

### Approach: Session-based JWT

**Why not OAuth/OIDC first?** JWT + session is the minimum viable auth. OAuth can be added later.

**Flow:**
1. `POST /api/auth/register` → creates user, returns JWT
2. `POST /api/auth/login` → validates credentials, returns JWT
3. All `/api/*` requests include `Authorization: Bearer <jwt>` header
4. Backend middleware verifies JWT, extracts `req.userId`

### Where auth integration belongs

| Layer | Change |
|-------|--------|
| **Frontend** | Add `LoginPage`, `SignupPage`. `App.tsx` checks auth state before mounting routes. `ApiClient.ts` adds JWT to all requests. |
| **Backend** | Add `src/auth/` module with register/login handlers. Add `authMiddleware.js` that validates JWT on every `/api/*` request. |
| **Server routes** | Existing routes need minimal changes — just userId extraction and project ownership check. |

### Authorization boundary

```
No auth → static file serving only (index.html, assets)
Auth required → ALL /api/* routes
Public routes → /api/auth/register, /api/auth/login (rate-limited)
```

### Secret storage for auth
- JWT signing key: environment variable (`JWT_SECRET`), never in DB
- Password hashing: bcrypt (12 rounds minimum)

---

## 6. Secrets Strategy

### What must never be stored as plaintext

| Secret | Current State | Production Strategy |
|--------|--------------|-------------------|
| Jira API token | `.env` file (plaintext) | Environment variable + App-level config only. Never stored in DB. |
| AI API key (OpenAI, etc.) | `.env` file (plaintext) | Environment variable + App-level config. User-provided keys stored encrypted (AES-256-GCM) if per-user override needed. |
| Bearer tokens (runtime) | Redacted at runtime in `httpExecutor.js` — good | Keep existing redaction. Never persist to DB. |
| API keys under test | Included in test data | Redact in persistence layer (already done in `httpExecutor.js`). |
| User passwords | Not yet present | bcrypt hash. Never plaintext. |
| JWT signing key | Not yet present | Environment variable only. |

### Minimal secure storage strategy

1. **Environment variables** for infrastructure secrets: `JWT_SECRET`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `AI_API_KEY`, `AI_BASE_URL`, `DATABASE_URL`
2. **Runtime redaction** for execution evidence: Already implemented in `httpExecutor.js` via `redactSecrets()`, `redactHeaders()`, `redactSecretsFromObject()`
3. **Per-user AI keys** (optional): Encrypt with AES-256-GCM using app-level key from `ENCRYPTION_KEY` env var
4. **Never log secrets**: Ensure no console.log of request/response bodies that may contain tokens

**No vault server needed for MVP-SaaS scale.** Environment variables + runtime redaction covers 95% of requirements.

---

## 7. AI Provider Strategy

### Current state
- Provider-agnostic via `aiTestGeneratorV2.js`
- Ollama (local), OpenAI-compatible (cloud)
- Configurable via `.env`: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`
- Diagnostics track provider, model, latency, error type

### Production support

```
LOCAL: Ollama (localhost:11434)
  └── No API key needed
  └── Same abstraction: just change AI_BASE_URL

CLOUD: OpenAI / configurable provider
  └── API key from env var (or per-user encrypted)
  └── Same abstraction: AI_BASE_URL, AI_MODEL, AI_API_KEY
```

### Provider abstraction is already minimal

The current `aiTestGeneratorV2.js` design is production-ready:
- `callChatCompletion()` builds headers differently for Ollama vs cloud
- `REQUIREMENT_ONLY_PROMPT` vs `AI_V2_PROMPT` handles contract-grounded vs requirement-only
- Diagnostics provide structured error classification
- Retry logic with backoff and timeout

**No abstraction change needed.** The MVP architecture already supports this.

---

## 8. Deployment Architecture

### Minimum production deployment

```
┌─────────────┐
│   Browser   │
│  (React SPA)│
└──────┬──────┘
       │ HTTPS
       ▼
┌──────────────────────┐
│  Reverse Proxy       │  ← nginx or Caddy (TLS termination)
│  /api/* → backend    │
│  /* → static files   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Backend (Node.js)   │  ← Single process, no microservices
│  Port 3000 internal  │
│                      │
│  Auth Middleware      │
│  Ownership Guard      │
│  All /api/* routes    │
│  AI Provider Client   │
│  Target API Executor  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  PostgreSQL          │  ← Single instance
│  (Supabase/Render/   │
│   Railway/AWS RDS)   │
└──────────────────────┘

AI Provider (external)
  ├── Ollama (same machine or LAN)
  └── OpenAI / configurable (internet)

Target APIs Under Test
  └── Internet reachable (customer's APIs)
```

**Recommended deployment platforms (single command):**
- **Render**: Monolith deploy — backend + static files
- **Railway**: Same pattern
- **Fly.io**: Same pattern
- **VPS (DigitalOcean)**: nginx + `node server.js` + PostgreSQL

**Less than $20/month at MVP-SaaS scale.**

---

## 9. Migration Strategy

**Core principle:** Incremental migration that preserves the working MVP testing pipeline at every step.

### Phase 1 — Auth Shell (no DB migration yet)
```
Add user registration/login with file-based user storage
Add JWT middleware on /api/*
Add userId to project creation
Continue using file storage for everything else
Testing pipeline: NOT disrupted — just requires auth token
Files changed: server.js, new src/auth/*
```

### Phase 2 — Project Ownership
```
Add ownership check to every project-scoped route
Projects table gets userId
Existing file-based repos continue working
Testing pipeline: Auth token required, ownership verified
Files changed: ProjectRepository.js, server.js routes
```

### Phase 3 — Database Migration (one repository at a time)
```
Replace file-backed repositories with PostgreSQL:
  1. projects (first — already scoped)
  2. services + api_models
  3. project_knowledge + relationships
  4. runs

Each migration preserves the repository API (saveRun, listServices, etc.)
Replace implementation underneath, test with existing test suite
Testing pipeline: Runs against DB instead of files, same behavior
```

### Phase 4 — Secrets Hardening
```
Move all secrets from .env to env vars in deployment platform
Add encryption for per-user AI keys if needed
Verify runtime redaction covers all routes
Testing pipeline: No disruption
```

### Phase 5 — Final Cleanup
```
Remove file storage directories
Remove seedDefaultProject() hardcoded path
Add rate limiting
Remove `Access-Control-Allow-Origin: *`
Production build pipeline (CI/CD)
```

**The testing pipeline is never broken** because each phase is:
1. Add new capability
2. Verify existing tests pass
3. Remove old path
4. Repeat

---

## 10. Summary

| Area | Recommendation | Complexity |
|------|---------------|-----------|
| **Authentication** | JWT + session-based. Register/Login routes. Auth middleware for /api/* | 1-2 days |
| **Ownership** | `projects.user_id` FK. Ownership guard middleware. No change to project-scoped entities | 1 day |
| **Persistence** | PostgreSQL, 6 tables, JSONB for flexible data. Migrate file repos one at a time | 3-5 days |
| **Secrets** | Env vars for infrastructure. Runtime redaction already done. AES-256-GCM for per-user keys | 1 day |
| **AI Provider** | Current abstraction is production-ready. No changes needed | 0 days |
| **Deployment** | Single Node.js process + PostgreSQL + nginx. $20/mo minimum | 1 day |
| **Migration** | 5 phases, incremental, testing pipeline never breaks | 5-7 days total |

### Implementation Phases (maximum 5)

1. **Auth + Ownership** (2 days) — Register, Login, JWT middleware, project ownership guard
2. **Project DB** (1 day) — `users` + `projects` tables, migrate ProjectRepository to PostgreSQL
3. **Service/Knowledge DB** (2 days) — Migrate ServiceRepository, ProjectKnowledgeService, RunRepository to PostgreSQL
4. **Secrets + Rate Limiting** (1 day) — Environment variable hardening, rate limiting middleware, CORS tightening
5. **Deployment** (1 day) — Production build pipeline, reverse proxy config, database provisioning