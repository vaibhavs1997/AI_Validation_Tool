/**
 * Acceptance Criteria Extractor
 * Shared module used by both jiraClient.js and app.js
 * Provides deterministic AC extraction from Jira descriptions and plain text.
 */

/**
 * Normalize text: trim lines, remove excessive blank lines.
 */
function compactText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Clean a single AC item by removing prefixes like "AC:", "Acceptance Criteria:", numbering, etc.
 */
function cleanAcceptanceItem(item) {
  if (!item) return "";
  let s = String(item || "");
  // remove leading AC labels like "AC", "ACs", "AC`s", "Acceptance Criteria:" etc.
  s = s.replace(/^(?:\s*AC(?:'s)?s?|\s*ACs|\s*Acceptance Criteria)\s*[:\-\.\s]*/i, "");
  // remove leading numbering or bullets
  s = s.replace(/^[-*\s\d\.)]+/, "");
  return s.trim();
}

/**
 * Extract acceptance criteria from a Jira description or plain text body.
 * Supports:
 *   - "Acceptance Criteria:" / "AC:" / "ACs:" headers with bullet or numbered lists
 *   - Inline "ACs: 1.foo, 2.bar" format
 *   - Plain bullet/numbered lists at the end of description
 */
function extractAcceptanceCriteria(text) {
  const normalized = compactText(text);
  const lines = normalized.split("\n");

  // Find a line that starts the AC section
  const headerIndex = lines.findIndex((line) =>
    /^(acceptance criteria|acceptance conditions|acceptance criteria|ac)\b/i.test(line.replace(/[:#-]/g, "").trim())
  );

  if (headerIndex >= 0) {
    const criteria = [];
    for (let i = headerIndex + 1; i < lines.length; i += 1) {
      let line = lines[i].trim();
      if (!line) {
        if (criteria.length) break;
        continue;
      }
      // stop if a new heading appears after we've collected some criteria
      if (/^[A-Z][A-Za-z ]{2,}:$/.test(line) && criteria.length) break;
      line = line.replace(/^[-*0-9.)\s]+/, "").trim();
      // if the line contains multiple items separated by commas or semicolons, split them
      if (/[,;]\s*/.test(line) && !/\bhttps?:\/\//i.test(line)) {
        const parts = line.split(/[,;]\s*/).map((p) => p.trim()).filter(Boolean);
        for (const p of parts) criteria.push(cleanAcceptanceItem(p));
      } else {
        criteria.push(cleanAcceptanceItem(line));
      }
    }
    return criteria.filter(Boolean);
  }

  // Fallback: inline AC lists like "ACs: 1.foo, 2.bar" on a single line
  const inlineMatch = normalized.match(/\b(?:acceptance criteria|ac|acs)\b\s*[:\-]\s*(.+)$/i);
  if (inlineMatch && inlineMatch[1]) {
    return inlineMatch[1]
      .split(/\s*(?:\d+\.|\d+\)|,|;|\n)\s*/)
      .map(cleanAcceptanceItem)
      .filter(Boolean);
  }

  // Last resort: look for any bullet or numbered items in the text
  return lines
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
    .map(cleanAcceptanceItem)
    .filter(Boolean);
}

module.exports = {
  cleanAcceptanceItem,
  compactText,
  extractAcceptanceCriteria,
};
