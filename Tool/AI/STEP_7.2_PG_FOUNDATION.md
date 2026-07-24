# STEP 7.2 — PostgreSQL Foundation Design

**Type:** READ-ONLY AUDIT  
**Goal:** Design minimum PostgreSQL foundation preserving current domain models and repository APIs

---

## 1. Recommended Tables

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | `gen_random_uuid()` |
| email | TEXT UNIQUE NOT NULL | |
| password_hash | TEXT NOT NULL | bcrypt, never plaintext |
| name | TEXT | optional display name |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `projects`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | Preserves existing projectId (e.g. "default", "step5-11-regression") |
| user_id | UUID NOT NULL → users(id) | Ownership FK. Allows NULL temporarily during migration |
| name | TEXT NOT NULL | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `services`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | Preserves existing serviceId (e.g. "svc-auth") |
| project_id | TEXT NOT NULL → projects(id) | Composite PK |
| name | TEXT NOT NULL | |
| protocol | TEXT DEFAULT 'rest' | "rest" or "graphql" |
| description | TEXT DEFAULT '' | |
| data | JSONB DEFAULT '{}' | Future flexibility |
| created_at | TIMESTAMPTZ | |
| PRIMARY KEY | (project_id, id) | |

### `api_models`
| Column | Type | Notes |
|--------|------|-------|
| service_id | TEXT NOT NULL | Matches services.id |
| project_id | TEXT NOT NULL → projects(id) | Composite PK |
| title | TEXT | |
| base_url | TEXT | |
| source_type | TEXT DEFAULT 'openapi' | "openapi", "postman", "har" |
| **operations** | **JSONB NOT NULL DEFAULT '[]'** | **Array of `ApiOperation` objects** |
| data | JSONB DEFAULT '{}' | Full parsed contract if needed |
| created_at | TIMESTAMPTZ | |
| PRIMARY KEY | (project_id, service_id) | |

### `project_knowledge`
| Column | Type | Notes |
|--------|------|-------|
| project_id | TEXT PK → projects(id) | |
| instructions | TEXT DEFAULT '' | |
| **relationships** | **JSONB NOT NULL DEFAULT '[]'** | **Array of KnowledgeRelationship objects** |
| status | TEXT DEFAULT 'active' | |
| data | JSONB DEFAULT '{}' | |
| updated_at | TIMESTAMPTZ | |

### `runs`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | Preserves existing runId |
| project_id | TEXT NOT NULL → projects(id) | Composite PK |
| title | TEXT | |
| description | TEXT DEFAULT '' | |
| status | TEXT DEFAULT 'pending' | |
| **target_operation** | **JSONB** | `{ serviceId, operationId }` |
| **results** | **JSONB NOT NULL DEFAULT '[]'** | **Array of step results** |
| **execution_plan** | **JSONB** | **Snapshotted ExecutionPlan** |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| duration_ms | INTEGER DEFAULT 0 | |
| data | JSONB DEFAULT '{}' | Any misc metadata |
| created_at | TIMESTAMPTZ | |
| PRIMARY KEY | (project_id, id) | |

**6 tables. No more.**

---

## 2. Decision: KnowledgeRelationships stay inside project_knowledge

**Recommendation: Remain JSONB inside `project_knowledge.relationships`.**

Reasons:
- Relationships are always loaded/saved as a set alongside project knowledge
- `ProjectKnowledgeService.analyzeAndStoreProposals()` reads all relationships, deduplicates, merges, and rewrites the array
- `buildExecutionPlan()` iterates the full array — it does not query individual relationships
- A separate `knowledge_relationships` table would add JOIN complexity with no query benefit at MVP-SaaS scale
- JSONB preserves the existing `createKnowledgeRelationship()` domain model unchanged

**Verdict:** Keep as JSONB column. If query patterns change (e.g. per-relationship status filtering at scale), extract to a separate table later. Do not pre-optimize.

---

## 3. JSONB Field Summary

| Table | JSONB Column | Contents | Why JSONB |
|-------|-------------|----------|-----------|
| `api_models` | `operations` | Array of `{ id, method, path, protocol, operationType, summary, description }` | Flexible shape per provider/contract type. Schema varies between OpenAPI/Postman/HAR. |
| `project_knowledge` | `relationships` | Array of `KnowledgeRelationship` objects | Always loaded as a set. No individual row queries. |
| `runs` | `target_operation` | `{ serviceId, operationId }` | Simple nested object, no query needed |
| `runs` | `results` | Array of step results with request/response/error/validation | Variable shape per test type |
| `runs` | `execution_plan` | Snapshotted ExecutionPlan | Preserves the plan at execution time for audit |
| `runs` | `data` | Any misc metadata | Open-ended future use |
| `services` | `data` | Future flexibility | Currently empty, reserved |
| `api_models` | `data` | Full raw contract (optional) | Some customers may want to store the original OpenAPI spec |

**Do NOT normalize further.** These are inherently flexible/denormalized data that would require schema migrations for every new field.

---

## 4. Repository Migration Design

### Pattern: Adapter behind same interface

```
Current callers (server.js, domain services, execution engines)
    │
    ▼
Repository API (unchanged interface)
    │
    ├── FileRepository (current, will be kept as fallback)
    │       └── data/projects/*.json, data/services/*/*.json, etc.
    │
    └── PostgresRepository (new, will become default)
            └── SELECT/INSERT/UPDATE on PostgreSQL tables
```

### Migration per repository

| Repository | Current API Methods | Migration Strategy |
|------------|-------------------|-------------------|
| **ProjectRepository** | `createProject`, `getProject`, `listProjects`, `projectExists`, `seedDefaultProject` | 1. Add `user_id` column. 2. Replace file reads with `SELECT`. 3. Keep `seedDefaultProject` as a DB upsert. |
| **ServiceRepository** | `createService`, `getService`, `listServices`, `saveApiModel`, `getApiModel`, `serviceExists` | 1. Replace file writes with `INSERT ... ON CONFLICT`. 2. `operations` stored as JSONB. 3. `base_url` stays as column for queries. |
| **ProjectKnowledgeRepository** | `getProjectKnowledge`, `saveProjectKnowledge`, `projectKnowledgeExists` | 1. Replace file reads/writes with `SELECT`/`UPSERT`. 2. `relationships` stored as JSONB. |
| **RunRepository** | `saveRun`, `getRun`, `listRuns`, `deleteRun` | 1. Replace file reads/writes with SQL. 2. `results`, `execution_plan` stored as JSONB. 3. `listRuns` uses `ORDER BY created_at DESC`. |

### What does NOT change

- `testCaseGenerator.js` — generates TestCases, has no DB interaction
- `testCaseMatcher.js` — matches to APIs, uses in-memory models
- `testSpecificationBridge.js` — converts between domain models
- `ExecutionPlan.js` / `DependencyResolver.js` — pure computation, no storage
- `DependencyAwareExecutor.js` — executes HTTP requests, returns results
- All domain model factories (`createTestCase`, `createServiceDefinition`, `createApiModel`, `createKnowledgeRelationship`, `createProjectKnowledge`) — unchanged
- All server.js route handlers — unchanged (they call repository APIs, not SQL)

---

## 5. Existing JSON Migration Strategy

### Principle: IDs are preserved exactly

File-based storage uses JSON files named `{safeName(id)}.json`.
PostgreSQL uses the same IDs as primary key values.

### Migration path per entity

**Step 1 — `projects`:**
```sql
INSERT INTO projects (id, user_id, name, created_at, updated_at)
SELECT data->>'id', NULL, data->>'name', 
       (data->>'createdAt')::timestamptz, (data->>'updatedAt')::timestamptz
FROM json_each_text(pg_read_file('data/projects/*.json'));  -- pseudocode
```
`user_id = NULL` initially. Backfilled after auth is wired.

**Step 2 — `services`:**
```sql
INSERT INTO services (id, project_id, name, protocol, description)
SELECT data->>'id', 'default', data->>'name', data->>'protocol', data->>'description'
FROM json_each_text(...);
```

**Step 3 — `api_models`:**
```sql
INSERT INTO api_models (service_id, project_id, title, base_url, operations)
SELECT data->>'serviceId', 'default', data->>'title', data->>'baseUrl', (data->>'operations')::jsonb
FROM json_each_text(...);
```

**Step 4 — `project_knowledge`:**
```sql
INSERT INTO project_knowledge (project_id, instructions, relationships)
SELECT data->>'projectId', data->>'instructions', (data->>'relationships')::jsonb
FROM json_each_text(...);
```

**Step 5 — `runs`:**
```sql
INSERT INTO runs (id, project_id, title, status, results, created_at)
SELECT data->>'id', data->>'projectId', data->>'title', data->>'status',
       (data->>'results')::jsonb, (data->>'createdAt')::timestamptz
FROM json_each_text(...);
```

### Key guarantees
- `projectId` ("default", "step5-11-regression", etc.) → TEXT primary key, unchanged
- `serviceId` ("svc-auth", etc.) → TEXT in composite PK `(project_id, id)`, unchanged
- `operationId` → stays inside `api_models.operations` JSONB, unchanged
- `runId` → TEXT in composite PK `(project_id, id)`, unchanged
- TestCase/spec IDs → never stored in DB (generated ephemerally), no migration needed

**No ID transformation required. The same strings work in both systems.**

---

## 6. PostgreSQL Library Recommendation

### Choice: `pg` (node-postgres)

**No Prisma. No Drizzle. No ORM.**

### Why `pg`

| Consideration | Assessment |
|---------------|-----------|
| **Current architecture** | Pure Node.js with `http` module. No Express, no framework. Adding Prisma's schema engine + client generation would be the largest dependency in the project. |
| **Repository API surface** | Each repository has 3-5 methods with simple CRUD. `pg` raw queries are ~5 lines each. An ORM adds zero value here. |
| **JSONB support** | `pg` handles JSONB natively. Queries like `SELECT * FROM api_models WHERE operations @> '[{"method":"GET"}]'` work directly. |
| **Connection pooling** | `pg.Pool` built in. |
| **Migration tooling** | `pg` + raw `.sql` files. No migration framework needed for 6 tables. |
| **Bundle size** | Tiny. No code generation step. |
| **Learning curve** | Zero for any developer who knows SQL. |

### Rejection of alternatives

- **Prisma:** Adds schema definition language, code generation, and a client layer. Overkill for 6 tables and 5 query patterns per table. Would be the biggest dependency change since the project started.
- **Drizzle:** Lighter than Prisma but still adds query builder abstraction. `pg` raw queries are already concise for this surface area.
- **Knex:** Query builder only. Adds a dependency but no real benefit over `pg` for simple CRUD.

### Recommended setup

```js
// src/db/pool.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// src/db/migrate.js — run once at startup
const fs = require('fs');
const path = require('path');
async function runMigrations() {
  const sql = fs.readFileSync(path.join(__dirname, '001-schema.sql'), 'utf8');
  await pool.query(sql);
}

// Usage in repository:
const { rows } = await pool.query(
  'SELECT * FROM projects WHERE id = $1',
  [projectId]
);
```

**No schema engine. No code generation. No CLI. Just SQL files and `pg.query()`.**

---

## 7. Implementation Order (maximum 4 steps)

### Step 1 — Database connection + schema
- Add `pg` npm dependency
- Create `src/db/pool.js`
- Create `src/db/001-schema.sql` with all 6 tables
- Run migration on server startup
- **Testing pipeline:** Unchanged. Server still reads/writes files.

### Step 2 — Projects + Services to PostgreSQL
- Create `PostgresProjectRepository.js` and `PostgresServiceRepository.js`
- Both implement the same API as the file-based versions
- Add a config toggle: `PG_ENABLED=true` switches repos
- Run `migration-export.js` to dump existing JSON files into PostgreSQL
- **Testing pipeline:** Toggle PG=true, run existing tests, verify same results. Toggle PG=false to revert.

### Step 3 — Project Knowledge + Runs to PostgreSQL
- Create `PostgresProjectKnowledgeRepository.js` and `PostgresRunRepository.js`
- Same toggle-based approach
- JSONB columns absorb relationships, results, execution plans unchanged
- **Testing pipeline:** Same toggle approach. Tests pass with either backend.

### Step 4 — Remove file fallback
- Make PostgreSQL the default (remove toggle)
- Remove file-based repository code or keep as dead code for reference
- Remove `data/` directory from production image
- Run full regression: `test-domain-TestCases.js`, all frontend tests, TypeScript check
- **Testing pipeline:** Permanently on PostgreSQL. All tests pass.

**Each step is independently deployable and revertible.**

---

## 8. Risks / Blockers

| Risk | Severity | Mitigation |
|------|----------|-----------|
| File-based repos work fine today — no urgency to migrate | LOW | Correct. Steps 2-3 are parallelizable, not blocking. Step 1 (schema) can be done immediately. |
| JSON files may have inconsistent date formats | LOW | Migration script uses `try/catch` + `COALESCE` per row. Invalid rows logged, not failed. |
| `pg` requires native build tools on Windows | LOW | `pg` has prebuilt binaries via `pg-native` optional. Pure JavaScript fallback works. |
| `seedDefaultProject()` hardcodes "default" project | MEDIUM | Migration must handle this — upsert on startup. New SaaS users get their own project, not the default. |
| Existing relationships use nested objects, not flat JSON | LOW | JSONB stores whatever is given. `createKnowledgeRelationship()` normalizes on read. No schema mismatch. |
| Postgres not running = server crash at startup | MEDIUM | Make `DATABASE_URL` optional at first. Server starts in file-only mode when PG not configured. Graceful degradation. |

**No blockers.** The migration is low-risk because:
- File-based and PostgreSQL repos share the same interface
- Toggle between them at any time
- JSONB columns absorb existing data shapes without schema changes
- IDs are preserved exactly — no data transformation needed