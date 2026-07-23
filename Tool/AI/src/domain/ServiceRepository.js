/**
 * ServiceRepository
 *
 * Project-scoped persistence for ServiceDefinition and canonical ApiModel.
 * Uses JSON file buckets under data/services and data/api-models.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const { DEFAULT_PROJECT, getDefaultProjectIdentity } = require("./ProjectIdentity");
const { createServiceDefinition } = require("./ServiceDefinition");
const { createApiModel } = require("./ApiModel");
const { projectExists: projectExistsInProjectRepo } = require("./ProjectRepository");

const SERVICES_DIR = path.join(config.dataDir, "services");
const API_MODELS_DIR = path.join(config.dataDir, "api-models");

function ensureStorage() {
  if (!fs.existsSync(SERVICES_DIR)) fs.mkdirSync(SERVICES_DIR, { recursive: true });
  if (!fs.existsSync(API_MODELS_DIR)) fs.mkdirSync(API_MODELS_DIR, { recursive: true });
}

function safeName(value) {
  const str = String(value || crypto.randomUUID());
  const hasSpecial = /[^a-zA-Z0-9._-]/.test(str);
  const sanitized = str
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  if (hasSpecial && !str.startsWith(sanitized)) {
    const hash = crypto.createHash("md5").update(str).digest("hex").slice(0, 6);
    return `${sanitized}-${hash}`;
  }
  return sanitized || crypto.randomUUID().slice(0, 12);
}

function validateProjectId(projectId) {
  if (typeof projectId !== 'string' || projectId.trim().length === 0) {
    throw new Error('projectId must be a non-empty string.');
  }
  return projectId.trim();
}

/**
 * Create a service under a project.
 */
function resolveProjectExistence(projectId) {
  const resolved = validateProjectId(projectId);
  if (resolved === DEFAULT_PROJECT.id) return getDefaultProjectIdentity();
  if (!projectExistsInProjectRepo(resolved)) {
    throw new Error(`Unknown projectId: ${resolved}`);
  }
  return null;
}

function createService(projectId, input) {
  ensureStorage();
  const resolvedProjectId = validateProjectId(projectId);
  resolveProjectExistence(resolvedProjectId);

  const service = createServiceDefinition({
    id: input.id,
    name: input.name,
    protocol: input.protocol,
    description: input.description,
  });

  const projectDir = path.join(SERVICES_DIR, safeName(resolvedProjectId));
  if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

  const file = path.join(projectDir, `${safeName(service.id)}.json`);
  if (fs.existsSync(file)) {
    throw new Error(`Service already exists in project ${resolvedProjectId}: ${service.id}`);
  }

  fs.writeFileSync(file, JSON.stringify(service, null, 2), "utf8");
  return { ...service, projectId: resolvedProjectId };
}

/**
 * Get a service by projectId and serviceId.
 */
function getService(projectId, serviceId) {
  ensureStorage();
  const resolvedProjectId = validateProjectId(projectId);
  resolveProjectExistence(resolvedProjectId);
  const file = path.join(SERVICES_DIR, safeName(resolvedProjectId), `${safeName(serviceId)}.json`);
  if (!fs.existsSync(file)) return null;

  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return { ...data, projectId: resolvedProjectId };
}

/**
 * List all services for a project.
 */
function listServices(projectId) {
  ensureStorage();
  const resolvedProjectId = validateProjectId(projectId);
  resolveProjectExistence(resolvedProjectId);
  const projectDir = path.join(SERVICES_DIR, safeName(resolvedProjectId));
  if (!fs.existsSync(projectDir)) return [];

  return fs
    .readdirSync(projectDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(projectDir, file);
      const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      return { ...data, projectId: resolvedProjectId };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Save an API model for a service within a project.
 */
function saveApiModel(projectId, serviceId, input) {
  ensureStorage();
  const resolvedProjectId = validateProjectId(projectId);
  resolveProjectExistence(resolvedProjectId);

  if (!getService(resolvedProjectId, serviceId)) {
    throw new Error(`Service not found in project ${resolvedProjectId}: ${serviceId}`);
  }

  const model = createApiModel({
    service: { id: serviceId, name: serviceId, protocol: input.service?.protocol || 'rest' },
    sourceType: input.sourceType,
    title: input.title,
    baseUrl: input.baseUrl,
    operations: input.operations || [],
  });

  const file = path.join(API_MODELS_DIR, safeName(resolvedProjectId), `${safeName(serviceId)}.json`);
  if (!fs.existsSync(path.dirname(file))) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  fs.writeFileSync(file, JSON.stringify(model, null, 2), "utf8");
  return { ...model, projectId: resolvedProjectId, serviceId };
}

/**
 * Get an API model by projectId and serviceId.
 */
function getApiModel(projectId, serviceId) {
  ensureStorage();
  const resolvedProjectId = validateProjectId(projectId);
  resolveProjectExistence(resolvedProjectId);
  const file = path.join(API_MODELS_DIR, safeName(resolvedProjectId), `${safeName(serviceId)}.json`);
  if (!fs.existsSync(file)) return null;

  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return { ...data, projectId: resolvedProjectId, serviceId };
}

/**
 * Check whether a service exists in a project.
 */
function serviceExists(projectId, serviceId) {
  ensureStorage();
  const resolvedProjectId = validateProjectId(projectId);
  if (!resolveProjectExistence(resolvedProjectId)) {
    return fs.existsSync(path.join(SERVICES_DIR, safeName(resolvedProjectId), `${safeName(serviceId)}.json`));
  }
  return false;
}

module.exports = {
  createService,
  getService,
  listServices,
  saveApiModel,
  getApiModel,
  serviceExists,
  validateProjectId,
};