const state = {
  view: "workspace",
  // Requirement state - the actual loaded ticket (shared)
  ticket: null,
  // UI state for Jira tab (independent from Manual)
  jira: {
    inputKey: "",
    fetched: false,
    error: false,
    loading: false,
  },
  // UI state for Manual tab (independent from Jira)
  manual: {
    entered: false,
    error: false,
    draft: "",
  },
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
  ticketVersion: 0,
  contractVersion: 0,
};

function saveState() {
  try {
    const persistedState = {
      ticket: state.ticket,
      contract: state.contract,
      scenarios: state.scenarios,
      ticketVersion: state.ticketVersion,
      contractVersion: state.contractVersion,
    };
    localStorage.setItem("workspaceState", JSON.stringify(persistedState));
  } catch (e) {}
}

function loadState() {
  try {
    const saved = localStorage.getItem("workspaceState");
    if (!saved) return false;
    const persistedState = JSON.parse(saved);
    state.ticket = persistedState.ticket || null;
    state.contract = persistedState.contract || null;
    state.scenarios = persistedState.scenarios || [];
    state.ticketVersion = persistedState.ticketVersion || 0;
    state.contractVersion = persistedState.contractVersion || 0;
    return true;
  } catch (e) {
    return false;
  }
}

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value) {
  // Creates a span, sets textContent (safe), then returns innerHTML (escaped)
  const span = document.createElement("span");
  span.textContent = value ?? "";
  return span.innerHTML;
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

function toast(message, type = "info") {
  const el = $("#toast");
  el.textContent = message;
  el.className = `toast ${type}`;
  el.hidden = false;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}

function showModal(title, message) {
  let modal = document.getElementById("errorModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "errorModal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3 class="modal-title"></h3>
          <button type="button" class="modal-close" aria-label="Close">x</button>
        </div>
        <div class="modal-body"></div>
        <div class="modal-footer">
          <button type="button" class="primary modal-ok">OK</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal || e.target.classList.contains("modal-close") || e.target.classList.contains("modal-ok")) {
        modal.classList.remove("show");
        modal.hidden = true;
      }
    });
  }
  modal.querySelector(".modal-title").textContent = title;
  modal.querySelector(".modal-body").textContent = message;
  modal.hidden = false;
  modal.classList.add("show");
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
      if (!line) { if (criteria.length) break; continue; }
      if (/^[A-Z][A-Za-z ]{2,}:$/.test(line) && criteria.length) break;
      line = line.replace(/^[-*0-9.)\s]+/, "").trim();
      if (/[,;]\s*/.test(line) && !/\bhttps?:\/\//i.test(line)) {
        line.split(/[,;]\s*/).map((p) => p.trim()).filter(Boolean).forEach((p) => criteria.push(cleanAcceptanceItem(p)));
      } else { criteria.push(cleanAcceptanceItem(line)); }
    }
    return criteria.filter(Boolean);
  }

  const inlineMatch = normalized.match(/\b(?:acceptance criteria|ac|acs)\b\s*[:\-]\s*(.+)$/i);
  if (inlineMatch && inlineMatch[1]) {
    return inlineMatch[1].split(/\s*(?:\d+\.|\d+\)|,|;|\n)\s*/).map((s) => cleanAcceptanceItem(s)).filter(Boolean);
  }

  return lines.filter((line) => /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)).map((line) => cleanAcceptanceItem(line)).filter(Boolean);
}

function normalizeUploadedTicket(value) {
  if (!value || typeof value !== "object") return value;
  if (value.fields) {
    const fields = value.fields || {};
    const description = typeof fields.description === "string" ? fields.description : value.description || "";
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
  return { key, summary: firstLine.replace(/^summary[:\s-]*/i, "").slice(0, 140), issueType: "Manual", status: "Draft", priority: "", labels: ["manual-input"], description, acceptanceCriteria: extractAcceptanceCriteria(description), comments: [], fetchedAt: new Date().toISOString(), source: "plain_text" };
}

function parseTicketInput(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("Ticket description is empty.");
  try { return normalizeUploadedTicket(JSON.parse(text)); } catch { return ticketFromPlainText(text); }
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusLabel(value) {
  return String(value || "needs_review").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function setActiveView(view, options = {}) {
  const allowedViews = new Set(["workspace", "history", "results"]);
  state.view = allowedViews.has(view) ? view : "workspace";
  $$("[data-view-section]").forEach((section) => {
    section.classList.toggle("view-hidden", section.dataset.viewSection !== state.view);
  });
  $$("[data-view-trigger]").forEach((trigger) => {
    trigger.classList.toggle("active", trigger.dataset.viewTrigger === state.view);
  });
  if (!options.skipHash) {
    const hash = state.view === "workspace" ? "#workspace" : `#${state.view}`;
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
  const appMetrics = $("#appMetrics");
  if (!appMetrics) return;
  appMetrics.innerHTML = [
    ["Ticket", state.ticket?.key || "Not loaded", state.ticket?.summary || "Ready for input"],
    ["Scenarios", state.scenarios.length, `${selectedCount || 0} selected`],
    ["Stored Runs", totals.runs || 0, `${totals.tickets || 0} ticket(s)`],
    ["Passed", summary.passed || 0, `${summary.failed || 0} failed`],
    ["Dry Runs", summary.dry_run || 0, `${summary.blocked || 0} blocked`],
  ].map(([label, value, helper]) => `
      <div class="metric-tile">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(helper)}</small>
      </div>`).join("");
}

function updateScenariosPrereqStatus() {
  const reqPrereq = $("#scPrereqReq");
  const apiPrereq = $("#scPrereqApi");
  const generateBtn = $("#generateScenariosBtn");
  const helpText = $("#generateHelpText");
  if (reqPrereq) reqPrereq.className = "prereq-item" + (state.ticket ? " loaded" : "");
  if (apiPrereq) apiPrereq.className = "prereq-item" + (state.contract ? " loaded" : "");
  const ready = state.ticket && state.contract;
  if (generateBtn) generateBtn.disabled = !ready;
  if (helpText) helpText.hidden = ready;
}

function updateScenariosSummary() {
  const totalEl = $("#scTotal");
  const selectedEl = $("#scSelected");
  if (totalEl) totalEl.textContent = state.scenarios.length;
  if (selectedEl) selectedEl.textContent = $$(".scenario-check:checked").length;
}

function setScenariosState(stateName) {
  const emptyState = $("#scenariosEmptyState");
  const loadingState = $("#scenariosLoading");
  const summaryBar = $("#scenariosSummary");
  const tableWrap = $(".table-wrap");
  if (emptyState) emptyState.hidden = stateName !== "empty";
  if (loadingState) loadingState.hidden = stateName !== "loading";
  if (summaryBar) summaryBar.hidden = stateName !== "generated";
  if (tableWrap) tableWrap.hidden = stateName !== "generated";
}

function updateStepSummaries() {
  const reqSummary = $("#reqStepSummary");
  if (reqSummary) reqSummary.textContent = state.ticket ? `${state.ticket.key} · ${state.ticket.summary || "Loaded"}` : "Not configured";
  const reqStepStatus = $("#reqStepStatus");
  if (reqStepStatus) { reqStepStatus.textContent = state.ticket ? "✓" : ""; reqStepStatus.className = "step-status" + (state.ticket ? " loaded" : ""); }

  const collectionSummary = $("#collectionStepSummary");
  if (collectionSummary) collectionSummary.textContent = state.contract ? `${state.contract.title || "API Collection"} · ${state.contract.endpoints?.length || 0} endpoints` : "Not configured";
  const collectionStepStatus = $("#collectionStepStatus");
  if (collectionStepStatus) { collectionStepStatus.textContent = state.contract ? "✓" : ""; collectionStepStatus.className = "step-status" + (state.contract ? " loaded" : ""); }

  const scenariosSummary = $("#scenariosStepSummary");
  if (scenariosSummary) scenariosSummary.textContent = state.scenarios.length ? `${state.scenarios.length} generated · ${$$(".scenario-check:checked").length} selected` : "Not generated";
  const scenariosStepStatus = $("#scenariosStepStatus");
  if (scenariosStepStatus) { scenariosStepStatus.textContent = state.scenarios.length ? "✓" : ""; scenariosStepStatus.className = "step-status" + (state.scenarios.length ? " loaded" : ""); }

  const execSummary = $("#execStepSummary");
  if (execSummary) execSummary.textContent = state.scenarios.length && state.contract && state.ticket ? `Ready · ${$$(".scenario-check:checked").length} tests selected` : "Not ready";
  const execStepStatus = $("#executionStepStatus");
  if (execStepStatus) { execStepStatus.textContent = state.scenarios.length && state.contract && state.ticket ? "✓" : ""; execStepStatus.className = "step-status" + (state.scenarios.length && state.contract && state.ticket ? " loaded" : ""); }
}

function renderCompactWorkflow() {
  const ticket = state.ticket;
  const contract = state.contract;
  const scenarios = state.scenarios || [];
  const run = state.run;
  
  // Step 1 - Requirement
  const reqStepText = ticket ? "✓ Requirement" : "1 Requirement";
  const reqStepValue = ticket ? (ticket.key || "Loaded") : "Not configured";
  const reqClass = ticket ? "completed" : "";
  
  // Step 2 - API Collection
  const apiStepText = contract ? "✓ API Collection" : "2 API Collection";
  const apiStepValue = contract ? `${contract.endpoints?.length || 0} endpoints` : "Not configured";
  const apiClass = contract ? "completed" : "";
  
  // Step 3 - Test Scenarios
  const scStepText = scenarios.length ? "✓ Test Scenarios" : "3 Test Scenarios";
  const scStepValue = scenarios.length ? `${scenarios.length} generated` : "Not generated";
  const scClass = scenarios.length ? "completed" : "";
  
  // Step 4 - Run
  const execStepText = run ? "✓ Run" : (scenarios.length && contract && ticket ? "4 Run" : "4 Run");
  const execStepValue = run ? `${(run.summary?.passed || 0)} passed` : (scenarios.length && contract && ticket ? "Ready" : "Not ready");
  const execClass = run ? "completed" : (scenarios.length && contract && ticket ? "active" : "");
  
  const compact = $("#compactWorkflow");
  if (!compact) return;
  compact.innerHTML = `
    <span class="cw-step ${reqClass}">
      <span class="cw-step-label">${escapeHtml(reqStepText)}</span>
      <span class="cw-step-value">${escapeHtml(reqStepValue)}</span>
    </span>
    <span class="cw-sep">→</span>
    <span class="cw-step ${apiClass}">
      <span class="cw-step-label">${escapeHtml(apiStepText)}</span>
      <span class="cw-step-value">${escapeHtml(apiStepValue)}</span>
    </span>
    <span class="cw-sep">→</span>
    <span class="cw-step ${scClass}">
      <span class="cw-step-label">${escapeHtml(scStepText)}</span>
      <span class="cw-step-value">${escapeHtml(scStepValue)}</span>
    </span>
    <span class="cw-sep">→</span>
    <span class="cw-step ${execClass}">
      <span class="cw-step-label">${escapeHtml(execStepText)}</span>
      <span class="cw-step-value">${escapeHtml(execStepValue)}</span>
    </span>
  `;
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
  renderTicketSummary();
  renderAppMetrics();
  renderCompactWorkflow();
  saveState();
  if (!options.silent) { toast("Sample ticket loaded."); }
}

async function fetchJiraTicket(options = {}) {
  const issueKey = $("#jiraKey").value.trim();
  if (!issueKey) return toast("Enter a Jira ticket key.");
  if (window.__fetchingJira) return;
  
  // Store previous ticket to restore on failure
  const previousTicket = state.ticket;
  window.__fetchingJira = true;

  const loadingEl = $("#reqLoading");
  const emptyHelper = $(".req-empty-state-bottom");
  const jiraError = $("#jiraError");
  
  hideInlineError();
  if (loadingEl) loadingEl.hidden = false;
  // Hide loaded sections while fetching
  const loadedSummary = $("#reqLoadedSummary");
  const metaSection = $("#reqMetaSection");
  const descSection = $("#reqDescriptionSection");
  if (loadedSummary) loadedSummary.hidden = true;
  if (metaSection) metaSection.hidden = true;
  if (descSection) descSection.hidden = true;

  try {
    const data = await api("/api/jira/ticket", { method: "POST", body: JSON.stringify({ issueKey }) });
    state.ticket = data.ticket;
    $("#ticketJson").value = pretty(data.ticket);
    state.ticketVersion++;
    renderTicketSummary();
    renderAppMetrics();
    renderCompactWorkflow();
    saveState();
    if (!options.silent) toast(`Fetched ${data.ticket.key}.`);
  } catch (error) {
    // Restore previous ticket on error
    state.ticket = previousTicket;
    // Show user-friendly error with dynamic ticket key
    const userMessage = `Unable to fetch <strong>${escapeHtml(issueKey)}</strong><br><small>The ticket does not exist or you may not have permission to access it.</small>`;
    showInlineError(userMessage);
    // Restore UI state for preserved ticket
    if (loadedSummary && previousTicket) loadedSummary.hidden = false;
    if (metaSection && previousTicket) metaSection.hidden = false;
    if (jiraError) jiraError.hidden = false;
  } finally {
    window.__fetchingJira = false;
    if (loadingEl) loadingEl.hidden = true;
  }
}

function getTicketFromText() {
  const raw = $("#ticketJson").value.trim();
  try {
    const ticket = parseTicketInput(raw);
    state.ticket = ticket;
    state.ticketVersion++;
    renderTicketSummary();
    renderAppMetrics();
    renderCompactWorkflow();
    saveState();
    hideInlineError();
    return ticket;
  } catch (error) {
    showInlineError(error.message || "Invalid ticket format.");
    throw error;
  }
}

function renderJiraTabState() {
  // Jira tab should show its own state - only show success if ticket exists via Jira
  // For now, we check if there's a jira ticket key in the input
  const hasJiraTicket = $("#jiraKey")?.value.trim();
  const ticket = state.ticket;
  
  // Jira-specific elements
  const jiraError = $("#jiraError");
  const jiraInputs = $(".source-jira");
  
  // Show Jira inputs
  if (jiraInputs) jiraInputs.hidden = false;
  
  // Hide manual error when in Jira tab
  const manualError = $("#manualError");
  if (manualError) manualError.hidden = true;
}

function renderManualTabState() {
  // Manual tab should show only its own state - hide ALL Jira-related elements
  
  // Hide Jira-specific UI elements
  const jiraError = $("#jiraError");
  const jiraInputs = $(".source-jira");
  const emptyHelper = $(".req-empty-state-bottom");
  const loadedSummary = $("#reqLoadedSummary");
  const metaSection = $("#reqMetaSection");
  const descSection = $("#reqDescriptionSection");
  
  if (jiraError) jiraError.hidden = true;
  if (jiraInputs) jiraInputs.hidden = true;
  // Jira success/meta/description should NOT appear in Manual tab - use hidden property consistently
  if (loadedSummary) loadedSummary.hidden = true;
  if (metaSection) metaSection.hidden = true;
  if (descSection) descSection.hidden = true;
  
  // Show empty helper in Manual tab only if no manual draft
  const manualDraft = $("#ticketJson")?.value.trim();
  if (emptyHelper) emptyHelper.hidden = !!manualDraft;
}

function renderTicketSummary() {
  const ticket = state.ticket;
  const activeSource = $(".source-chip.active")?.dataset?.source || "jira";
  
  // Jira-specific elements
  const emptyHelper = $(".req-empty-state-bottom");
  const loadedSummary = $("#reqLoadedSummary");
  const metaSection = $("#reqMetaSection");
  const reqSummaryKey = $("#reqSummaryKey");
  const reqSummaryText = $("#reqSummaryText");
  const reqDescriptionSection = $("#reqDescriptionSection");
  const reqDescriptionText = $("#reqDescriptionText");
  
  // Manual-specific elements
  const manualError = $("#manualError");
  
  if (activeSource === "manual") {
    // Manual tab - don't show Jira success/meta/description
    if (loadedSummary) loadedSummary.setAttribute("hidden", "");
    if (metaSection) metaSection.setAttribute("hidden", "");
    if (reqDescriptionSection) reqDescriptionSection.setAttribute("hidden", "");
    // Show empty helper if no manual draft
    const manualDraft = $("#ticketJson")?.value.trim();
    if (emptyHelper) emptyHelper.hidden = !manualDraft;
    return;
  }
  
  // Jira tab - show Jira success/meta/description if ticket exists
  if (!ticket) {
    // STATE A: NO REQUIREMENT LOADED
    // Show empty helper at bottom, hide loaded summary and meta
    if (emptyHelper) emptyHelper.hidden = false;
    if (loadedSummary) loadedSummary.setAttribute("hidden", "");
    if (metaSection) metaSection.setAttribute("hidden", "");
    if (reqDescriptionSection) reqDescriptionSection.setAttribute("hidden", "");
  } else {
    // STATE B: REQUIREMENT SUCCESSFULLY LOADED
    // Hide empty helper, show loaded summary with actual data
    if (emptyHelper) emptyHelper.hidden = true;
    if (loadedSummary) loadedSummary.removeAttribute("hidden");
    if (metaSection) metaSection.removeAttribute("hidden");
    
    // Only show ticket key if it exists
    if (reqSummaryKey) {
      reqSummaryKey.textContent = ticket.key || "";
    }
    
    // Only show ticket summary if it exists
    if (reqSummaryText) {
      reqSummaryText.textContent = ticket.summary || "";
    }
    
    // Show description if available (separate container below meta)
    if (ticket.description) {
      if (reqDescriptionSection) reqDescriptionSection.hidden = false;
      if (reqDescriptionText) reqDescriptionText.textContent = ticket.description;
    } else {
      if (reqDescriptionSection) reqDescriptionSection.setAttribute("hidden", "");
    }
  }
}

function showRequirementsSuccess() {
  const panel = $(".panel-requirements");
  if (panel) panel.classList.add("collapsed");
  updateReqStatusBadge();
}

function showRequirementsInput() {
  const panel = $(".panel-requirements");
  if (panel) panel.classList.remove("collapsed");
  $("#reqDetailsExpand").hidden = true;
}

function showInlineError(message, sourceOverride) {
  // Hide all errors first
  const jiraError = $("#jiraError");
  const manualError = $("#manualError");
  const emptyHelper = $(".req-empty-state-bottom");
  
  if (jiraError) jiraError.hidden = true;
  if (manualError) manualError.hidden = true;
  
  // Hide empty helper when showing error
  if (emptyHelper) emptyHelper.hidden = true;
  
  // If no message, don't show any error
  if (!message) return;
  
  // Show the relevant error container
  const currentSource = sourceOverride || $(".source-chip.active")?.dataset?.source || "jira";
  const errorEl = currentSource === "jira" ? jiraError : manualError;
  if (errorEl) {
    const errorTextEl = errorEl.querySelector(".error-text");
    // Check if message contains HTML tags
    if (message.includes("<") && message.includes(">")) {
      errorTextEl.innerHTML = message;
    } else {
      errorTextEl.textContent = message;
    }
    errorEl.hidden = false;
  }
}

function hideInlineError() {
  const jiraError = $("#jiraError");
  const manualError = $("#manualError");
  if (jiraError) jiraError.hidden = true;
  if (manualError) manualError.hidden = true;
}

function updateReqStatusBadge() {
  const badge = $("#reqStatusBadge");
  if (badge) { badge.textContent = state.ticket ? "Loaded" : ""; badge.className = "status-badge" + (state.ticket ? " loaded" : ""); }
}

async function loadSampleContract(options = {}) {
  const contract = await fetch("/sample-data/openapi-refund.json").then((res) => res.json());
  $("#contractJson").value = pretty(contract);
  await parseContract({ silent: true });
  if (contract.baseUrl) $("#baseUrl").value = contract.baseUrl;
  $("#dryRun").checked = false;
  saveState();
  if (!options.silent) toast("Sample OpenAPI contract loaded.");
}

async function parseContract(options = {}) {
  const raw = $("#contractJson").value.trim();
  if (!raw) return toast("Paste or upload an OpenAPI/Postman file first.");
  let payload;
  try { payload = { contract: JSON.parse(raw), name: "ui-contract" }; } catch { payload = { contract: raw, name: "ui-contract" }; }

  const data = await api("/api/contracts/parse", { method: "POST", body: JSON.stringify(payload) });
  state.contract = data.contract;
  state.contractVersion++;
  renderContractSummary();
  renderAppMetrics();
  renderCompactWorkflow();
  saveState();
  toast(`Parsed ${data.contract.endpoints.length} endpoint(s).`);
}

function showContractParsedSummary() {
  const panel = $(".panel-collection");
  if (panel) panel.classList.add("collapsed");
}

function updateCollectionStatusBadge() {
  const badge = $("#collectionStatusBadge");
  if (badge) { badge.textContent = state.contract ? "Loaded" : ""; badge.className = "status-badge" + (state.contract ? " loaded" : ""); }
}

async function handleTicketFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await readFileText(file);
    $("#ticketJson").value = text;
    const ticket = parseTicketInput(text);
    state.ticket = ticket;
    state.ticketVersion++;
    $("#jiraKey").value = ticket.key || $("#jiraKey").value;
    renderTicketSummary();
    renderAppMetrics();
    renderCompactWorkflow();
    saveState();
    hideInlineError();
    toast(`Loaded ${file.name}.`);
  } catch (error) {
    showInlineError(error.message || "Failed to parse file.");
  }
}

async function handleContractFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await readFileText(file);
    $("#contractJson").value = text;
    showContractFileSummary(file);
    await parseContract({ silent: true });
  } catch (error) {
    toast(error.message);
  }
}

function showContractFileSummary(file) {
  const prompt = $("#contractUploadPrompt");
  const summary = $("#contractFileSummary");
  if (prompt) prompt.hidden = true;
  if (summary) {
    summary.hidden = false;
    $("#contractFileName").textContent = file.name;
    $("#contractFileType").textContent = getContractFileType(file.name);
    $("#contractFileSize").textContent = formatFileSize(file.size);
  }
}

function clearContractFileSummary() {
  const prompt = $("#contractUploadPrompt");
  const summary = $("#contractFileSummary");
  if (prompt) prompt.hidden = false;
  if (summary) summary.hidden = true;
  $("#contractFile").value = "";
}

function getContractFileType(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes("openapi") || lower.endsWith(".json")) return "API Collection";
  if (lower.includes("postman")) return "Postman Collection";
  if (lower.includes("swagger")) return "Swagger API";
  if (lower.includes("har")) return "HAR File";
  return "JSON File";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function renderContractSummary() {
  const contract = state.contract;
  if ($("#baseUrl")) $("#baseUrl").value = $("#baseUrl").value || contract?.baseUrl || "";
}

function endpointLabel(scenario) {
  return `${scenario.method || ""} ${scenario.path || ""}`.trim();
}

function renderScenarios() {
  const rows = $("#scenarioRows");
  if (!state.scenarios.length) {
    rows.innerHTML = '<tr><td colspan="4" class="empty">No scenarios generated yet.</td></tr>';
    return;
  }
  $("#scenariosEmptyState").hidden = true;
  $("#scenariosSummary").hidden = false;

  rows.innerHTML = state.scenarios.map((scenario) => `
      <tr>
        <td><input class="scenario-check" type="checkbox" data-id="${escapeHtml(scenario.id)}" checked></td>
        <td>
          <strong>${escapeHtml(scenario.title)}</strong>
          <div class="muted">${escapeHtml(scenario.id)}${scenario.unlinked ? " · unlinked" : ""}</div>
        </td>
        <td><span class="pill">${escapeHtml(scenario.type || "scenario")}</span></td>
        <td>${escapeHtml(endpointLabel(scenario))}${scenario.unlinked ? ' <span class="muted">(no endpoint)</span>' : ''}</td>
      </tr>`).join("");

  $$(".scenario-check").forEach((input) => input.addEventListener("change", renderAppMetrics));
  updateScenarioControls();
}

function updateScenarioControls() {
  const has = Array.isArray(state.scenarios) && state.scenarios.length > 0;
  if ($("#selectAllScenariosBtn")) $("#selectAllScenariosBtn").disabled = !has;
  if ($("#deselectAllScenariosBtn")) $("#deselectAllScenariosBtn").disabled = !has;
}

function setScenarioSelection(checked) {
  $$(".scenario-check").forEach((input) => { input.checked = checked; });
  renderAppMetrics();
  renderCompactWorkflow();
}

function selectedScenarios() {
  const selected = new Set($$(".scenario-check:checked").map((input) => input.dataset.id));
  return state.scenarios.filter((scenario) => selected.has(String(scenario.id)));
}

function renderAuthFields() {
  const type = $("#authType")?.value;
  const target = $("#authFields");
  if (!target) return;
  if (type === "bearer") {
    target.innerHTML = '<label>Token<input id="authToken" type="password" autocomplete="off"></label>';
  } else if (type === "autoBearer") {
    target.innerHTML = `<div class="button-row auth-detect-row">
        <button id="detectAuthEndpointBtn" type="button" class="action-btn">Use detected token endpoint</button>
      </div>
      <label>Token URL<input id="tokenUrl" type="text" placeholder="/auth/token or https://auth.company.com/token"></label>
      <label>Method<select id="tokenMethod"><option value="POST">POST</option><option value="GET">GET</option></select></label>
      <label>Headers JSON<textarea id="tokenHeaders" class="mini-code" spellcheck="false">{}</textarea></label>
      <label>Body JSON<textarea id="tokenBody" class="mini-code" spellcheck="false">{}</textarea></label>
      <label>Token JSON path<input id="tokenPath" type="text" value="access_token" placeholder="access_token"></label>`;
    if ($("#detectAuthEndpointBtn")) $("#detectAuthEndpointBtn").addEventListener("click", () => {});
  } else if (type === "basic") {
    target.innerHTML = '<label>Username<input id="authUsername" type="text" autocomplete="off"></label><label>Password<input id="authPassword" type="password" autocomplete="off"></label>';
  } else if (type === "custom") {
    target.innerHTML = '<label>Header name<input id="authHeaderName" type="text" placeholder="X-API-Key"></label><label>Header value<input id="authHeaderValue" type="password" autocomplete="off"></label>';
  } else {
    target.innerHTML = "";
  }
}

function environmentPayload() {
  const authType = $("#authType")?.value || "none";
  const auth = { type: authType };
  if (authType === "bearer") auth.token = $("#authToken")?.value || "";
  if (authType === "autoBearer") {
    auth.tokenUrl = $("#tokenUrl")?.value.trim() || "";
    auth.tokenMethod = $("#tokenMethod")?.value || "POST";
    auth.tokenHeaders = $("#tokenHeaders")?.value.trim() || "{}";
    auth.tokenBody = $("#tokenBody")?.value.trim() || "{}";
    auth.tokenPath = $("#tokenPath")?.value.trim() || "access_token";
  }
  if (authType === "basic") { auth.username = $("#authUsername")?.value || ""; auth.password = $("#authPassword")?.value || ""; }
  if (authType === "custom") { auth.headerName = $("#authHeaderName")?.value || ""; auth.headerValue = $("#authHeaderValue")?.value || ""; }
  return { name: $("#envName")?.value.trim() || "local", baseUrl: $("#baseUrl")?.value.trim(), dryRun: $("#dryRun")?.checked, auth };
}

async function generateScenarios() {
  let ticket = state.ticket;
  if (!ticket) {
    const raw = $("#ticketJson").value.trim();
    if (raw) { ticket = parseTicketInput(raw); state.ticket = ticket; renderTicketSummary(); }
  }
  if (!ticket || !ticket.summary) { showModal("Step 1: No Ticket Loaded", "Cannot generate scenarios without a ticket."); return; }
  if (!state.contract) {
    const raw = $("#contractJson").value.trim();
    if (!raw) { showModal("Step 2: No Contract Loaded", "Cannot generate scenarios without an API contract."); return; }
    await parseContract({ silent: true });
    if (!state.contract) { showModal("Step 2: Contract Parse Failed", "The contract JSON could not be parsed."); return; }
  }
  setScenariosState("loading");
  try {
    const data = await api("/api/scenarios/generate", { method: "POST", body: JSON.stringify({ ticket, contract: state.contract, useAi: $("#useAi")?.checked }) });
    state.scenarios = data.scenarios || [];
    state.unusedEndpoints = data.unusedEndpoints || [];
    renderScenarios();
    renderAppMetrics();
    renderCompactWorkflow();
    updateScenariosSummary();
    saveState();
    toast(`Generated ${state.scenarios.length} scenario(s) using ${data.mode}.`);
  } catch (error) {
    showInlineError("Scenario generation failed. Your existing inputs have been preserved.");
    setScenariosState("empty");
  }
}

function bindEvents() {
  $$("[data-view-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      setActiveView(trigger.dataset.viewTrigger);
      if (trigger.dataset.viewTrigger === "history") { loadRunHistory({ silent: true }).catch((error) => toast(error.message)); }
    });
  });

  // Expand/collapse panel functionality
  $$(".expand-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const panel = btn.closest(".panel");
      if (panel) {
        panel.classList.toggle("collapsed");
        renderCompactWorkflow();
      }
    });
  });
  
  // Also allow clicking on panel head to toggle (except buttons/links)
  $$("[data-toggle-section]").forEach((header) => {
    header.addEventListener("click", (e) => {
      // Don't toggle if clicking on interactive elements
      if (e.target.closest("button, a, input, textarea, select")) return;
      const panel = header.closest(".panel");
      if (panel) {
        panel.classList.toggle("collapsed");
        renderCompactWorkflow();
      }
    });
  });

  $("#loadSampleTicketBtn")?.addEventListener("click", () => loadSampleTicket().catch((error) => toast(error.message)));
  $("#fetchJiraBtn")?.addEventListener("click", () => fetchJiraTicket().catch((error) => toast(error.message)));
  $("#changeRequirementBtn")?.addEventListener("click", () => {
    // Focus the jiraKey input to allow user to change requirement
    const jiraKeyInput = $("#jiraKey");
    if (jiraKeyInput) {
      jiraKeyInput.focus();
      jiraKeyInput.select();
    }
  });
  $("#loadSampleContractBtn")?.addEventListener("click", () => loadSampleContract().catch((error) => toast(error.message)));
  $("#parseContractBtn")?.addEventListener("click", () => parseContract().catch((error) => toast(error.message)));

  const contractFileInput = $("#contractFile");
  if (contractFileInput) {
    contractFileInput.addEventListener("change", (event) => handleContractFileUpload(event).catch((error) => toast(error.message)));
  }
  const uploadArea = $("#contractUploadArea");
  if (uploadArea) {
    uploadArea.addEventListener("click", (e) => { if (e.target.closest(".file-actions")) return; contractFileInput?.click(); });
    uploadArea.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.classList.add("dragover"); });
    uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"));
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault(); uploadArea.classList.remove("dragover");
      const file = e.dataTransfer?.files?.[0];
      if (file && contractFileInput) { contractFileInput.files = e.dataTransfer.files; handleContractFileUpload({ target: { files: e.dataTransfer.files } }); }
    });
  }
  $("#replaceContractBtn")?.addEventListener("click", () => contractFileInput?.click());
  $("#removeContractBtn")?.addEventListener("click", () => { clearContractFileSummary(); $("#contractJson").value = ""; });

  $("#generateScenariosBtn")?.addEventListener("click", () => generateScenarios().catch((error) => toast(error.message)));

$$("[data-source]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const source = chip.dataset.source;
      $$("[data-source]").forEach((c) => c.classList.toggle("active", c === chip));
      
      if (source === "jira") {
        // Switch to Jira tab - show Jira UI state only
        if ($(".source-jira")) $(".source-jira").hidden = false;
        if ($(".source-manual")) $(".source-manual").hidden = true;
        // Hide Manual-specific elements
        renderJiraTabState();
      } else if (source === "manual") {
        // Switch to Manual tab - show Manual UI state only
        if ($(".source-jira")) $(".source-jira").hidden = true;
        if ($(".source-manual")) $(".source-manual").hidden = false;
        // Hide Jira-specific elements
        renderManualTabState();
      }
    });
  });

  $("#applyManualTicketBtn")?.addEventListener("click", () => {
    try {
      getTicketFromText();
      renderTicketSummary();
      hideInlineError();
      toast(`Applied ticket ${state.ticket?.key || ""}.`);
    } catch (error) { toast(error.message); }
  });

  $("#authType")?.addEventListener("change", renderAuthFields);
  $("#historySearch")?.addEventListener("input", renderHistory);
  $("#historyStatus")?.addEventListener("change", renderHistory);
  $("#themeToggle")?.addEventListener("click", toggleTheme);
}

function loadRunHistory(options = {}) {
  api("/api/runs").then((data) => {
    state.history = data;
    renderHistory();
    renderAppMetrics();
    renderCompactWorkflow();
    if (!options.silent) toast("Run history refreshed.");
  }).catch((error) => toast(error.message));
}

function renderHistory() {
  const allRuns = state.history.runs || [];
  const query = $("#historySearch")?.value.trim().toLowerCase() || "";
  const status = $("#historyStatus")?.value || "all";
  const filteredRuns = allRuns.filter((run) => {
    const statusValue = dominantStatus(run.summary);
    const haystack = [run.id, run.ticketKey, run.ticketSummary, run.environment, run.contractTitle, run.baseUrl].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (status === "all" || status === statusValue);
  });
  $("#historyRows").innerHTML = filteredRuns.map((run) => `
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
          <span class="status ${escapeHtml(dominantStatus(run.summary))}">${escapeHtml(statusLabel(dominantStatus(run.summary)))}</span>
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
            <button type="button" data-delete-run="${escapeHtml(run.id)}" class="delete-btn">Delete</button>
          </div>
        </td>
      </tr>`).join("") || '<tr><td colspan="6" class="empty">No run history yet.</td></tr>';
}

function initTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  $("#themeToggle").textContent = currentTheme === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
  const nextTheme = currentTheme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem("theme", nextTheme);
  $("#themeToggle").textContent = nextTheme === "dark" ? "☀️" : "🌙";
}

async function boot() {
  bindEvents();
  initTheme();
  renderAuthFields();
  setActiveView(initialViewFromHash(), { skipHash: true });
  renderAppMetrics();
  renderCompactWorkflow();
  
  // Initialize Requirements section state - show empty helper at bottom for Jira tab
  renderJiraTabState();
  
  // Hide all error boxes on initial load
  hideInlineError();
  
  // Do NOT auto-load samples - require explicit user action
  // User should click "Sample" or enter a ticket key to load data
  
  await loadConfigStatus();
  await loadRunHistory({ silent: true });
  
  updateStepSummaries();
  updateScenariosPrereqStatus();
}

boot().catch((error) => {
  $("#serverState").textContent = "Attention";
  toast(error.message);
});