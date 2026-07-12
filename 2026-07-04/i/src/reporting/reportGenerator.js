function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resultBadge(status) {
  const labels = {
    passed: "Passed",
    failed: "Failed",
    blocked: "Blocked",
    needs_review: "Needs Review",
    dry_run: "Dry Run",
  };
  return `<span class="badge ${escapeHtml(status)}">${labels[status] || escapeHtml(status)}</span>`;
}

function formatJson(value) {
  if (value === null || value === undefined) return "";
  return escapeHtml(JSON.stringify(value, null, 2));
}

function generateHtmlReport(run) {
  const rows = run.results
    .map((result) => {
      const assertions = result.validation?.assertions || [];
      return `
        <section class="case">
          <div class="case-head">
            <h2>${escapeHtml(result.title)}</h2>
            ${resultBadge(result.status)}
          </div>
          <dl>
            <dt>Scenario ID</dt><dd>${escapeHtml(result.scenarioId)}</dd>
            <dt>Request</dt><dd>${escapeHtml(result.request?.method)} ${escapeHtml(result.request?.url)}</dd>
            <dt>Actual Status</dt><dd>${escapeHtml(result.response?.status ?? result.status)}</dd>
            <dt>Error</dt><dd>${escapeHtml(result.error || "")}</dd>
          </dl>
          <h3>Assertions</h3>
          <ul>${assertions
            .map((assertion) => `<li>${assertion.passed === true ? "PASS" : assertion.passed === false ? "FAIL" : "REVIEW"} - ${escapeHtml(assertion.name)}</li>`)
            .join("")}</ul>
          <details>
            <summary>Request evidence</summary>
            <pre>${formatJson(result.request)}</pre>
          </details>
          <details>
            <summary>Response evidence</summary>
            <pre>${formatJson(result.response)}</pre>
          </details>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>API Validation Report - ${escapeHtml(run.ticket?.key || run.id)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #17212b; background: #f6f8fa; }
    header { background: #17212b; color: white; padding: 28px 40px; }
    main { padding: 28px 40px; max-width: 1120px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 0; font-size: 18px; }
    h3 { margin-bottom: 6px; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(6, minmax(110px, 1fr)); gap: 12px; margin: 20px 0; }
    .metric, .case { background: white; border: 1px solid #d9e0e7; border-radius: 8px; }
    .metric { padding: 14px; }
    .metric strong { display: block; font-size: 22px; }
    .case { padding: 18px; margin-bottom: 16px; }
    .case-head { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .passed { background: #dff7ea; color: #126b3a; }
    .failed { background: #ffe2e0; color: #a32018; }
    .blocked { background: #fff0ca; color: #735100; }
    .needs_review, .dry_run { background: #e5ebf7; color: #294a7a; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 6px 12px; }
    dt { color: #667485; font-weight: 700; }
    dd { margin: 0; word-break: break-word; }
    pre { white-space: pre-wrap; background: #101820; color: #eef6ff; padding: 12px; border-radius: 6px; overflow: auto; }
  </style>
</head>
<body>
  <header>
    <h1>API Validation Report</h1>
    <div>${escapeHtml(run.ticket?.key || "Manual")} - ${escapeHtml(run.ticket?.summary || run.contract?.title || "")}</div>
  </header>
  <main>
    <section class="summary">
      <div class="metric"><span>Total</span><strong>${run.summary.total}</strong></div>
      <div class="metric"><span>Passed</span><strong>${run.summary.passed || 0}</strong></div>
      <div class="metric"><span>Failed</span><strong>${run.summary.failed || 0}</strong></div>
      <div class="metric"><span>Blocked</span><strong>${run.summary.blocked || 0}</strong></div>
      <div class="metric"><span>Review</span><strong>${run.summary.needs_review || 0}</strong></div>
      <div class="metric"><span>Dry Run</span><strong>${run.summary.dry_run || 0}</strong></div>
    </section>
    ${rows}
  </main>
</body>
</html>`;
}

module.exports = {
  generateHtmlReport,
};
