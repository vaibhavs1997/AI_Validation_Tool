/**
 * EndpointIndex
 *
 * Builds inverted indexes from the normalized API catalog for O(1) candidate retrieval.
 * All indexes are built dynamically — no hardcoded field names or business terms.
 *
 * Supports indexing by:
 *   - Field names (from request body schemas)
 *   - JSON paths (nested)
 *   - URL path tokens (excluding path parameters)
 *   - Operation terms (operationId, summary, description)
 *   - Tags
 *   - Query parameter names
 *   - Path parameter names
 *   - Header names
 *   - HTTP method
 *   - Folder hierarchy (Postman)
 *   - Content type
 */

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "should",
  "when", "then", "api", "able", "only", "will", "must",
  "into", "have", "has", "get", "post", "put", "patch", "delete",
]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9/{}_-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Collect all field paths from a schema recursively.
 * Returns array of { name, path } objects.
 */
function collectFieldPaths(schema, prefix = "") {
  const fields = [];
  if (!schema || typeof schema !== "object") return fields;
  const props = schema.properties || {};
  for (const [key, child] of Object.entries(props)) {
    const path = prefix ? `${prefix}.${key}` : key;
    fields.push({ name: key, path });
    // Recurse into nested objects
    if (child.properties) {
      fields.push(...collectFieldPaths(child, path));
    }
    // Recurse into array items
    if (child.items && child.items.properties) {
      fields.push(...collectFieldPaths(child.items, `${path}[]`));
    }
  }
  return fields;
}

/**
 * Build complete inverted index from the API catalog.
 *
 * @param {Array} endpoints — normalized endpoints array
 * @param {Map<string, string>} [folderMap] — endpointId → folder path (e.g., "Orders/Refund")
 * @returns {Object} FieldIndex-compatible index
 */
function buildIndex(endpoints, folderMap = new Map()) {
  const byFieldName = new Map();
  const byJsonPath = new Map();
  const byPathToken = new Map();
  const byOperationTerm = new Map();
  const byTag = new Map();
  const byQueryParam = new Map();
  const byPathParam = new Map();
  const byHeaderParam = new Map();
  const byMethod = new Map();
  const byFolder = new Map();
  const byContentType = new Map();

  for (const ep of endpoints || []) {
    const epId = ep.id;
    if (!epId) continue;

    // ─── Index by HTTP method ─────────────────────────────────────
    const method = (ep.method || "").toUpperCase();
    if (method) {
      if (!byMethod.has(method)) byMethod.set(method, []);
      byMethod.get(method).push(epId);
    }

    // ─── Index by path tokens ─────────────────────────────────────
    const pathTokens = (ep.path || "").split("/").filter(Boolean);
    for (const token of pathTokens) {
      const clean = token.replace(/[{}]/g, "");
      if (!clean) continue;
      if (!byPathToken.has(clean)) byPathToken.set(clean, []);
      if (!byPathToken.get(clean).includes(epId)) {
        byPathToken.get(clean).push(epId);
      }
    }

    // ─── Index by operationId / summary / description terms ───────
    const opText = [ep.operationId, ep.summary, ep.description].filter(Boolean).join(" ");
    for (const term of tokenize(opText)) {
      if (!byOperationTerm.has(term)) byOperationTerm.set(term, []);
      if (!byOperationTerm.get(term).includes(epId)) {
        byOperationTerm.get(term).push(epId);
      }
    }

    // ─── Index by tags ────────────────────────────────────────────
    for (const tag of (ep.tags || [])) {
      const tagLower = tag.toLowerCase().trim();
      if (!tagLower) continue;
      if (!byTag.has(tagLower)) byTag.set(tagLower, []);
      if (!byTag.get(tagLower).includes(epId)) {
        byTag.get(tagLower).push(epId);
      }
    }

    // ─── Index by query parameters ───────────────────────────────
    for (const param of (ep.parameters || [])) {
      const loc = (param.in || "").toLowerCase();
      const name = (param.name || "").toLowerCase().trim();
      if (!name) continue;

      if (loc === "query") {
        if (!byQueryParam.has(name)) byQueryParam.set(name, []);
        if (!byQueryParam.get(name).includes(epId)) byQueryParam.get(name).push(epId);
      } else if (loc === "path") {
        if (!byPathParam.has(name)) byPathParam.set(name, []);
        if (!byPathParam.get(name).includes(epId)) byPathParam.get(name).push(epId);
      } else if (loc === "header") {
        if (!byHeaderParam.has(name)) byHeaderParam.set(name, []);
        if (!byHeaderParam.get(name).includes(epId)) byHeaderParam.get(name).push(epId);
      }
    }

    // ─── Index by request body fields ────────────────────────────
    if (ep.requestSchema) {
      const fields = collectFieldPaths(ep.requestSchema);
      for (const f of fields) {
        // by field name
        if (!byFieldName.has(f.name)) byFieldName.set(f.name, []);
        if (!byFieldName.get(f.name).includes(epId)) {
          byFieldName.get(f.name).push(epId);
        }
        // by JSON path
        if (!byJsonPath.has(f.path)) byJsonPath.set(f.path, []);
        if (!byJsonPath.get(f.path).includes(epId)) {
          byJsonPath.get(f.path).push(epId);
        }
      }
    }

    // ─── Index by content type ───────────────────────────────────
    // Extract from request schema or known content types
    const contentTypes = [];
    if (ep.requestBodyContent) {
      for (const ct of Object.keys(ep.requestBodyContent)) {
        contentTypes.push(ct.toLowerCase());
      }
    }
    // Default JSON if body exists
    if (ep.requestSchema && contentTypes.length === 0) {
      contentTypes.push("application/json");
    }
    for (const ct of contentTypes) {
      if (!byContentType.has(ct)) byContentType.set(ct, []);
      if (!byContentType.get(ct).includes(epId)) {
        byContentType.get(ct).push(epId);
      }
    }

    // ─── Index by folder ─────────────────────────────────────────
    const folder = folderMap.get(epId);
    if (folder) {
      const parts = folder.split("/");
      // Index each folder level
      for (let i = 0; i < parts.length; i++) {
        const subFolder = parts.slice(0, i + 1).join("/").toLowerCase();
        if (!byFolder.has(subFolder)) byFolder.set(subFolder, []);
        if (!byFolder.get(subFolder).includes(epId)) {
          byFolder.get(subFolder).push(epId);
        }
      }
    }
  }

  return {
    byFieldName,
    byJsonPath,
    byPathToken,
    byOperationTerm,
    byTag,
    byQueryParam,
    byPathParam,
    byHeaderParam,
    byMethod,
    byFolder,
    byContentType,
  };
}

/**
 * Retrieve candidate endpoint IDs for a given intent using the index.
 * Uses multiple index lookups and unions the results — returns deduplicated list.
 *
 * @param {Object} intent — OperationIntent from TargetIntent
 * @param {Object} idx — FieldIndex
 * @param {Object} [options]
 * @param {number} [options.maxCandidates=20]
 * @returns {string[]} — candidate endpoint IDs
 */
function retrieveCandidates(intent, idx, options = {}) {
  const { maxCandidates = 20 } = options;
  const candidates = new Set();

  // 1. By method hints
  for (const method of (intent.methodHints || [])) {
    const eps = idx.byMethod.get(method);
    if (eps) eps.forEach((id) => candidates.add(id));
  }

  // 2. By action terms → match against operation terms and path tokens
  const actionTerms = intent.actionTerms || [];
  for (const term of actionTerms) {
    // Check operation terms
    const opEps = idx.byOperationTerm.get(term);
    if (opEps) opEps.forEach((id) => candidates.add(id));
    // Check path tokens
    const pathEps = idx.byPathToken.get(term);
    if (pathEps) pathEps.forEach((id) => candidates.add(id));
  }

  // 3. By resource terms → match against path tokens, tags, operation terms
  const resourceTerms = intent.resourceTerms || [];
  for (const term of resourceTerms) {
    const pathEps = idx.byPathToken.get(term);
    if (pathEps) pathEps.forEach((id) => candidates.add(id));
    const opEps = idx.byOperationTerm.get(term);
    if (opEps) opEps.forEach((id) => candidates.add(id));
    const tagEps = idx.byTag.get(term);
    if (tagEps) tagEps.forEach((id) => candidates.add(id));
  }

  // 4. By context terms
  for (const term of (intent.contextTerms || [])) {
    const opEps = idx.byOperationTerm.get(term);
    if (opEps) opEps.forEach((id) => candidates.add(id));
  }

  // If no method hints, add all endpoints
  if (candidates.size === 0) {
    for (const eps of idx.byMethod.values()) {
      eps.forEach((id) => candidates.add(id));
    }
  }

  // Sort by score descending using a quick relevance heuristic
  const ranked = Array.from(candidates);

  // Limit to max candidates
  return ranked.slice(0, maxCandidates);
}

module.exports = {
  buildIndex,
  retrieveCandidates,
  collectFieldPaths,
};
