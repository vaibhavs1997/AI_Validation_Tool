const { getPool, checkConnection } = require("../../db/pool");
const { DEFAULT_PROJECT } = require("../ProjectIdentity");
const { createProjectKnowledge } = require("../ProjectKnowledge");
const { createKnowledgeRelationship } = require("../KnowledgeRelationship");
const { projectExists: projectExistsInProjectRepo } = require("../ProjectRepository");

async function resolveProjectExistence(projectId) {
  const resolved = typeof projectId === "string" ? projectId.trim() : "";
  if (!resolved) {
    throw new Error("projectId must be a non-empty string.");
  }
  if (resolved === DEFAULT_PROJECT.id) return resolved;
  const exists = await Promise.resolve(projectExistsInProjectRepo(resolved));
  if (!exists) {
    throw new Error(`Unknown projectId: ${resolved}`);
  }
  return resolved;
}

async function ensureProjectRow(projectId) {
  await getPool().query(
    `INSERT INTO projects (id, name)
     VALUES ($1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [projectId]
  );
}

function normalizeRelationships(relationships) {
  return Array.isArray(relationships) ? relationships.map((rel) => createKnowledgeRelationship(rel)) : [];
}

async function getProjectKnowledge(projectId) {
  const resolvedProjectId = await resolveProjectExistence(projectId);
  const result = await getPool().query(
    `SELECT project_id, instructions, relationships, data, updated_at
     FROM project_knowledge
     WHERE project_id = $1
     LIMIT 1`,
    [resolvedProjectId]
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const doc = row.data && typeof row.data === "object" ? row.data : {};
  const instructions = typeof row.instructions === "string" ? row.instructions : doc.instructions || "";
  const relationships = normalizeRelationships(Array.isArray(row.relationships) ? row.relationships : doc.relationships || []);
  return createProjectKnowledge({
    projectId: resolvedProjectId,
    instructions,
    relationships,
    createdAt: doc.createdAt || row.updated_at || undefined,
    updatedAt: doc.updatedAt || row.updated_at || undefined,
  });
}

async function saveProjectKnowledge(projectId, instructions, relationships) {
  const resolvedProjectId = await resolveProjectExistence(projectId);
  await ensureProjectRow(resolvedProjectId);
  const existing = await getProjectKnowledge(resolvedProjectId);
  const now = new Date();
  const normalizedRelationships = normalizeRelationships(relationships);
  const nextInstructions = instructions !== undefined ? String(instructions) : existing ? existing.instructions : "";

  const knowledge = {
    projectId: resolvedProjectId,
    instructions: nextInstructions,
    relationships: normalizedRelationships,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };

  await getPool().query(
    `INSERT INTO project_knowledge (project_id, instructions, relationships, status, data, updated_at)
     VALUES ($1, $2, $3::jsonb, 'active', $4::jsonb, now())
     ON CONFLICT (project_id)
     DO UPDATE SET
       instructions = EXCLUDED.instructions,
       relationships = EXCLUDED.relationships,
       data = EXCLUDED.data,
       updated_at = now()`,
    [
      resolvedProjectId,
      nextInstructions,
      JSON.stringify(normalizedRelationships),
      JSON.stringify(knowledge),
    ]
  );

  return knowledge;
}

async function projectKnowledgeExists(projectId) {
  const resolvedProjectId = await resolveProjectExistence(projectId);
  const result = await getPool().query(
    `SELECT 1
     FROM project_knowledge
     WHERE project_id = $1
     LIMIT 1`,
    [resolvedProjectId]
  );
  return result.rows.length > 0;
}

function getBackendName() {
  return "postgres";
}

async function ensureReady() {
  await checkConnection();
  await getPool().query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'project_knowledge'
       AND column_name IN ('project_id','instructions','relationships','data','updated_at')`
  );
  return true;
}

module.exports = {
  getProjectKnowledge,
  saveProjectKnowledge,
  projectKnowledgeExists,
  getBackendName,
  ensureReady,
};
