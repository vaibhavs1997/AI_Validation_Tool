const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const storage = require("../storage");

const generationsDir = storage.buckets.generations;

function ensureStorage() {
  if (!fs.existsSync(generationsDir)) fs.mkdirSync(generationsDir, { recursive: true });
}

function safeId(value) {
  const str = String(value || crypto.randomUUID());
  const hasSpecial = /[^a-zA-Z0-9._-]/.test(str);
  const sanitized = str.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
  if (hasSpecial && !str.startsWith(sanitized)) {
    const hash = crypto.createHash("md5").update(str).digest("hex").slice(0, 6);
    return `${sanitized}-${hash}`;
  }
  return sanitized || crypto.randomUUID().slice(0, 12);
}

function filePath(id) {
  return path.join(generationsDir, `${safeId(id)}.json`);
}

function readGeneration(id) {
  const file = filePath(id);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveGeneration(record) {
  ensureStorage();
  const id = record.id;
  const file = filePath(id);
  fs.writeFileSync(file, JSON.stringify(record, null, 2), "utf8");
  return { id, file };
}

function updateGeneration(id, patch) {
  const existing = readGeneration(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  saveGeneration(updated);
  return updated;
}

function createGeneration({ projectId, requirement, startedAt }) {
  const id = crypto.randomUUID().slice(0, 12);
  const record = {
    id,
    projectId,
    requirement,
    status: "in_progress",
    startedAt: startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    testCases: null,
    diagnostics: null,
    warnings: null,
    error: null,
  };
  saveGeneration(record);
  return record;
}

module.exports = {
  createGeneration,
  readGeneration,
  updateGeneration,
  saveGeneration,
};