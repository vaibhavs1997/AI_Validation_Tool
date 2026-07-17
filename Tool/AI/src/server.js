const fs = require("fs");
const http = require("http");
const path = require("path");
const config = require("./config");
const storage = require("./storage");
const jiraClient = require("./integrations/jiraClient");
const llmClient = require("./integrations/llmClient");
const { parseContract } = require("./contracts/contractParser");
const { compareContracts } = require("./contracts/openapiDiff");
const { generateScenarios } = require("./scenarios/scenarioGenerator");
const { executeRun } = require("./execution/executionEngine");
const { generateHtmlReport } = require("./reporting/reportGenerator");

storage.ensureStorage();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data, null, 2), {
    "Content-Type": "application/json; charset=utf-8",
  });
}

function notFound(res) {
  sendJson(res, 404, { error: "Not found" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    req.on("error", reject);
  });
}

function serveFile(res, filePath, baseDir) {
  const resolved = path.resolve(filePath);
  const base = path.resolve(baseDir);
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return notFound(res);
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) return notFound(res);

  send(res, 200, fs.readFileSync(resolved), {
    "Content-Type": contentTypes[path.extname(resolved)] || "application/octet-stream",
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      app: "AI API Validation Tool MVP",
      time: new Date().toISOString(),
    });
  }

  if (req.method === "GET" && url.pathname === "/api/config/status") {
    return sendJson(res, 200, {
      jiraConfigured: jiraClient.isConfigured(),
      aiConfigured: llmClient.isConfigured(),
      aiModel: config.ai.model,
      port: config.port,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/runs") {
    return sendJson(res, 200, storage.listRunSummaries());
  }

  const runReportMatch = url.pathname.match(/^\/api\/reports\/([^/]+)\.html$/);
  if (req.method === "GET" && runReportMatch) {
    const reportFile = storage.reportPath(runReportMatch[1]);
    if (!fs.existsSync(reportFile)) return notFound(res);
    return serveFile(res, reportFile, storage.buckets.reports);
  }

  const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
  if (req.method === "GET" && runMatch) {
    const run = storage.readJson("runs", runMatch[1]);
    return run ? sendJson(res, 200, run) : notFound(res);
  }

  if (req.method === "DELETE" && runMatch) {
    const result = storage.deleteRun(runMatch[1]);
    return sendJson(res, 200, { success: true, message: "Run deleted successfully", ...result });
  }

  if (req.method !== "POST") return notFound(res);

  const body = await readBody(req);

  if (url.pathname === "/api/jira/ticket") {
    const ticket = await jiraClient.fetchIssue(body.issueKey);
    storage.saveJson("tickets", ticket.key, ticket);
    return sendJson(res, 200, { ticket });
  }

  if (url.pathname === "/api/jira/jql") {
    const result = await jiraClient.searchIssues(body.jql, body.maxResults || 10);
    return sendJson(res, 200, result);
  }

  if (url.pathname === "/api/contracts/parse") {
    const contract = parseContract(body.contract || body.content);
    storage.saveJson("contracts", body.name || contract.title || "contract", contract);
    return sendJson(res, 200, { contract });
  }

  if (url.pathname === "/api/contracts/diff") {
    const oldContract = parseContract(body.oldContract || body.old);
    const newContract = parseContract(body.newContract || body.new);
    const diff = compareContracts(oldContract, newContract);
    return sendJson(res, 200, { diff });
  }

  if (url.pathname === "/api/scenarios/generate") {
    const result = await generateScenarios({
      ticket: body.ticket,
      contract: body.contract,
      useAi: Boolean(body.useAi),
    });
    return sendJson(res, 200, result);
  }

  if (url.pathname === "/api/runs/execute") {
    const run = await executeRun({
      ticket: body.ticket,
      contract: body.contract,
      scenarios: body.scenarios || [],
      environment: body.environment || {},
    });

    storage.saveJson("runs", run.id, run);
    const html = generateHtmlReport(run);
    storage.saveReport(run.id, html);

    return sendJson(res, 200, {
      run,
      reportUrl: `/api/reports/${encodeURIComponent(run.id)}.html`,
    });
  }

  return notFound(res);
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);

    if (url.pathname.startsWith("/sample-data/")) {
      const relative = decodeURIComponent(url.pathname.replace(/^\/sample-data\/?/, ""));
      return serveFile(res, path.join(config.sampleDir, relative), config.sampleDir);
    }

    const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const filePath = path.join(config.publicDir, relative);
    return serveFile(res, filePath, config.publicDir);
  } catch (error) {
    return sendJson(res, 500, {
      error: error.message,
    });
  }
}

const server = http.createServer(handleRequest);

server.listen(config.port, () => {
  console.log(`AI API Validation Tool MVP running at http://localhost:${config.port}`);
});

