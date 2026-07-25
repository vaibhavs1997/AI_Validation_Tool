# TestForge — Sprint 01: Project Foundation

## Database Model

**Document Version:** 1.0
**Sprint:** Sprint 01
**Date:** 2026-07-25
**Author:** Lead Product Architect

---

## 1. Overview

This document describes the database model for Sprint 01: Project Foundation. The sprint focuses on project management entities. The existing codebase supports dual persistence: file-based (default) and PostgreSQL (optional).

### 1.1 Persistence Strategy

| Backend | Storage Location | Format | Default |
|---------|-----------------|--------|---------|
| File-based | `data/projects/*.json` | JSON files | Yes |
| PostgreSQL | `projects` table | Relational | No (opt-in) |

Both backends implement the same repository interface, ensuring identical behavior regardless of the persistence choice.

---

## 2. Entity: Project

### 2.1 Entity Definition

The `Project` entity is the central organizational boundary for all TestForge work. It groups APIs, tests, dependencies, runs, and results.

### 2.2 Attributes

| Attribute | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string (TEXT) | Yes | — | Unique project identifier. Pattern: `[a-zA-Z0-9._-]+`. Max 100 chars. Immutable. |
| `name` | string (TEXT) | Yes | = `id` | Human-readable project name. Can be updated. |
| `createdAt` | timestamp | Yes | `now()` | ISO 8601 timestamp of project creation. Immutable. |
| `updatedAt` | timestamp | Yes | `now()` | ISO 8601 timestamp of last update. Updated on every modification. |
| `userId` | UUID (PostgreSQL only) | No | NULL | Foreign key to `users` table (for future multi-tenancy). NULL in MVP. |

### 2.3 Entity Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          Project                                │
├─────────────────────────────────────────────────────────────────┤
│  PK  id          TEXT       [a-zA-Z0-9._-]+  (1-100 chars)      │
│      name        TEXT       (defaults to id)                    │
│      createdAt   TIMESTAMPTZ (PostgreSQL) / string (file)        │
│      updatedAt   TIMESTAMPTZ (PostgreSQL) / string (file)        │
│  FK  userId      UUID       → users.id  (NULL in MVP)           │
├─────────────────────────────────────────────────────────────────┤
│  Constraints:                                                    │
│  - id is PRIMARY KEY                                             │
│  - id is UNIQUE                                                  │
│  - name is NOT NULL                                              │
│  - createdAt is NOT NULL                                         │
│  - updatedAt is NOT NULL                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Relationships

```
┌──────────┐         ┌──────────┐
│  users   │         │ projects │
├──────────┤    FK   ├──────────┤
│ id (PK)  │◄────────│ userId   │
│ email    │         │ id (PK)  │
│ name     │         │ name     │
│ ...      │         │ ...      │
└──────────┘         └──────────┘

Note: In MVP, userId is always NULL (no authentication).
Future sprints will populate this when auth is added.
```

### 2.5 Future Entities (Not in Sprint 01)

The following entities will be added in future sprints:

| Entity | Sprint | Purpose |
|--------|--------|---------|
| `services` | Sprint 02 | API services registered under a project |
| `api_models` | Sprint 02 | Parsed API contract models |
| `project_knowledge` | Sprint 03 | Project instructions and dependency relationships |
| `runs` | Sprint 05 | Test execution run history |
| `test_cases` | Sprint 04 | Generated test cases |
| `environments` | Sprint 07 | Dev/staging/production environments |

---

## 3. PostgreSQL Schema

### 3.1 Existing Schema (Unchanged)

The existing `001-schema.sql` already defines the `projects` table:

```sql
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 New Indexes (Sprint 01)

```sql
-- Index for search by name
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- Index for sorting by updated_at (descending)
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- Index for sorting by created_at (descending)
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
```

### 3.3 New Migration (Sprint 01)

File: `src/db/002-project-enhancements.sql`

```sql
-- Sprint 01: Project Foundation — Database Enhancements
-- Run after 001-schema.sql
-- Idempotent: uses IF NOT EXISTS for all CREATE statements

-- Indexes for search and sort performance
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- Trigger to auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 3.4 PostgreSQL Repository Functions

#### 3.4.1 List Projects (Enhanced)

```sql
-- With search and sort
SELECT id, name, created_at, updated_at
FROM projects
WHERE ($1::text IS NULL OR id ILIKE $1 OR name ILIKE $1)
ORDER BY
    CASE WHEN $2 = 'name' THEN name
         WHEN $2 = 'createdAt' THEN created_at
         WHEN $2 = 'updatedAt' THEN updated_at
         ELSE id END
    COLLATE "C"
    ASC NULLS LAST
-- or DESC based on $3
LIMIT $4 OFFSET $5;
```

#### 3.4.2 Update Project

```sql
UPDATE projects
SET name = $1, updated_at = now()
WHERE id = $2
RETURNING id, name, created_at, updated_at;
```

#### 3.4.3 Delete Project

```sql
DELETE FROM projects
WHERE id = $1
AND id != 'default'  -- Prevent deletion of default project
RETURNING id;
```

---

## 4. File-Based Storage

### 4.1 Directory Structure

```
data/
├── projects/
│   ├── default.json
│   ├── payments-api.json
│   └── auth-service.json
├── services/
├── knowledge/
├── runs/
├── contracts/
├── reports/
└── tickets/
```

### 4.2 File Format

Each project is stored as a JSON file:

```json
{
  "id": "payments-api",
  "name": "Payments API",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-07-20T14:22:00.000Z"
}
```

### 4.3 File Naming

- File name: `{sanitized-id}.json`
- Sanitization: `safeName()` function strips all characters except `[a-zA-Z0-9._-]`
- If the ID contains special characters, a hash is appended to prevent collisions
- Maximum file name length: 100 characters (plus `.json` extension)

### 4.4 File Operations

#### 4.4.1 Create

```javascript
// Write to file
fs.writeFileSync(
  path.join(PROJECTS_DIR, `${safeName(id)}.json`),
  JSON.stringify(project, null, 2),
  'utf8'
);
```

#### 4.4.2 Read

```javascript
// Read from file
const data = JSON.parse(
  fs.readFileSync(path.join(PROJECTS_DIR, `${safeName(id)}.json`), 'utf8')
);
```

#### 4.4.3 List

```javascript
// Read all project files
const files = fs.readdirSync(PROJECTS_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8')));
```

#### 4.4.4 Update

```javascript
// Read, modify, write
const project = getProject(id);
project.name = newName;
project.updatedAt = new Date().toISOString();
fs.writeFileSync(
  path.join(PROJECTS_DIR, `${safeName(id)}.json`),
  JSON.stringify(project, null, 2),
  'utf8'
);
```

#### 4.4.5 Delete

```javascript
// Delete file
fs.unlinkSync(path.join(PROJECTS_DIR, `${safeName(id)}.json'));
```

### 4.5 File-Based Search

Search is performed in-memory after reading all project files:

```javascript
function searchProjects(query) {
  const projects = listProjects(); // Read all files
  const lowerQuery = query.toLowerCase();
  return projects.filter(p =>
    p.id.toLowerCase().includes(lowerQuery) ||
    p.name.toLowerCase().includes(lowerQuery)
  );
}
```

---

## 5. Indexing Strategy

### 5.1 PostgreSQL Indexes

| Index Name | Table | Column(s) | Type | Purpose |
|------------|-------|-----------|------|---------|
| `projects_pkey` | projects | id | PRIMARY KEY | Fast lookup by ID |
| `idx_projects_name` | projects | name | btree | Search by name |
| `idx_projects_updated_at` | projects | updated_at | btree (DESC) | Sort by last updated |
| `idx_projects_created_at` | projects | created_at | btree (DESC) | Sort by creation date |

### 5.2 File-Based "Indexing"

File-based storage does not have traditional indexes. Instead:

- **Lookup by ID:** Direct file access via `safeName(id)` — O(1)
- **List all:** Read all files in directory — O(n) where n = number of projects
- **Search:** Read all files, filter in memory — O(n)
- **Sort:** Sort in memory — O(n log n)

For the expected scale (≤ 500 projects), this is sufficient.

---

## 6. Scalability Considerations

### 6.1 Current Scale

| Metric | Expected | Sufficient? |
|--------|----------|-------------|
| Number of projects | ≤ 500 | Yes |
| Project data size | ≤ 1KB per project | Yes |
| Concurrent users | 1 (single-user MVP) | Yes |
| API requests/sec | ≤ 10 | Yes |

### 6.2 Scaling Strategies

| Scale Factor | Strategy |
|-------------|----------|
| 1,000+ projects | Add pagination to list endpoint |
| 10,000+ projects | Migrate to PostgreSQL, add database indexes |
| 100+ concurrent users | Add authentication, user-scoped projects |
| 1M+ projects | Sharding by user ID, caching layer |

### 6.3 Future Database Changes

| Change | Sprint | Description |
|--------|--------|-------------|
| Add `user_id` foreign key | Sprint 08 | Enable multi-tenancy |
| Add `status` column | Sprint 02 | Track project lifecycle state |
| Add `metadata` JSONB column | Sprint 02 | Store project-specific settings |
| Add `last_accessed_at` column | Sprint 02 | Track recent activity |
| Add `services_count` column | Sprint 02 | Denormalized count for dashboard |
| Add `runs_count` column | Sprint 05 | Denormalized count for dashboard |
| Add `is_archived` column | Sprint 10 | Soft delete support |

---

## 7. Migration Strategy

### 7.1 Data Migration

No data migration is required for Sprint 01. The existing project data format is unchanged:

```json
{
  "id": "payments-api",
  "name": "Payments API",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-07-20T14:22:00.000Z"
}
```

### 7.2 Schema Migration

The existing `001-schema.sql` already defines the `projects` table. Sprint 01 adds:

1. **New migration file:** `002-project-enhancements.sql`
   - Adds indexes for search and sort
   - Adds trigger for auto-updating `updated_at`

2. **Migration runner:** Existing `migrate.js` will be enhanced to run multiple migrations in order

### 7.3 Migration Order

```
001-schema.sql         → Creates base tables (users, projects, etc.)
002-project-enhancements.sql → Adds indexes and triggers (Sprint 01)
```

### 7.4 Rollback Strategy

- **File-based:** Delete the migration file (no data changes)
- **PostgreSQL:** Drop indexes and triggers (no data changes)

No rollback is needed because Sprint 01 only adds indexes and triggers — no schema changes to existing tables.

---

## 8. Backup and Recovery

### 8.1 File-Based Backup

- Project data is stored as JSON files in `data/projects/`
- Backup: Copy the `data/` directory
- Recovery: Restore the `data/` directory

### 8.2 PostgreSQL Backup

- Use `pg_dump` for logical backups
- Use `pg_basebackup` for physical backups
- Recovery: Restore from backup and replay WAL logs

### 8.3 No Automated Backup in MVP

Automated backup is not implemented in the MVP. Users are responsible for backing up their data.

---

## 9. Consistency Guarantees

### 9.1 File-Based

- **Atomicity:** Single file operations are atomic (write to temp, rename)
- **Consistency:** JSON format is validated on read
- **Isolation:** No concurrent access (single-user MVP)
- **Durability:** File system provides durability

### 9.2 PostgreSQL

- **Atomicity:** Transactions ensure atomicity
- **Consistency:** Constraints ensure consistency
- **Isolation:** Row-level locking for concurrent access
- **Durability:** WAL (Write-Ahead Log) ensures durability

---

## 10. Data Integrity Rules

| Rule | Enforcement | Error Message |
|------|-------------|---------------|
| Project ID is unique | Repository check (create) | "Project already exists: {id}" |
| Project ID matches pattern | Domain validation | "Project ID must contain only alphanumeric characters, hyphens, underscores, and dots." |
| Project ID ≤ 100 chars | Domain validation | "Project ID must be at most 100 characters." |
| Project name is non-empty | Domain validation | "Project identity name must be a non-empty string." |
| Default project cannot be deleted | Repository check (delete) | "Cannot delete the default project" |
| Project exists (update/delete) | Repository check | "Project not found: {id}" |

---

*End of Database Model — Sprint 01: Project Foundation*
