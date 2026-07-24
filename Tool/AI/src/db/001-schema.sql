-- STEP 7.3A — PostgreSQL Foundation Schema
-- Run once at server startup when PG_ENABLED=true.
-- Idempotent: uses IF NOT EXISTS for all CREATE statements.

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name        TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
    id          TEXT NOT NULL,
    project_id  TEXT NOT NULL REFERENCES projects(id),
    name        TEXT NOT NULL,
    protocol    TEXT DEFAULT 'rest',
    description TEXT DEFAULT '',
    data        JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (project_id, id)
);

CREATE TABLE IF NOT EXISTS api_models (
    service_id  TEXT NOT NULL,
    project_id  TEXT NOT NULL REFERENCES projects(id),
    title       TEXT,
    base_url    TEXT,
    source_type TEXT DEFAULT 'openapi',
    operations  JSONB NOT NULL DEFAULT '[]',
    data        JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (project_id, service_id)
);

CREATE TABLE IF NOT EXISTS project_knowledge (
    project_id   TEXT PRIMARY KEY REFERENCES projects(id),
    instructions TEXT DEFAULT '',
    relationships JSONB NOT NULL DEFAULT '[]',
    status       TEXT DEFAULT 'active',
    data         JSONB DEFAULT '{}',
    updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
    id               TEXT NOT NULL,
    project_id       TEXT NOT NULL REFERENCES projects(id),
    title            TEXT,
    description      TEXT DEFAULT '',
    status           TEXT DEFAULT 'pending',
    target_operation JSONB,
    results          JSONB NOT NULL DEFAULT '[]',
    execution_plan   JSONB,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    duration_ms      INTEGER DEFAULT 0,
    data             JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (project_id, id)
);