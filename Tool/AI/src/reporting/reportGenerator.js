function escapeHtml(value) {
  return String(value ?? "")
    .replace(/\x26/g, "\x26\x61\x6d\x70\x3b")
    .replace(/\x3c/g, "\x26\x6c\x74\x3b")
    .replace(/\x3e/g, "\x26\x67\x74\x3b")
    .replace(/\x22/g, "\x26\x71\x75\x6f\x74\x3b");
}

function resultBadge(status) {
  const labels = {
    passed: "Passed",
    failed: "Failed",
    blocked: "Blocked",
    needs_review: "Needs Review",
    dry_run: "Dry Run",
  };
  const icons = {
    passed: "\u2713",
    failed: "\u2717",
    blocked: "\u26A0",
    needs_review: "?",
    dry_run: "\u25CB",
  };
  return '<span class="badge badge-' + escapeHtml(status) + '">' + (icons[status] || "") + " " + (labels[status] || escapeHtml(status)) + "</span>";
}

function formatJson(value) {
  if (value === null || value === undefined) return "";
  return escapeHtml(JSON.stringify(value, null, 2));
}

function formatDuration(start, end) {
  if (!start || !end) return "";
  const ms = new Date(end) - new Date(start);
  if (ms < 1000) return ms + "ms";
  if (ms < 60000) return (ms / 1000).toFixed(1) + "s";
  return Math.floor(ms / 60000) + "m " + Math.floor((ms % 60000) / 1000) + "s";
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function generateHtmlReport(run) {
  const summary = run.summary || {};
  const total = summary.total || 0;
  const passed = summary.passed || 0;
  const failed = summary.failed || 0;
  const blocked = summary.blocked || 0;
  const needsReview = summary.needs_review || 0;
  const dryRun = summary.dry_run || 0;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const responseTimes = (run.results || []).map(function(r) { return r.validation && r.validation.responseTimeMs; }).filter(Boolean);
  const avgResponseTime = responseTimes.length ? Math.round(responseTimes.reduce(function(a, b) { return a + b; }, 0) / responseTimes.length) : 0;

  var rows = "";
  for (var i = 0; i < run.results.length; i++) {
    var result = run.results[i];
    var assertions = (result.validation && result.validation.assertions) || [];
    var responseTime = (result.validation && result.validation.responseTimeMs) ? result.validation.responseTimeMs + "ms" : "\u2014";
    var statusColor = result.status === "passed" ? "#22c55e" : result.status === "failed" ? "#ef4444" : result.status === "blocked" ? "#f59e0b" : "#6366f1";
    var hasError = result.error ? true : false;

    var assertionRows = "";
    for (var a = 0; a < assertions.length; a++) {
      var assertion = assertions[a];
      var icon = assertion.passed === true ? "\u2713" : assertion.passed === false ? "\u2717" : "\u25C8";
      var cls = assertion.passed === true ? "assert-pass" : assertion.passed === false ? "assert-fail" : "assert-review";
      assertionRows += '<tr class="' + cls + '">' +
        '<td class="assert-icon">' + icon + '</td>' +
        '<td>' + escapeHtml(assertion.name) + '</td>' +
        '<td>' + (assertion.expected !== undefined ? escapeHtml(String(assertion.expected)) : "\u2014") + '</td>' +
        '<td>' + (assertion.actual !== undefined ? escapeHtml(String(assertion.actual)) : "\u2014") + '</td>' +
        "</tr>";
    }

    rows += '<div class="result-card" data-status="' + escapeHtml(result.status) + '">' +
      '<div class="card-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">' +
        '<div class="card-status-bar" style="background:' + statusColor + '"></div>' +
        '<div class="card-title-row">' +
          '<span class="card-index">#' + (i + 1) + '</span>' +
          '<div class="card-title-text">' +
            '<strong>' + escapeHtml(result.title) + '</strong>' +
            '<span class="card-id">' + escapeHtml(result.scenarioId) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="card-meta">' +
          '<span class="response-time">' + responseTime + '</span>' +
          resultBadge(result.status) +
          '<span class="collapse-icon">\u25BC</span>' +
        '</div>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="info-grid">' +
          '<div class="info-item">' +
            '<span class="info-label">Request</span>' +
            '<span class="info-value mono">' + escapeHtml(result.request ? result.request.method : "") + " " + escapeHtml(result.request ? result.request.url : "") + '</span>' +
          '</div>' +
          '<div class="info-item">' +
            '<span class="info-label">Response Status</span>' +
            '<span class="info-value" style="color:' + statusColor + ';font-weight:700">' + ((result.response && result.response.status) || result.status || "\u2014") + '</span>' +
          '</div>' +
          '<div class="info-item">' +
            '<span class="info-label">Duration</span>' +
            '<span class="info-value">' + formatDuration(result.startedAt, result.finishedAt) + '</span>' +
          '</div>' +
          '<div class="info-item">' +
            '<span class="info-label">Started</span>' +
            '<span class="info-value">' + formatDate(result.startedAt) + '</span>' +
          '</div>' +
        '</div>' +
        (hasError ? '<div class="error-block">\u26A0 ' + escapeHtml(result.error) + '</div>' : "") +
        (assertions.length ? '<div class="assertions-section">' +
          '<h4 class="section-title">Assertions <span class="assert-count">' + assertions.filter(function(a) { return a.passed === true; }).length + "/" + assertions.length + " passed</span></h4>" +
          '<div class="table-wrap">' +
            '<table class="assert-table">' +
              '<thead><tr><th></th><th>Assertion</th><th>Expected</th><th>Actual</th></tr></thead>' +
              '<tbody>' + assertionRows + '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' : "") +
        '<div class="details-row">' +
          '<details>' +
            '<summary>Request Payload</summary>' +
            '<pre>' + formatJson(result.request) + '</pre>' +
          '</details>' +
          '<details>' +
            '<summary>Response Body</summary>' +
            '<pre>' + formatJson(result.response) + '</pre>' +
          '</details>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  var css = [
    ":root {",
    "--bg: #f0f2f5; --surface: #ffffff; --surface-alt: #f8fafc; --ink: #0f172a; --ink-secondary: #475569;",
    "--muted: #94a3b8; --line: #e2e8f0; --line-strong: #cbd5e1;",
    "--green: #22c55e; --green-bg: #f0fdf4; --green-border: #bbf7d0;",
    "--red: #ef4444; --red-bg: #fef2f2; --red-border: #fecaca;",
    "--amber: #f59e0b; --amber-bg: #fffbeb; --amber-border: #fde68a;",
    "--indigo: #6366f1; --indigo-bg: #eef2ff; --indigo-border: #c7d2fe;",
    "--blue: #3b82f6; --blue-deep: #1d4ed8;",
    "--shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);",
    "--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04);",
    "--radius: 12px; --radius-sm: 8px;",
    "}",
    '[data-theme="dark"] {',
    "--bg: #0b1120; --surface: #131b2e; --surface-alt: #1a2440; --ink: #e2e8f0; --ink-secondary: #94a3b8;",
    "--muted: #64748b; --line: #1e293b; --line-strong: #334155;",
    "--green: #4ade80; --green-bg: #052e16; --green-border: #166534;",
    "--red: #f87171; --red-bg: #450a0a; --red-border: #991b1b;",
    "--amber: #fbbf24; --amber-bg: #451a03; --amber-border: #92400e;",
    "--indigo: #818cf8; --indigo-bg: #1e1b4b; --indigo-border: #3730a3;",
    "--blue: #60a5fa; --blue-deep: #3b82f6;",
    "--shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);",
    "--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -2px rgba(0,0,0,0.2);",
    "}",
    "* { box-sizing: border-box; margin: 0; padding: 0; }",
    "body { margin: 0; background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; }",
    ".report-container { max-width: 1200px; margin: 0 auto; padding: 24px; }",
    ".report-header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: var(--radius); padding: 32px 36px; color: #fff; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap; }",
    ".report-header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 6px; }",
    ".report-header .subtitle { color: #94a3b8; font-size: 14px; }",
    ".report-header .subtitle strong { color: #e2e8f0; }",
    ".header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }",
    ".header-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid rgba(255,255,255,0.2); border-radius: var(--radius-sm); background: rgba(255,255,255,0.08); color: #e2e8f0; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; transition: background 0.15s, border-color 0.15s; }",
    ".header-btn:hover { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.3); }",
    ".header-btn.primary { background: #3b82f6; border-color: #3b82f6; color: #fff; }",
    ".header-btn.primary:hover { background: #2563eb; }",
    ".dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }",
    ".metric-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); text-align: center; }",
    ".metric-card .metric-value { font-size: 32px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }",
    ".metric-card .metric-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-top: 6px; }",
    ".metric-card.metric-total .metric-value { color: var(--ink); }",
    ".metric-card.metric-passed .metric-value { color: var(--green); }",
    ".metric-card.metric-failed .metric-value { color: var(--red); }",
    ".metric-card.metric-blocked .metric-value { color: var(--amber); }",
    ".metric-card.metric-review .metric-value { color: var(--indigo); }",
    ".metric-card.metric-dryrun .metric-value { color: var(--muted); }",
    ".metric-card.metric-avgtime .metric-value { color: var(--blue); font-size: 26px; }",
    ".pass-rate-section { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; margin-bottom: 24px; box-shadow: var(--shadow); }",
    ".pass-rate-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }",
    ".pass-rate-header h3 { font-size: 15px; font-weight: 700; }",
    ".pass-rate-header .rate-value { font-size: 20px; font-weight: 800; }",
    ".rate-value.good { color: var(--green); } .rate-value.ok { color: var(--amber); } .rate-value.bad { color: var(--red); }",
    ".progress-bar { height: 10px; background: var(--line); border-radius: 999px; overflow: hidden; display: flex; }",
    ".progress-bar .seg { height: 100%; transition: width 0.6s ease; }",
    ".progress-bar .seg-pass { background: var(--green); }",
    ".progress-bar .seg-fail { background: var(--red); }",
    ".progress-bar .seg-block { background: var(--amber); }",
    ".progress-bar .seg-review { background: var(--indigo); }",
    ".progress-bar .seg-dryrun { background: var(--muted); }",
    ".progress-legend { display: flex; gap: 16px; margin-top: 10px; flex-wrap: wrap; }",
    ".progress-legend span { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-secondary); }",
    ".legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }",
    ".run-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 24px; box-shadow: var(--shadow); }",
    ".run-info-item .ri-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }",
    ".run-info-item .ri-value { font-size: 14px; font-weight: 600; margin-top: 2px; word-break: break-word; }",
    ".controls-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; }",
    ".controls-bar input, .controls-bar select { padding: 8px 12px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--ink); font-size: 13px; outline: none; }",
    ".controls-bar input:focus, .controls-bar select:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }",
    ".controls-bar input { flex: 1; min-width: 200px; }",
    ".controls-bar .result-count { font-size: 13px; color: var(--muted); margin-left: auto; }",
    ".result-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); margin-bottom: 12px; box-shadow: var(--shadow); overflow: hidden; transition: box-shadow 0.2s; }",
    ".result-card:hover { box-shadow: var(--shadow-lg); }",
    ".result-card.collapsed .card-body { display: none; }",
    ".result-card.collapsed .collapse-icon { transform: rotate(-90deg); }",
    ".card-header { display: flex; align-items: center; gap: 0; cursor: pointer; user-select: none; }",
    ".card-status-bar { width: 5px; align-self: stretch; flex-shrink: 0; }",
    ".card-title-row { display: flex; align-items: center; gap: 12px; flex: 1; padding: 14px 16px; min-width: 0; }",
    ".card-index { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--surface-alt); color: var(--muted); font-size: 12px; font-weight: 700; flex-shrink: 0; }",
    ".card-title-text { min-width: 0; }",
    ".card-title-text strong { display: block; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".card-id { font-size: 11px; color: var(--muted); font-family: 'SF Mono', Consolas, monospace; }",
    ".card-meta { display: flex; align-items: center; gap: 10px; padding: 14px 16px; flex-shrink: 0; }",
    ".response-time { font-size: 12px; color: var(--muted); font-weight: 600; font-family: 'SF Mono', Consolas, monospace; }",
    ".collapse-icon { font-size: 10px; color: var(--muted); transition: transform 0.2s; }",
    ".card-body { border-top: 1px solid var(--line); padding: 20px 24px; }",
    ".info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }",
    ".info-label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 2px; }",
    ".info-value { font-size: 13px; font-weight: 600; word-break: break-word; }",
    ".info-value.mono { font-family: 'SF Mono', Consolas, monospace; font-size: 12px; font-weight: 500; }",
    ".error-block { background: var(--red-bg); border: 1px solid var(--red-border); border-radius: var(--radius-sm); padding: 12px 16px; color: var(--red); font-weight: 600; margin-bottom: 16px; font-size: 13px; }",
    ".assertions-section { margin-bottom: 16px; }",
    ".section-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }",
    ".assert-count { font-size: 12px; font-weight: 600; color: var(--muted); }",
    ".table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius-sm); }",
    ".assert-table { width: 100%; border-collapse: collapse; font-size: 13px; }",
    ".assert-table th { background: var(--surface-alt); padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); border-bottom: 1px solid var(--line); }",
    ".assert-table td { padding: 8px 12px; border-bottom: 1px solid var(--line); vertical-align: middle; }",
    ".assert-table tr:last-child td { border-bottom: 0; }",
    ".assert-icon { width: 30px; text-align: center; font-size: 14px; }",
    ".assert-pass td { color: var(--green); } .assert-pass .assert-icon { color: var(--green); }",
    ".assert-fail td { color: var(--red); } .assert-fail .assert-icon { color: var(--red); }",
    ".assert-review td { color: var(--ink-secondary); } .assert-review .assert-icon { color: var(--amber); }",
    ".details-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }",
    "@media (max-width: 700px) { .details-row { grid-template-columns: 1fr; } }",
    "details { border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; }",
    "details summary { padding: 10px 14px; cursor: pointer; font-size: 13px; font-weight: 700; color: var(--blue); background: var(--surface-alt); user-select: none; }",
    "details summary:hover { background: var(--line); }",
    "details pre { margin: 0; padding: 14px; background: #0b1120; color: #e2e8f0; font-family: 'SF Mono', Consolas, 'Courier New', monospace; font-size: 12px; line-height: 1.5; overflow-x: auto; white-space: pre-wrap; word-break: break-word; max-height: 400px; overflow-y: auto; }",
    ".badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap; }",
    ".badge-passed { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }",
    ".badge-failed { background: var(--red-bg); color: var(--red); border: 1px solid var(--red-border); }",
    ".badge-blocked { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }",
    ".badge-needs_review { background: var(--indigo-bg); color: var(--indigo); border: 1px solid var(--indigo-border); }",
    ".badge-dry_run { background: var(--surface-alt); color: var(--muted); border: 1px solid var(--line-strong); }",
    ".report-footer { text-align: center; padding: 24px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--line); margin-top: 32px; }",
    ".hidden { display: none !important; }",
    "@media print { body { background: #fff; } .report-header { background: #0f172a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .progress-bar .seg { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .header-actions { display: none; } .controls-bar { display: none; } .result-card { break-inside: avoid; } }"
  ].join("\n");

  var html = '<!doctype html>\n<html lang="en" data-theme="light">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>API Validation Report - ' + escapeHtml(run.ticket ? run.ticket.key : run.id) + '</title>\n  <style>\n' + css + '\n  </style>\n</head>\n<body>\n  <div class="report-container">\n    <header class="report-header">\n      <div>\n        <h1>API Validation Report</h1>\n        <div class="subtitle">\n          <strong>' + escapeHtml(run.ticket ? run.ticket.key : "Manual") + '</strong> &mdash; ' + escapeHtml((run.ticket && run.ticket.summary) || (run.contract && run.contract.title) || "") + '\n        </div>\n      </div>\n      <div class="header-actions">\n        <button class="header-btn" onclick="window.print()">\uD83D\uDDA8 Print / PDF</button>\n        <button class="header-btn" onclick="toggleTheme()">\uD83C\uDF19 Toggle Theme</button>\n        <button class="header-btn primary" onclick="window.scrollTo({top:0,behavior:\'smooth\'})">\u2191 Top</button>\n      </div>\n    </header>\n    <div class="dashboard">\n      <div class="metric-card metric-total"><div class="metric-value">' + total + '</div><div class="metric-label">Total Tests</div></div>\n      <div class="metric-card metric-passed"><div class="metric-value">' + passed + '</div><div class="metric-label">Passed</div></div>\n      <div class="metric-card metric-failed"><div class="metric-value">' + failed + '</div><div class="metric-label">Failed</div></div>\n      <div class="metric-card metric-blocked"><div class="metric-value">' + blocked + '</div><div class="metric-label">Blocked</div></div>\n      <div class="metric-card metric-review"><div class="metric-value">' + needsReview + '</div><div class="metric-label">Needs Review</div></div>\n      <div class="metric-card metric-dryrun"><div class="metric-value">' + dryRun + '</div><div class="metric-label">Dry Run</div></div>\n      <div class="metric-card metric-avgtime"><div class="metric-value">' + (avgResponseTime > 0 ? avgResponseTime + "ms" : "\u2014") + '</div><div class="metric-label">Avg Response</div></div>\n    </div>\n    <div class="pass-rate-section">\n      <div class="pass-rate-header">\n        <h3>Test Results Overview</h3>\n        <span class="rate-value ' + (passRate >= 80 ? "good" : passRate >= 50 ? "ok" : "bad") + '">' + passRate + '% pass rate</span>\n      </div>\n      <div class="progress-bar">' +
        (passed > 0 ? '<div class="seg seg-pass" style="width:' + ((passed / total) * 100) + '%"></div>' : "") +
        (failed > 0 ? '<div class="seg seg-fail" style="width:' + ((failed / total) * 100) + '%"></div>' : "") +
        (blocked > 0 ? '<div class="seg seg-block" style="width:' + ((blocked / total) * 100) + '%"></div>' : "") +
        (needsReview > 0 ? '<div class="seg seg-review" style="width:' + ((needsReview / total) * 100) + '%"></div>' : "") +
        (dryRun > 0 ? '<div class="seg seg-dryrun" style="width:' + ((dryRun / total) * 100) + '%"></div>' : "") +
      '</div>\n      <div class="progress-legend">\n        <span><span class="legend-dot" style="background:var(--green)"></span> Passed (' + passed + ')</span>\n        <span><span class="legend-dot" style="background:var(--red)"></span> Failed (' + failed + ')</span>\n        <span><span class="legend-dot" style="background:var(--amber)"></span> Blocked (' + blocked + ')</span>\n        <span><span class="legend-dot" style="background:var(--indigo)"></span> Review (' + needsReview + ')</span>\n        <span><span class="legend-dot" style="background:var(--muted)"></span> Dry Run (' + dryRun + ')</span>\n      </div>\n    </div>\n    <div class="run-info">\n      <div class="run-info-item"><div class="ri-label">Run ID</div><div class="ri-value" style="font-family:monospace;font-size:12px">' + escapeHtml(run.id) + '</div></div>\n      <div class="run-info-item"><div class="ri-label">Created</div><div class="ri-value">' + formatDate(run.createdAt) + '</div></div>\n      <div class="run-info-item"><div class="ri-label">Environment</div><div class="ri-value">' + escapeHtml((run.environment && run.environment.name) || "\u2014") + '</div></div>\n      <div class="run-info-item"><div class="ri-label">Base URL</div><div class="ri-value" style="font-family:monospace;font-size:12px">' + escapeHtml((run.environment && run.environment.baseUrl) || "\u2014") + '</div></div>\n      <div class="run-info-item"><div class="ri-label">Auth</div><div class="ri-value">' + escapeHtml((run.environment && run.environment.authType) || "none") + '</div></div>\n      <div class="run-info-item"><div class="ri-label">Contract</div><div class="ri-value">' + escapeHtml((run.contract && run.contract.title) || "\u2014") + (run.contract && run.contract.version ? " v" + escapeHtml(run.contract.version) : "") + '</div></div>\n      <div class="run-info-item"><div class="ri-label">Endpoints</div><div class="ri-value">' + ((run.contract && run.contract.endpointCount) || "\u2014") + '</div></div>\n      <div class="run-info-item"><div class="ri-label">Dry Run</div><div class="ri-value">' + (run.environment && run.environment.dryRun ? "Yes" : "No") + '</div></div>\n    </div>\n    <div class="controls-bar">\n      <input type="text" id="searchInput" placeholder="Search scenarios by title, ID, status..." oninput="filterResults()">\n      <select id="statusFilter" onchange="filterResults()">\n        <option value="all">All Statuses</option>\n        <option value="passed">Passed</option>\n        <option value="failed">Failed</option>\n        <option value="blocked">Blocked</option>\n        <option value="needs_review">Needs Review</option>\n        <option value="dry_run">Dry Run</option>\n      </select>\n      <button class="header-btn" onclick="expandAll()">\u25BC Expand All</button>\n      <button class="header-btn" onclick="collapseAll()">\u25B2 Collapse All</button>\n      <span class="result-count" id="resultCount">Showing ' + run.results.length + " of " + run.results.length + '</span>\n    </div>\n    <div id="resultsContainer">\n' + rows + '\n    </div>\n    <footer class="report-footer">\n      Generated by AI API Validation Tool MVP &mdash; ' + formatDate(new Date().toISOString()) + '\n    </footer>\n  </div>\n  <script>\n    function toggleTheme() {\n      var html = document.documentElement;\n      var current = html.getAttribute("data-theme");\n      html.setAttribute("data-theme", current === "dark" ? "light" : "dark");\n    }\n    function filterResults() {\n      var query = document.getElementById("searchInput").value.toLowerCase().trim();\n      var status = document.getElementById("statusFilter").value;\n      var cards = document.querySelectorAll(".result-card");\n      var visible = 0;\n      cards.forEach(function(card) {\n        var text = card.textContent.toLowerCase();\n        var cardStatus = card.getAttribute("data-status");\n        var matchesSearch = !query || text.indexOf(query) !== -1;\n        var matchesStatus = status === "all" || cardStatus === status;\n        var show = matchesSearch && matchesStatus;\n        if (show) { card.classList.remove("hidden"); visible++; }\n        else { card.classList.add("hidden"); }\n      });\n      document.getElementById("resultCount").textContent = "Showing " + visible + " of " + cards.length;\n    }\n    function expandAll() {\n      document.querySelectorAll(".result-card").forEach(function(card) { card.classList.remove("collapsed"); });\n    }\n    function collapseAll() {\n      document.querySelectorAll(".result-card").forEach(function(card) { card.classList.add("collapsed"); });\n    }\n  <\/script>\n</body>\n</html>';

  return html;
}

module.exports = {
  generateHtmlReport,
};