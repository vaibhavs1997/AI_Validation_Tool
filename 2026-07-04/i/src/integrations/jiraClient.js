const config = require("../config");

function isConfigured() {
  return Boolean(config.jira.baseUrl && config.jira.email && config.jira.apiToken);
}

function authHeader() {
  const token = Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString("base64");
  return `Basic ${token}`;
}

async function jiraFetch(path, options = {}) {
  if (!isConfigured()) {
    throw new Error("Jira is not configured. Add JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to .env.");
  }

  const url = `${config.jira.baseUrl.replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.errorMessages?.join("; ") || data?.message || text || response.statusText;
    throw new Error(`Jira request failed (${response.status}): ${message}`);
  }

  return data;
}

function adfToText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfToText).filter(Boolean).join("\n");

  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";

  const content = Array.isArray(node.content) ? node.content.map(adfToText).join("") : "";
  if (["paragraph", "heading", "blockquote"].includes(node.type)) return `${content}\n`;
  if (["bulletList", "orderedList"].includes(node.type)) return `${content}\n`;
  if (node.type === "listItem") return `- ${content.trim()}\n`;
  return content;
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
  // remove leading AC labels like "AC", "ACs", "AC`s", "Acceptance Criteria:" etc.
  s = s.replace(/^(?:\s*AC(?:'s)?s?|\s*ACs|\s*Acceptance Criteria)\s*[:\-\.\s]*/i, "");
  // remove leading numbering or bullets
  s = s.replace(/^[-*\s\d\.)]+/, "");
  return s.trim();
}

function extractAcceptanceCriteria(description) {
  const text = compactText(description);
  const lines = text.split("\n");
  // Find a line that starts the AC section
  const startIndex = lines.findIndex((line) =>
    /^(acceptance criteria|ac|acceptance conditions)\b/i.test(line.replace(/[:#-]/g, "").trim())
  );

  if (startIndex === -1) {
    // Also support inline AC lists like "ACs: 1.foo, 2.bar" on a single line
    const inlineMatch = text.match(/\b(?:acceptance criteria|ac|acs)\b\s*[:\-]\s*(.+)$/i);
    if (inlineMatch && inlineMatch[1]) {
      const tail = inlineMatch[1];
      // Split on commas or numbered items
      return tail
        .split(/\s*(?:\d+\.|\d+\)|,|;|\n)\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^[:\-\s]+/, "").trim());
    }
    return [];
  }

  const criteria = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    let line = lines[i].trim();
    if (!line) {
      if (criteria.length) break;
      continue;
    }
    // stop if a new heading appears after we've collected some criteria
    if (/^[A-Z][A-Za-z ]{2,}:$/.test(line) && criteria.length) break;
    // remove common list prefixes and numbering
    line = line.replace(/^\s*(?:AC\b[:\-\s]*)?/i, "");
    line = line.replace(/^[-*0-9.)\s]+/, "").trim();
    // if the line contains multiple items separated by commas or semicolons, split them
    if (/[,;]\s*/.test(line) && !/\bhttps?:\/\//i.test(line)) {
      const parts = line.split(/[,;]\s*/).map((p) => p.trim()).filter(Boolean);
      for (const p of parts) criteria.push(p.replace(/^[:\-\s]+/, "").trim());
    } else {
      criteria.push(line);
    }
  }
  return criteria.filter(Boolean);
}

function findCustomAcceptance(fields, names = {}) {
  const values = [];
  for (const [fieldKey, label] of Object.entries(names || {})) {
    if (!/acceptance|criteria|ac\b/i.test(label)) continue;
    const raw = fields[fieldKey];
    if (!raw) continue;
    if (typeof raw === "string") values.push(raw);
    else values.push(adfToText(raw));
  }
  return values.flatMap((value) => compactText(value).split("\n")).filter(Boolean);
}

function normalizeIssue(issue) {
  const fields = issue.fields || {};
  const names = issue.names || {};
  const description = compactText(adfToText(fields.description) || fields.description || "");
  const acceptanceCriteria = [
    ...findCustomAcceptance(fields, names),
    ...extractAcceptanceCriteria(description),
  ].map(cleanAcceptanceItem).filter(Boolean);

  const comments = fields.comment?.comments || [];

  return {
    key: issue.key,
    id: issue.id,
    url: config.jira.baseUrl ? `${config.jira.baseUrl.replace(/\/$/, "")}/browse/${issue.key}` : "",
    summary: fields.summary || "",
    issueType: fields.issuetype?.name || "",
    status: fields.status?.name || "",
    priority: fields.priority?.name || "",
    labels: fields.labels || [],
    description,
    acceptanceCriteria: [...new Set(acceptanceCriteria.map(compactText).filter(Boolean))],
    comments: comments.map((comment) => ({
      author: comment.author?.displayName || "",
      created: comment.created || "",
      body: compactText(adfToText(comment.body)),
    })),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchIssue(issueKey) {
  const key = encodeURIComponent(String(issueKey || "").trim());
  if (!key) throw new Error("Issue key is required.");

  const issue = await jiraFetch(`/rest/api/3/issue/${key}?expand=names`);
  return normalizeIssue(issue);
}

async function searchIssues(jql, maxResults = 10) {
  const data = await jiraFetch("/rest/api/3/search/jql", {
    method: "POST",
    body: JSON.stringify({
      jql,
      maxResults,
      expand: ["names"],
    }),
  });

  return {
    total: data.total || 0,
    issues: (data.issues || []).map(normalizeIssue),
  };
}

module.exports = {
  fetchIssue,
  isConfigured,
  searchIssues,
};
