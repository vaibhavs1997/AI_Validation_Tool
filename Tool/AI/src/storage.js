const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");

const buckets = {
  tickets: path.join(config.dataDir, "tickets"),
  contracts: path.join(config.dataDir, "contracts"),
  runs: path.join(config.dataDir, "runs"),
  reports: path.join(config.dataDir, "reports"),
};

function ensureStorage() {
  for (const dir of Object.values(buckets)) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function safeName(value) {
  const str = String(value || crypto.randomUUID());
  const hasSpecial = /[^a-zA-Z0-9._-]/.test(str);
  const sanitized = str
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  // Append short hash when input had special characters to avoid collisions
  if (hasSpecial && !str.startsWith(sanitized)) {
    const hash = crypto.createHash("md5").update(str).digest("hex").slice(0, 6);
    return `${sanitized}-${hash}`;
  }
  return sanitized || crypto.randomUUID().slice(0, 12);
}

function saveJson(bucket, id, data) {
  ensureStorage();
  const dir = buckets[bucket];
  if (!dir) throw new Error(`Unknown storage bucket: ${bucket}`);

  const safeId = safeName(id);
  const file = path.join(dir, `${safeId}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return { id: safeId, file };
}

function readJson(bucket, id) {
  const dir = buckets[bucket];
  if (!dir) throw new Error(`Unknown storage bucket: ${bucket}`);

  const file = path.join(dir, `${safeName(id)}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listJson(bucket) {
  ensureStorage();
  const dir = buckets[bucket];
  if (!dir) throw new Error(`Unknown storage bucket: ${bucket}`);

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      return {
        id: path.basename(file, ".json"),
        updatedAt: stat.mtime.toISOString(),
        size: stat.size,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function summarizeRun(run, stat) {
  const ticketKey = run.ticket?.key || "manual";
  const summary = run.summary || {};
  const createdAt = run.createdAt || stat.mtime.toISOString();
  const total = summary.total || 0;
  const terminal = (summary.passed || 0) + (summary.failed || 0);
  const passRate = terminal > 0 ? Math.round(((summary.passed || 0) / terminal) * 100) : 0;

  return {
    id: run.id,
    ticketKey,
    ticketSummary: run.ticket?.summary || "",
    contractTitle: run.contract?.title || "",
    environment: run.environment?.name || "local",
    baseUrl: run.environment?.baseUrl || "",
    dryRun: Boolean(run.environment?.dryRun),
    createdAt,
    updatedAt: stat.mtime.toISOString(),
    summary: {
      total,
      passed: summary.passed || 0,
      failed: summary.failed || 0,
      blocked: summary.blocked || 0,
      needs_review: summary.needs_review || 0,
      dry_run: summary.dry_run || 0,
    },
    passRate,
    reportUrl: `/api/reports/${encodeURIComponent(run.id)}.html`,
    jsonUrl: `/api/runs/${encodeURIComponent(run.id)}`,
  };
}

function listRunSummaries() {
  ensureStorage();
  const runs = fs
    .readdirSync(buckets.runs)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(buckets.runs, file);
      const stat = fs.statSync(fullPath);
      try {
        const run = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        return summarizeRun(run, stat);
      } catch (error) {
        return {
          id: path.basename(file, ".json"),
          ticketKey: "unreadable",
          ticketSummary: error.message,
          contractTitle: "",
          environment: "",
          baseUrl: "",
          dryRun: false,
          createdAt: stat.mtime.toISOString(),
          updatedAt: stat.mtime.toISOString(),
          summary: { total: 0, passed: 0, failed: 0, blocked: 0, needs_review: 0, dry_run: 0 },
          passRate: 0,
          reportUrl: "",
          jsonUrl: "",
        };
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const grouped = new Map();
  for (const run of runs) {
    if (!grouped.has(run.ticketKey)) {
      grouped.set(run.ticketKey, {
        ticketKey: run.ticketKey,
        ticketSummary: run.ticketSummary,
        runCount: 0,
        latestRunAt: run.createdAt,
        latestRunId: run.id,
        summary: { total: 0, passed: 0, failed: 0, blocked: 0, needs_review: 0, dry_run: 0 },
      });
    }

    const group = grouped.get(run.ticketKey);
    group.runCount += 1;
    if (run.createdAt > group.latestRunAt) {
      group.latestRunAt = run.createdAt;
      group.latestRunId = run.id;
      group.ticketSummary = run.ticketSummary;
    }
    for (const key of Object.keys(group.summary)) {
      group.summary[key] += run.summary[key] || 0;
    }
  }

  const tickets = Array.from(grouped.values()).sort((a, b) => b.latestRunAt.localeCompare(a.latestRunAt));
  const totals = runs.reduce(
    (acc, run) => {
      acc.runs += 1;
      acc.tickets.add(run.ticketKey);
      for (const key of Object.keys(acc.summary)) {
        acc.summary[key] += run.summary[key] || 0;
      }
      return acc;
    },
    {
      runs: 0,
      tickets: new Set(),
      summary: { total: 0, passed: 0, failed: 0, blocked: 0, needs_review: 0, dry_run: 0 },
    }
  );

  return {
    runs,
    tickets,
    totals: {
      runs: totals.runs,
      tickets: totals.tickets.size,
      summary: totals.summary,
    },
  };
}

function saveReport(id, html) {
  ensureStorage();
  const safeId = safeName(id);
  const file = path.join(buckets.reports, `${safeId}.html`);
  fs.writeFileSync(file, html, "utf8");
  return { id: safeId, file };
}

function reportPath(id) {
  return path.join(buckets.reports, `${safeName(id)}.html`);
}

function deleteRun(id) {
  const safeId = safeName(id);
  const runFile = path.join(buckets.runs, `${safeId}.json`);
  const reportFile = path.join(buckets.reports, `${safeId}.html`);

  if (fs.existsSync(runFile)) {
    fs.unlinkSync(runFile);
  }
  if (fs.existsSync(reportFile)) {
    fs.unlinkSync(reportFile);
  }
  return { id: safeId, deleted: true };
}

module.exports = {
  buckets,
  deleteRun,
  ensureStorage,
  listJson,
  listRunSummaries,
  readJson,
  reportPath,
  safeName,
  saveJson,
  saveReport,
};
