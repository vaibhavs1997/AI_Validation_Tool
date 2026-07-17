const state = {
  view: "workspace",
  ticket: null,
  contract: null,
  scenarios: [],
  unusedEndpoints: [],
  run: null,
  reportUrl: "",
  history: {
    runs: [],
    tickets: [],
    totals: { runs: 0, tickets: 0, summary: {} },
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read file."));
    reader.readAsText(file);
  });
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 4200);
}

function compactText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanAcceptanceItem(item) {
  if (!item) return "";
  let s = String(item || "");
  s = s.replace(/^(?:\s*AC(?:'s)?s?|\s*ACs|\s*Acceptance Criteria)\s*[:\-\.\s]*/i, "");
  s = s.replace(/^[-*\s\d\.)]+/, "");
  return s.trim();
}

function extractAcceptanceCriteria(text) {
  const normalized = compactText(text);
  const lines = normalized.split("\n");
  const headerIndex = lines.findIndex((line) =>
    /^(acceptance criteria|acceptance conditions|ac)\b/i.test(line.replace(/[:#-]/g, "").trim())
  );

  if (headerIndex >= 0) {
    const criteria = [];
    for (let i = headerIndex + 1; i < lines.length; i += 1) {
      let line = lines[i].trim();
      if (!line) {
        if (criteria.length) break;
        continue;
      }
      if (/^[A-Z][A-Za-z ]{2,}:$/.test(line) && criteria.length) break;
      line = line.replace(/^[-*0-9.)\s]+/, "").trim();
      if (/[,;]\s*/.test(line) && !/\bhttps?:\/\//i.test(line)) {
        const parts = line.split(/[,;]\s*/).map((p) => p.trim()).filter(Boolean);
        for (const p of parts) criteria.push(cleanAcceptanceItem(p));
      } else {
        criteria.push(cleanAcceptanceItem(line));
      }
    }
    return criteria.filter(Boolean);
  }

  // fallback: inline AC lists like "ACs: 1.foo, 2.bar"
  const inlineMatch = normalized.match(/\b(?:acceptance criteria|ac|acs)\b\s*[:\-]\s*(.+)$/i);
  if (inlineMatch && inlineMatch[1]) {
    return inlineMatch[1]
      .split(/\s*(?:\d+\.|\d+\)|,|;|\n)\s*/)
      .map((s) => cleanAcceptanceItem(s))
      .filter(Boolean);
  }

  return lines
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
    .map((line) => cleanAcceptanceItem(line))
    .filter(Boolean);
}

function normalizeUploadedTicket(value) {
  if (!value || typeof value !== "object") return value;
  if (value.fields) {
    const fields = value.fields || {};
    const description =
      typeof fields.description === "string"
        ? fields.description
        : value.description || "";
    return {
      key: value.key || $("#jiraKey").value.trim() || "MANUAL-TICKET",
      summary: fields.summary || value.summary || "Manual ticket",
      issueType: fields.issuetype?.name || value.issueType || "Story",
      status: fields.status?.name || value.status || "Manual",
      priority: fields.priority?.name || value.priority || "",
      labels: fields.labels || value.labels || [],
      description,
      acceptanceCriteria: value.acceptanceCriteria || extractAcceptanceCriteria(description),
      comments: value.comments || [],
      fetchedAt: new Date().toISOString(),
    };
  }
  return value;
}

function ticketFromPlainText(raw) {
  const description = compactText(raw);
  const firstLine = description.split("\n").find(Boolean) || "Manual API validation request";
  const keyFromText = description.match(/\b[A-Z][A-Z0-9]+-\d+\b/)?.[0];
  const key = $("#jiraKey").value.trim() || keyFromText || `MANUAL-${Date.now()}`;

  return {
    key,
    summary: firstLine.replace(/^summary[:\s-]*/i, "").slice(0, 140),
    issueType: "Manual",
    status: "Draft",
    priority: "",
    labels: ["manual-input"],
    description,
    acceptanceCriteria: extractAcceptanceCriteria(description),
    comments: [],
    fetchedAt: new Date().toISOString(),
    source: "plain_text",
  };
}

function parseTicketInput(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("Ticket description is empty.");

  try {
    const parsed = JSON.parse(text);
    return normalizeUploadedTicket(parsed);
  } catch {
    return ticketFromPlainText(text);
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(value) {
  return String(value || "needs_review")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function setActiveView(view, options = {}) {
  const allowedViews = new Set(["workspace", "history", "results"]);
  const nextView = allowedViews.has(view) ? view : "workspace";
  state.view = nextView;

  $$("[data-view-section]").forEach((section) => {
    section.classList.toggle("view-hidden", section.dataset.viewSection !== nextView);
  });

  $$("[data-view-trigger]").forEach((trigger) => {
    trigger.classList.toggle("active", trigger.dataset.viewTrigger === nextView);
  });

  if (!options.skipHash) {
    const hash = nextView === "workspace" ? "#workspace" : `#${nextView}`;
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
  }
}

function initialViewFromHash() {
  const hash = window.location.hash.replace("#", "");
  return ["workspace", "history", "results"].includes(hash) ? hash : "workspace";
}

function dominantStatus(summary = {}) {
  if ((summary.failed || 0) > 0) return "failed";
  if ((summary.blocked || 0) > 0) return "blocked";
  if ((summary.needs_review || 0) > 0) return "needs_review";
  if ((summary.dry_run || 0) > 0 && (summary.dry_run || 0) >= (summary.total || 0)) return "dry_run";
  if ((summary.passed || 0) > 0) return "passed";
  return "needs_review";
}

function renderAppMetrics() {
  const totals = state.history.totals || { runs: 0, tickets: 0, summary: {} };
  const summary = totals.summary || {};
  const selectedCount = $$(".scenario-check:checked").length;

  $("#appMetrics").innerHTML = [
    ["Ticket", state.ticket?.key || "Not loaded", state.ticket?.summary || "Ready for input"],
    ["Scenarios", state.scenarios.length, `${selectedCount || 0} selected`],
    ["Stored Runs", totals.runs || 0, `${totals.tickets || 0} ticket(s)`],
    ["Passed", summary.passed || 0, `${summary.failed || 0} failed`],
    ["Dry Runs", summary.dry_run || 0, `${summary.blocked || 0} blocked`],
  ]
    .map(
      ([label, value, helper]) => `
      <div class="metric-tile">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(helper)}</small>
      </div>
    `
    )
    .join("");
}

async function loadConfigStatus() {
  const data = await api("/api/config/status");
  $("#serverState").textContent = "Online";
  $("#configStatus").textContent = [
    data.jiraConfigured ? "Jira connected" : "Jira not configured",
    data.aiConfigured ? `AI ready: ${data.aiModel}` : "AI optional",
    `Port ${data.port}`,
  ].join(" | ");
}

async function loadSampleTicket(options = {}) {
  const ticket = await fetch("/sample-data/jira-ticket.json").then((res) => res.json());
  state.ticket = ticket;
  $("#jiraKey").value = ticket.key || "";
  $("#ticketJson").value = pretty(ticket);
  renderAppMetrics();
  if (!options.silent) toast("Sample ticket loaded.");
}

async function fetchJiraTicket() {
  const issueKey = $("#jiraKey").value.trim();
  if (!issueKey) return toast("Enter a Jira ticket key.");

  const data = await api("/api/jira/ticket", {
    method: "POST",
    body: JSON.stringify({ issueKey }),
  });
  state.ticket = data.ticket;
  $("#ticketJson").value = pretty(data.ticket);
  renderAppMetrics();
  toast(`Fetched ${data.ticket.key}.`);
}

function getTicketFromText() {
  const raw = $("#ticketJson").value.trim();
  const ticket = parseTicketInput(raw);
  state.ticket = ticket;
  renderAppMetrics();
  return ticket;
}

async function loadSampleContract(options = {}) {
  const contract = await fetch("/sample-data/openapi-refund.json").then((res) => res.json());
  $("#contractJson").value = pretty(contract);
  await parseContract({ silent: true });
  if (!options.silent) toast("Sample OpenAPI contract loaded.");
}

async function parseContract(options = {}) {
  const raw = $("#contractJson").value.trim();
  if (!raw) return toast("Paste or upload an OpenAPI/Postman file first.");

  let payload;
  try {
    payload = { contract: JSON.parse(raw), name: "ui-contract" };
  } catch (err) {
    // send raw string to server; server will attempt to parse
    payload = { contract: raw, name: "ui-contract" };
  }

  const data = await api("/api/contracts/parse", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  state.contract = data.contract;
  if (!options.silent) toast(`Parsed ${data.contract.endpoints.length} endpoint(s).`);
}

async function handleTicketFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await readFileText(file);
  $("#ticketJson").value = text;
  const ticket = parseTicketInput(text);
  state.ticket = ticket;
  $("#jiraKey").value = ticket.key || $("#jiraKey").value;
  renderTicketSummary();
  renderAppMetrics();
  toast(`Loaded ${file.name}.`);
}

async function handleContractFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await readFileText(file);
  $("#contractJson").value = text;
  await parseContract({ silent: true });
  toast(`Loaded ${file.name}.`);
}

function renderContractSummary() {
  const contract = state.contract;
  if (!contract) {
    $("#contractSummary").innerHTML = "";
    return;
  }

  const authEndpoint = detectAuthEndpoint(contract);
  $("#baseUrl").value = $("#baseUrl").value || contract.baseUrl || "";
  $("#contractSummary").innerHTML = `
    <span class="pill violet">${escapeHtml(contract.type)}</span>
    <span>${escapeHtml(contract.title)}</span>
    <span class="pill">${contract.endpoints.length} endpoints</span>
    ${authEndpoint ? `<span class="pill green">Auth endpoint detected</span>` : ""}
  `;
  if ($("#authType").value === "autoBearer") fillDetectedTokenEndpoint({ onlyEmpty: true });
}

async function generateScenarios() {
  // Use the currently loaded ticket (from Jira fetch, sample load, or manual input)
  let ticket = state.ticket;
  
  // If no ticket is loaded but there's text in the textarea, parse it
  if (!ticket) {
    const raw = $("#ticketJson").value.trim();
    if (raw) {
      ticket = parseTicketInput(raw);
      state.ticket = ticket;
      renderTicketSummary();
    }
  }
  
  // If still no ticket content, fall back to textarea content
  if (!ticket || !ticket.summary) {
    toast("Load a Jira ticket, sample ticket, or paste ticket details first.");
    return;
  }
  
  if (!state.contract) await parseContract({ silent: true });

  const data = await api("/api/scenarios/generate", {
    method: "POST",
    body: JSON.stringify({
      ticket,
      contract: state.contract,
      useAi: $("#useAi").checked,
    }),
  });

  state.scenarios = data.scenarios || [];
  state.unusedEndpoints = data.unusedEndpoints || [];
  renderWarnings(data.warnings || []);
  renderScenarios();
  renderAppMetrics();
  toast(`Generated ${state.scenarios.length} scenario(s) using ${data.mode}.`);
}

function renderWarnings(warnings) {
  $("#warnings").innerHTML = warnings
    .map((warning) => `<div class="warning">${escapeHtml(warning)}</div>`)
    .join("");
}

function endpointLabel(scenario) {
  return `${scenario.method || ""} ${scenario.path || ""}`.trim();
}

function renderEndpointSummary() {
  const used = new Map();
  const unlinked = [];
  for (const s of state.scenarios) {
    if (s.unlinked || !s.endpointId) {
      unlinked.push(s);
      continue;
    }
    const key = `${s.method} ${s.path}`;
    used.set(key, (used.get(key) || 0) + 1);
  }

  if (!used.size && !unlinked.length && !state.unusedEndpoints.length) {
    $("#endpointSummary").innerHTML = "";
    return;
  }

  const parts = [];
  if (used.size) {
    const entries = Array.from(used.entries()).sort((a, b) => b[1] - a[1]).map(([ep, count]) => `${escapeHtml(ep)}: ${count} TC(s)`).join(" · ");
    parts.push(`<span class="pill green">Linked endpoints (${used.size})</span> ${entries}`);
  }
  if (unlinked.length) {
    parts.push(`<span class="pill">Unlinked TCs: ${unlinked.length}</span>`);
  }
  if (state.unusedEndpoints && state.unusedEndpoints.length) {
    const entries = state.unusedEndpoints.map((ep) => `${escapeHtml(ep.method)} ${escapeHtml(ep.path)}`).join(" · ");
    parts.push(`<span class="pill red">Unused endpoints (${state.unusedEndpoints.length})</span> ${entries}`);
  }

  $("#endpointSummary").innerHTML = `<div class="endpoint-summary">${parts.join(" | ")}</div>`;
}

function renderScenarios() {
  const rows = $("#scenarioRows");
  if (!state.scenarios.length) {
    rows.innerHTML = '<tr><td colspan="6" class="empty">No scenarios generated yet.</td></tr>';
    $("#endpointSummary").innerHTML = "";
    return;
  }

  rows.innerHTML = state.scenarios
    .map(
      (scenario) => `
      <tr>
        <td><input class="scenario-check" type="checkbox" data-id="${escapeHtml(scenario.id)}" checked></td>
        <td>
          <strong>${escapeHtml(scenario.title)}</strong>
          <div class="muted">${escapeHtml(scenario.id)}${scenario.unlinked ? " · unlinked" : ""}</div>
        </td>
        <td><span class="pill">${escapeHtml(scenario.type || "scenario")}</span></td>
        <td>${escapeHtml(endpointLabel(scenario))}${scenario.unlinked ? ' <span class="muted">(no endpoint)</span>' : ''}</td>
        <td>${escapeHtml(scenario.expectedStatus || "")}</td>
        <td>${escapeHtml(scenario.sourceAc || "")}</td>
      </tr>
    `
    )
    .join("");

  $$(".scenario-check").forEach((input) => input.addEventListener("change", renderAppMetrics));

  // Enable/disable the select/deselect controls depending on whether scenarios exist
  updateScenarioControls();
  renderEndpointSummary();
}

function updateScenarioControls() {
  const has = Array.isArray(state.scenarios) && state.scenarios.length > 0;
  const selectBtn = $("#selectAllScenariosBtn");
  const deselectBtn = $("#deselectAllScenariosBtn");
  const downloadBtn = $("#downloadScenariosBtn");
  const exportPostmanBtn = $("#exportPostmanBtn");
  if (selectBtn) selectBtn.disabled = !has;
  if (deselectBtn) deselectBtn.disabled = !has;
  if (downloadBtn) downloadBtn.disabled = !has;
  if (exportPostmanBtn) exportPostmanBtn.disabled = !has;
}

function csvCell(value) {
  const str = String(value ?? "");
  return str.includes(",") || str.includes('"') || str.includes("\n")
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function csvLine(...cells) {
  return cells.map(csvCell).join(",");
}

function downloadScenarios() {
  const scenarios = state.scenarios;
  if (!scenarios.length) return toast("No scenarios to download.");

  const ticket = state.ticket;
  const contract = state.contract;

  // --- Section 1: Metadata ---
  const parts = [];
  parts.push("=== TEST PLAN SUMMARY ===");
  parts.push(csvLine("Generated At", new Date().toISOString()));
  parts.push(csvLine("Ticket Key", ticket?.key || "N/A"));
  parts.push(csvLine("Ticket Summary", ticket?.summary || "N/A"));
  parts.push(csvLine("Total Test Cases", scenarios.length));
  const posCount = scenarios.filter((s) => s.type === "positive").length;
  const negCount = scenarios.filter((s) => s.type === "negative").length;
  const authCount = scenarios.filter((s) => s.type === "auth").length;
  const edgeCount = scenarios.filter((s) => /edge/i.test(s.sourceAc || "") || s.title.toLowerCase().includes("edge")).length;
  parts.push(csvLine("Positive", posCount, "Negative", negCount, "Auth", authCount, "Edge", edgeCount));
  const linkedCount = scenarios.filter((s) => s.endpointId && !s.unlinked).length;
  const unlinkedCount = scenarios.filter((s) => s.unlinked || !s.endpointId).length;
  parts.push(csvLine("Linked to Endpoint", linkedCount, "Unlinked", unlinkedCount));
  parts.push("");

  // --- Section 2: Endpoint Coverage ---
  parts.push("=== ENDPOINT COVERAGE ===");
  parts.push(csvLine("Endpoint", "Method", "Path", "TC Count", "Status"));
  const usedMap = new Map();
  for (const s of scenarios) {
    if (s.endpointId && !s.unlinked) {
      const key = `${s.method} ${s.path}`;
      usedMap.set(key, (usedMap.get(key) || 0) + 1);
    }
  }
  if (contract?.endpoints) {
    for (const ep of contract.endpoints) {
      const key = `${ep.method} ${ep.path}`;
      const count = usedMap.get(key) || 0;
      const status = count > 0 ? "COVERED" : "NOT COVERED";
      parts.push(csvLine(ep.operationId || key, ep.method, ep.path, count, status));
    }
  } else {
    for (const [key, count] of usedMap) {
      const [method, ...pathParts] = key.split(" ");
      const path = pathParts.join(" ");
      parts.push(csvLine(key, method, path, count, "COVERED"));
    }
  }
  // Also show unlinked
  if (unlinkedCount > 0) {
    parts.push(csvLine("(no endpoint)", "", "", unlinkedCount, "UNLINKED"));
  }
  parts.push("");

  // --- Section 3: Full Test Case Details ---
  parts.push("=== ALL TEST CASES (Full Details) ===");
  parts.push(csvLine(
    "TC ID", "Title", "Type", "Endpoint", "Method", "Path",
    "Expected Status", "Field(s)", "Mutation(s)", "Test Value(s)",
    "Risk", "Source AC", "Linked", "Match Score", "Match Reasons"
  ));
  for (const s of scenarios) {
    const method = s.method || "";
    const path = s.path || "";
    parts.push(csvLine(
      s.id,
      s.title,
      s.type,
      endpointLabel(s),
      method,
      path,
      s.expectedStatus || "",
      (s.mutations || []).map((m) => m.field).join("; "),
      (s.mutations || []).map((m) => m.operation).join("; "),
      (s.mutations || []).map((m) => m.value !== undefined ? JSON.stringify(m.value) : "").join("; "),
      s.risk || "",
      s.sourceAc || "",
      s.endpointId && !s.unlinked ? "Yes" : "No",
      s.matchScore !== undefined ? String(s.matchScore) : "",
      (s.matchReasons || []).join("; ")
    ));
  }
  parts.push("");

  const csv = parts.join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scenarios-${(ticket?.key || "manual").toLowerCase()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`Downloaded ${scenarios.length} scenarios as CSV (${parts.length} lines).`);
}

function setScenarioSelection(checked) {
  $$(".scenario-check").forEach((input) => {
    input.checked = checked;
  });
  renderAppMetrics();
  updateScenarioControls();
}

function selectedScenarios() {
  const selected = new Set($$(".scenario-check:checked").map((input) => input.dataset.id));
  return state.scenarios.filter((scenario) => selected.has(String(scenario.id)));
}

function detectAuthEndpoint(contract = state.contract) {
  const endpoints = contract?.endpoints || [];
  return (
    endpoints.find((endpoint) =>
      /post/i.test(endpoint.method) &&
      /(token|login|auth|oauth|session|signin|sign-in)/i.test(
        [endpoint.path, endpoint.summary, endpoint.operationId, endpoint.description].join(" ")
      )
    ) ||
    endpoints.find((endpoint) =>
      /(token|login|auth|oauth|session|signin|sign-in)/i.test(
        [endpoint.path, endpoint.summary, endpoint.operationId, endpoint.description].join(" ")
      )
    )
  );
}

function sampleValueFromSchema(schema, fieldName = "value") {
  if (!schema || typeof schema !== "object") return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === "object" || schema.properties) {
    return Object.fromEntries(
      Object.entries(schema.properties || {}).map(([key, value]) => [key, sampleValueFromSchema(value, key)])
    );
  }
  if (type === "array") return [sampleValueFromSchema(schema.items || {}, fieldName)];
  if (type === "integer" || type === "number") return /ttl|expiry|expires/i.test(fieldName) ? 3600 : 1;
  if (type === "boolean") return true;
  if (/email|user/i.test(fieldName)) return "qa.user@example.com";
  if (/password|secret/i.test(fieldName)) return "password";
  if (/client.*id/i.test(fieldName)) return "client-id";
  if (/client.*secret/i.test(fieldName)) return "client-secret";
  return `sample-${fieldName}`;
}

function fillDetectedTokenEndpoint(options = {}) {
  const endpoint = detectAuthEndpoint();
  if (!endpoint) {
    toast("No likely auth/token endpoint was detected in the uploaded contract.");
    return;
  }

  const onlyEmpty = Boolean(options.onlyEmpty);
  const tokenUrl = $("#tokenUrl");
  const tokenMethod = $("#tokenMethod");
  const tokenBody = $("#tokenBody");
  const tokenHeaders = $("#tokenHeaders");
  const tokenPath = $("#tokenPath");

  if (tokenUrl && (!onlyEmpty || !tokenUrl.value)) tokenUrl.value = endpoint.path || "";
  if (tokenMethod && (!onlyEmpty || !tokenMethod.value)) tokenMethod.value = endpoint.method || "POST";
  if (tokenBody && (!onlyEmpty || !tokenBody.value)) {
    tokenBody.value = pretty(sampleValueFromSchema(endpoint.requestSchema, "tokenRequest") || {});
  }
  if (tokenHeaders && (!onlyEmpty || !tokenHeaders.value)) tokenHeaders.value = "{}";
  if (tokenPath && (!onlyEmpty || !tokenPath.value)) tokenPath.value = "access_token";
}

function renderAuthFields() {
  const type = $("#authType").value;
  const target = $("#authFields");
  if (type === "bearer") {
    target.innerHTML = '<label>Token<input id="authToken" type="password" autocomplete="off"></label>';
  } else if (type === "autoBearer") {
target.innerHTML = `
      <div class="button-row auth-detect-row">
        <button id="detectAuthEndpointBtn" type="button" class="action-btn">Use detected token endpoint</button>
      </div>
      <label>Token URL<input id="tokenUrl" type="text" placeholder="/auth/token or https://auth.company.com/token"></label>
      <label>Method
        <select id="tokenMethod">
          <option value="POST">POST</option>
          <option value="GET">GET</option>
        </select>
      </label>
      <label>Headers JSON<textarea id="tokenHeaders" class="mini-code" spellcheck="false">{}</textarea></label>
      <label>Body JSON<textarea id="tokenBody" class="mini-code" spellcheck="false">{}</textarea></label>
      <label>Token JSON path<input id="tokenPath" type="text" value="access_token" placeholder="access_token"></label>
    `;
    $("#detectAuthEndpointBtn").addEventListener("click", () => fillDetectedTokenEndpoint());
    fillDetectedTokenEndpoint({ onlyEmpty: true });
  } else if (type === "basic") {
    target.innerHTML = `
      <label>Username<input id="authUsername" type="text" autocomplete="off"></label>
      <label>Password<input id="authPassword" type="password" autocomplete="off"></label>
    `;
  } else if (type === "custom") {
    target.innerHTML = `
      <label>Header name<input id="authHeaderName" type="text" placeholder="X-API-Key"></label>
      <label>Header value<input id="authHeaderValue" type="password" autocomplete="off"></label>
    `;
  } else {
    target.innerHTML = "";
  }
}

function environmentPayload() {
  const authType = $("#authType").value;
  const auth = { type: authType };
  if (authType === "bearer") auth.token = $("#authToken")?.value || "";
  if (authType === "autoBearer") {
    auth.tokenUrl = $("#tokenUrl")?.value.trim() || "";
    auth.tokenMethod = $("#tokenMethod")?.value || "POST";
    auth.tokenHeaders = $("#tokenHeaders")?.value.trim() || "{}";
    auth.tokenBody = $("#tokenBody")?.value.trim() || "{}";
    auth.tokenPath = $("#tokenPath")?.value.trim() || "access_token";
  }
  if (authType === "basic") {
    auth.username = $("#authUsername")?.value || "";
    auth.password = $("#authPassword")?.value || "";
  }
  if (authType === "custom") {
    auth.headerName = $("#authHeaderName")?.value || "";
    auth.headerValue = $("#authHeaderValue")?.value || "";
  }

  return {
    name: $("#envName").value.trim() || "local",
    baseUrl: $("#baseUrl").value.trim(),
    dryRun: $("#dryRun").checked,
    auth,
  };
}

async function executeSelected() {
  const scenarios = selectedScenarios();
  if (!scenarios.length) return toast("Select at least one scenario.");
  if (!state.contract) return toast("Parse an API contract first.");

  const data = await api("/api/runs/execute", {
    method: "POST",
    body: JSON.stringify({
      ticket: state.ticket,
      contract: state.contract,
      scenarios,
      environment: environmentPayload(),
    }),
  });

  state.run = data.run;
  state.reportUrl = data.reportUrl;
  renderRun();
  await loadRunHistory({ silent: true });
  setActiveView("results");
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
  toast(`Run stored: ${data.run.id}`);
}

function renderRun() {
  const run = state.run;
  if (!run) return;
  const summary = run.summary || {};
  const stats = [
    ["Total", summary.total || 0],
    ["Passed", summary.passed || 0],
    ["Failed", summary.failed || 0],
    ["Blocked", summary.blocked || 0],
    ["Review", summary.needs_review || 0],
    ["Dry Run", summary.dry_run || 0],
  ];
  if (run.authStatus) stats.push(["Auth", statusLabel(run.authStatus.status)]);
  
  // Calculate average response time
  const responseTimes = (run.results || []).map(r => r.validation?.responseTimeMs).filter(Boolean);
  const avgTime = responseTimes.length ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;
  if (avgTime > 0) stats.push(["Avg Time", `${avgTime}ms`]);

  $("#runSummary").innerHTML = stats
    .map(([label, value]) => `<span class="stat-pill">${label} <strong>${value}</strong></span>`)
    .join("");

  $("#reportLinks").innerHTML = `
    <a class="link-button" href="/api/runs/${encodeURIComponent(run.id)}" target="_blank" rel="noreferrer">JSON</a>
    <a class="link-button" href="${state.reportUrl || `/api/reports/${encodeURIComponent(run.id)}.html`}" target="_blank" rel="noreferrer">HTML report</a>
  `;

  $("#resultRows").innerHTML = (run.results || [])
    .map(
      (result) => `
      <tr>
        <td>
          <strong>${escapeHtml(result.title)}</strong>
          <div class="muted">${escapeHtml(result.scenarioId)}</div>
        </td>
        <td><span class="status ${escapeHtml(result.status)}">${escapeHtml(statusLabel(result.status))}</span></td>
        <td>${escapeHtml(result.response?.status ?? result.error ?? result.status)}${result.validation?.responseTimeMs ? `<div class="muted">${result.validation.responseTimeMs}ms</div>` : ""}</td>
        <td>
          <details>
            <summary>Evidence</summary>
            <pre>${escapeHtml(pretty({ request: result.request, response: result.response, validation: result.validation, error: result.error }))}</pre>
          </details>
        </td>
      </tr>
    `
    )
    .join("");
}

async function loadRunHistory(options = {}) {
  const data = await api("/api/runs");
  state.history = data;
  renderHistory();
  renderAppMetrics();
  if (!options.silent) toast("Run history refreshed.");
}

function runMatchesFilters(run) {
  const query = $("#historySearch").value.trim().toLowerCase();
  const status = $("#historyStatus").value;
  const statusValue = dominantStatus(run.summary);
  const haystack = [
    run.id,
    run.ticketKey,
    run.ticketSummary,
    run.environment,
    run.contractTitle,
    run.baseUrl,
  ]
    .join(" ")
    .toLowerCase();

  return (!query || haystack.includes(query)) && (status === "all" || status === statusValue);
}

function renderHistory() {
  const allRuns = state.history.runs || [];
  const filteredRuns = allRuns.filter(runMatchesFilters);
  renderTicketGroups(filteredRuns);
  renderHistoryRows(filteredRuns);
}

function aggregateRuns(runs) {
  const groups = new Map();
  for (const run of runs) {
    if (!groups.has(run.ticketKey)) {
      groups.set(run.ticketKey, {
        ticketKey: run.ticketKey,
        ticketSummary: run.ticketSummary,
        runCount: 0,
        latestRunAt: run.createdAt,
        latestRunId: run.id,
        summary: { total: 0, passed: 0, failed: 0, blocked: 0, needs_review: 0, dry_run: 0 },
      });
    }

    const group = groups.get(run.ticketKey);
    group.runCount += 1;
    if (run.createdAt > group.latestRunAt) {
      group.latestRunAt = run.createdAt;
      group.latestRunId = run.id;
      group.ticketSummary = run.ticketSummary;
    }
    for (const key of Object.keys(group.summary)) {
      group.summary[key] += run.summary?.[key] || 0;
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.latestRunAt.localeCompare(a.latestRunAt));
}

function renderTicketGroups(runs) {
  const groups = aggregateRuns(runs).slice(0, 4);
  const target = $("#ticketGroups");
  if (!groups.length) {
    target.innerHTML = '<div class="empty">No matching ticket history.</div>';
    return;
  }

  target.innerHTML = groups
    .map(
      (group) => `
      <div class="ticket-row">
        <div>
          <strong>${escapeHtml(group.ticketKey)}</strong>
          <small>${escapeHtml(group.runCount)} run(s) | Latest ${escapeHtml(formatDate(group.latestRunAt))}</small>
        </div>
        <div>
          <div>${escapeHtml(group.ticketSummary || "Manual run")}</div>
          <div class="status-stack">
            <span class="pill green">Passed ${group.summary.passed || 0}</span>
            <span class="pill">Total ${group.summary.total || 0}</span>
            <span class="pill">Failed ${group.summary.failed || 0}</span>
          </div>
        </div>
<button type="button" data-load-run="${escapeHtml(group.latestRunId)}" class="load-btn">Latest</button>
      </div>
    `
    )
    .join("");
}

function renderHistoryRows(runs) {
  const rows = $("#historyRows");
  if (!runs.length) {
    rows.innerHTML = '<tr><td colspan="6" class="empty">No matching run history.</td></tr>';
    return;
  }

  rows.innerHTML = runs
    .map((run) => {
      const status = dominantStatus(run.summary);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(run.ticketKey)}</strong>
            <div class="muted">${escapeHtml(run.ticketSummary || "Manual run")}</div>
          </td>
          <td>
            <strong>${escapeHtml(run.id)}</strong>
            <div class="muted">${escapeHtml(run.contractTitle)}</div>
          </td>
          <td>
            <span class="status ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
            <div class="muted">${escapeHtml(run.summary.total)} total, ${escapeHtml(run.summary.passed)} passed, ${escapeHtml(run.summary.failed)} failed</div>
          </td>
          <td>
            ${escapeHtml(run.environment)}
            <div class="muted">${run.dryRun ? "Dry run" : escapeHtml(run.baseUrl || "No base URL")}</div>
          </td>
          <td>${escapeHtml(formatDate(run.createdAt))}</td>
          <td>
<div class="button-row">
              <button type="button" data-load-run="${escapeHtml(run.id)}" class="load-btn">Load</button>
              <a class="link-button" href="${escapeHtml(run.reportUrl)}" target="_blank" rel="noreferrer">Report</a>
              <button type="button" data-delete-run="${escapeHtml(run.id)}" class="delete-btn">Delete</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadRun(runId) {
  const run = await api(`/api/runs/${encodeURIComponent(runId)}`);
  state.run = run;
  state.reportUrl = `/api/reports/${encodeURIComponent(run.id)}.html`;
  renderRun();
  setActiveView("results");
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
  toast(`Loaded run ${run.id}.`);
}

async function deleteRun(runId) {
  if (!confirm(`Are you sure you want to delete run ${runId}?`)) {
    return;
  }

  await api(`/api/runs/${encodeURIComponent(runId)}`, {
    method: "DELETE",
  });

  toast(`Run ${runId} deleted successfully.`);
  await loadRunHistory({ silent: true });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const nextTheme = currentTheme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem("theme", nextTheme);
  $("#themeToggle").textContent = nextTheme === "dark" ? "☀️" : "🌙";
}

function initTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  $("#themeToggle").textContent = currentTheme === "dark" ? "☀️" : "🌙";
}

function bindEvents() {
  $$("[data-view-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveView(trigger.dataset.viewTrigger);
      if (trigger.dataset.viewTrigger === "history") {
        loadRunHistory({ silent: true }).catch((error) => toast(error.message));
      }
    });
  });
  $("#loadSampleTicketBtn").addEventListener("click", () => loadSampleTicket().catch((error) => toast(error.message)));
  $("#fetchJiraBtn").addEventListener("click", () => fetchJiraTicket().catch((error) => toast(error.message)));
  $("#ticketFile").addEventListener("change", (event) => handleTicketFileUpload(event).catch((error) => toast(error.message)));
  $("#loadSampleContractBtn").addEventListener("click", () => loadSampleContract().catch((error) => toast(error.message)));
  $("#parseContractBtn").addEventListener("click", () => parseContract().catch((error) => toast(error.message)));
  $("#contractFile").addEventListener("change", (event) => handleContractFileUpload(event).catch((error) => toast(error.message)));
  $("#generateBtn").addEventListener("click", () => generateScenarios().catch((error) => toast(error.message)));
  $("#selectAllScenariosBtn").addEventListener("click", () => setScenarioSelection(true));
  $("#deselectAllScenariosBtn").addEventListener("click", () => setScenarioSelection(false));
  $("#downloadScenariosBtn").addEventListener("click", () => downloadScenarios());
  $("#exportPostmanBtn").addEventListener("click", () => generatePostmanCollection());
  $("#executeBtn").addEventListener("click", () => executeSelected().catch((error) => toast(error.message)));
  $("#refreshHistoryBtn").addEventListener("click", () => loadRunHistory().catch((error) => toast(error.message)));
  $("#authType").addEventListener("change", renderAuthFields);
  $("#historySearch").addEventListener("input", renderHistory);
  $("#historyStatus").addEventListener("change", renderHistory);
  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#history").addEventListener("click", (event) => {
    const loadButton = event.target.closest("[data-load-run]");
    if (loadButton) {
      loadRun(loadButton.dataset.loadRun).catch((error) => toast(error.message));
      return;
    }
    const deleteButton = event.target.closest("[data-delete-run]");
    if (deleteButton) {
      deleteRun(deleteButton.dataset.deleteRun).catch((error) => toast(error.message));
    }
  });
}

function generatePostmanCollection() {
  const scenarios = state.scenarios;
  if (!scenarios.length) return toast("No scenarios to export.");

  const ticket = state.ticket;
  const contract = state.contract;

  const collection = {
    info: {
      name: `${ticket?.key || "manual"} - API Tests`,
      version: "1.0.0",
      description: ticket?.summary || "Generated from AI API Validation Tool",
    },
    item: scenarios
      .filter((s) => s.endpointId && s.method && s.path)
      .map((s) => ({
        name: s.title.slice(0, 80),
        request: {
          method: s.method,
          header: [
            { key: "Content-Type", value: "application/json", type: "text" },
          ],
          url: {
            raw: s.path,
            host: "",
            path: s.path.split("/").filter(Boolean),
          },
          body: {
            mode: "raw",
            raw: JSON.stringify(s.basePayload || {}, null, 2),
          },
        },
        response: [],
      })),
  };

  if (contract?.baseUrl) {
    collection.info.schema = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
    collection.item.forEach((item) => {
      item.request.url.raw = `${contract.baseUrl}${item.request.url.raw}`;
    });
  }

  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `postman-${(ticket?.key || "manual").toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`Exported ${collection.item.length} requests to Postman collection.`);
}

async function boot() {
  bindEvents();
  initTheme();
  renderAuthFields();
  setActiveView(initialViewFromHash(), { skipHash: true });
  renderAppMetrics();
  await loadConfigStatus();
  await loadRunHistory({ silent: true });
  await loadSampleTicket({ silent: true });
  await loadSampleContract({ silent: true });
}

boot().catch((error) => {
  $("#serverState").textContent = "Attention";
  toast(error.message);
});
