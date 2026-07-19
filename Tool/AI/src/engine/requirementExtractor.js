/**
 * RequirementExtractor
 *
 * Converts arbitrary Jira ticket text into atomic, typed requirements.
 *
 * Pipeline:
 *   For each AC/description line → detect requirement type → split compound → classify → return
 *
 * Design principles:
 *   - Deterministic pattern matching for known requirement types
 *   - No hallucination: if pattern is unclear, mark as UNKNOWN with low confidence
 *   - Split compound requirements ("must be numeric and > 0" → 2 requirements)
 *   - Each requirement traces back to original source text
 */

const { RequirementTypes } = require("./types");
const { extractAcceptanceCriteria, compactText } = require("../acExtractor");

// ─── Pattern definitions ─────────────────────────────────────────────────────

const PATTERNS = {
  // REQUIRED_FIELD: "is required", "must be provided", "mandatory", "must include"
  REQUIRED_FIELD: [
    /\b(is\s+)?required\b/i,
    /\bmandatory\b/i,
    /\bmust\s+be\s+provided\b/i,
    /\bmust\s+include\b/i,
    /\bis\s+needed\b/i,
    /\brequires?\s+/i,
  ],

  // DATA_TYPE: "must be numeric", "must be a number", "must be an integer", "must be a string", "boolean", "array"
  DATA_TYPE: [
    /\bmust\s+be\s+(a\s+)?(numeric|number|integer|string|boolean|array|object)\b/i,
    /\b(should|must)\s+be\s+(a\s+)?valid\s+(number|integer|string|boolean)\b/i,
    /\btype\s+(of|is)\s+(string|number|integer|boolean|object|array)\b/i,
  ],

  // RANGE_CONSTRAINT: "greater than", "less than", "minimum", "maximum", "exceed", "between"
  RANGE_CONSTRAINT: [
    /\b(greater|more|higher|lager?)\s+than\b/i,
    /\b(less|lower|smaller?)\s+than\b/i,
    /\bminimum\b/i,
    /\bmaximum\b/i,
    /\bexceed\b/i,
    /\b(not\s+)?exceed\b/i,
    /\bbetween\s+\d+\s+and\s+\d+\b/i,
    /\brange\s+(of|from)\b/i,
    /\bat\s+(least|most)\b/i,
    /\bup\s+to\b/i,
    /\bno\s+more\s+than\b/i,
    /\bno\s+less\s+than\b/i,
    /\bpositive\b/i,
    /\bnegative\b/i,
    /\bgreat?er\s+than\s+zero\b/i,
    /\bmust\s+be\s+[<>]\b/i,
  ],

  // FORMAT_CONSTRAINT: "valid email", "must match pattern", "must be in format", "date format"
  FORMAT_CONSTRAINT: [
    /\b(valid|correct|proper)\s+email\b/i,
    /\b(email|date|phone|zip|postal|url|uri)\s+format\b/i,
    /\bmust\s+match\s+pattern\b/i,
    /\bmust\s+be\s+in\s+format\b/i,
    /\bformat\s+(must\s+be|should\s+be)\b/i,
    /\bISO\s+(8601|date|datetime)\b/i,
    /\bUUID\b/i,
    /\bGUID\b/i,
    /\bregex\b/i,
  ],

  // ENUM_CONSTRAINT: "must be one of", "must be either", "allowed values", "valid values"
  ENUM_CONSTRAINT: [
    /\bmust\s+be\s+one\s+of\b/i,
    /\bmust\s+be\s+either\b/i,
    /\ballowed\s+values?\b/i,
    /\bvalid\s+values?\b/i,
    /\bpossible\s+values?\b/i,
    /\bshould\s+be\s+(either|one\s+of)\b/i,
  ],

  // LENGTH_CONSTRAINT: "max length", "min length", "must not exceed N characters", "at most N chars"
  LENGTH_CONSTRAINT: [
    /\b(max|maximum|min|minimum)\s+length\b/i,
    /\b(not\s+)?exceed\s+\d+\s+characters?\b/i,
    /\bat\s+(most|least)\s+\d+\s+characters?\b/i,
    /\bcharacters?\s+long\b/i,
    /\blength\s+(must\s+be|should\s+be|is)\b/i,
    /\bup\s+to\s+\d+\s+characters?\b/i,
    /\bno\s+more\s+than\s+\d+\s+characters?\b/i,
  ],

  // AUTHENTICATION: "authenticated", "login", "token", "bearer", "auth"
  AUTHENTICATION: [
    /\b(authenticate|authentication)\b/i,
    /\blogin\b/i,
    /\btoken\b/i,
    /\bbearer\b/i,
    /\bauth\b/i,
    /\bOAuth\b/i,
    /\bAPI\s*key\b/i,
    /\bsession\b/i,
  ],

  // AUTHORIZATION: "authorized", "permission", "role", "access", "admin"
  AUTHORIZATION: [
    /\b(authorize|authorization)\b/i,
    /\bpermission\b/i,
    /\brole\b/i,
    /\baccess\s+(control|level|right)\b/i,
    /\badmin\b/i,
    /\b(should\s+)?not\s+be\s+allowed\b/i,
  ],

  // STATUS_CODE: "200", "201", "400", "404", "500", "status code"
  STATUS_CODE: [
    /\b\d{3}\s+(status|response|error)\b/i,
    /\bstatus\s+code\b/i,
    /\breturn\s+\d{3}\b/i,
    /\bHTTP\s+\d{3}\b/i,
  ],

  // BUSINESS_RULE: complex domain rules
  BUSINESS_RULE: [
    /\bmust\s+(not\s+)?(be\s+)?(allow|prevent|reject|approve|validate|check|verify|ensure)\b/i,
    /\bshould\s+(not\s+)?(allow|prevent|reject)\b/i,
    /\bonly\s+(when|if)\b/i,
    /\bcannot\s+be\s+(process|complete|submit)\b/i,
    /\bif\s+.+\s+then\b/i,
    /\bwhen\b.*\b(should|must|will)\b/i,
    /\bexcept\b/i,
    /\bunless\b/i,
    /\bcondition\b.*\bon\b/i,
    /\btrigger\b/i,
  ],

  // WORKFLOW / STATE_TRANSITION
  WORKFLOW: [
    /\b(status|state)\s+(change|transition|move|update)\b/i,
    /\bflow\b/i,
    /\bworkflow\b/i,
    /\bapproval\s+(process|workflow|step)\b/i,
    /\bstep\s+\d+\b/i,
    /\bphase\b/i,
    /\b(should|must)\s+move\s+(from|to)\b/i,
    /\btransitions?\s+(from|to|between)\b/i,
  ],

  // API_BEHAVIOR: generic API description
  API_BEHAVIOR: [
    /\b(endpoint|API|service)\s+(should|must|will|returns?)\b/i,
    /\brequest\b.*\b(should|must|will)\b.*\b(response|return)\b/i,
    /\bPOST\b|\bGET\b|\bPUT\b|\bPATCH\b|\bDELETE\b/i,
    /\baccept\s+(POST|GET|PUT|PATCH|DELETE)\b/i,
  ],

  // ERROR_HANDLING
  ERROR_HANDLING: [
    /\berror\s+(message|handling|response|code)\b/i,
    /\b(should|must)\s+return\s+(appropriate|meaningful|descriptive)\s+error\b/i,
    /\berror\s+(should|must)\b/i,
    /\bfail\s+(gracefully|with)\b/i,
    /\bexception\b/i,
  ],
};

// ─── Field detection ─────────────────────────────────────────────────────────

function detectField(text) {
  // Look for common patterns: "X field", "X parameter", "the X"
  const fieldPatterns = [
    /\b(?:the\s+)?['"]?(\w+)['"]?\s+(field|parameter|input|value|attribute|property)\b/i,
    /\bfield\s+['"]?(\w+)['"]?\b/i,
    /\bparameter\s+['"]?(\w+)['"]?\b/i,
    /\b(?:the\s+)?(\w+)\s+(must|should|is|will|can|cannot)\b/i,
    /\b['"](\w+)['"]\b/,
  ];

  for (const pattern of fieldPatterns) {
    const match = text.match(pattern);
    if (match) {
      const field = match[1] || match[0];
      // Skip common non-field words
      if (/^(the|this|that|it|they|we|you|system|api|user|request|response)$/i.test(field)) continue;
      return field.toLowerCase();
    }
  }
  return null;
}

function extractNumericValues(text) {
  // Handle $10,000 style numbers by removing $ and commas first
  const cleaned = text.replace(/[$,]/g, "");
  const numbers = cleaned.match(/\b\d+\b/g);
  return numbers ? numbers.map(Number) : [];
}

function detectComparator(text) {
  if (/\bgreat?er\s+than\s+or\s+equal\b/i.test(text)) return ">=";
  if (/\bless\s+than\s+or\s+equal\b/i.test(text)) return "<=";
  if (/\bgreat?er\s+than\b/i.test(text)) return ">";
  if (/\bless\s+than\b/i.test(text)) return "<";
  if (/\bequal\s+to\b/i.test(text)) return "==";
  if (/[<>]/.test(text)) return text.match(/[<>]=?/)[0];
  return null;
}

// ─── Compound splitting ─────────────────────────────────────────────────────

/**
 * Split compound requirements like "Amount must be numeric and greater than zero"
 * by coordinating conjunctions ("and", ",") that join two separate constraints.
 */
function splitCompound(text) {
  // Only split when "and" or "," connects two distinct requirement patterns
  // Avoid splitting: "between 3 and 20" (range), "at least 8 and contain" (password rule)
  // Avoid splitting on "and" inside known phrases

  // Known non-splittable phrases
  const noSplitPhrases = [
    /\bbetween\s+\d+\s+and\s+\d+\b/i,
    /\b(at\s+least|up\s+to|no\s+more\s+than|no\s+less\s+than)\s+\d+\s+and\b/i,
  ];

  for (const phrase of noSplitPhrases) {
    if (phrase.test(text)) return [text]; // Don't split ranges
  }

  // Splittable: "X and must Y", "X, must Y", "X; must Y"
  const separators = [
    /\s+and\s+(must|should)\b/i,
    /\s*,\s*(must|should)\b/i,
    /;\s*(must|should)\b/i,
  ];

  for (const sep of separators) {
    const match = text.match(sep);
    if (match) {
      const before = text.slice(0, match.index).trim();
      const after = text.slice(match.index + match[0].length).trim();
      if (before && after && before.length > 8 && after.length > 5) {
        return [before, after];
      }
    }
  }

  return [text];
}

// ─── Requirement type classification ────────────────────────────────────────

function classifyRequirement(text) {
  for (const [type, patterns] of Object.entries(PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return { type, confidence: 0.85 };
      }
    }
  }

  // If no pattern matched but text contains "should" or "must", it's likely a business rule
  if (/\b(should|must|will|shall)\b/i.test(text)) {
    return { type: RequirementTypes.BUSINESS_RULE, confidence: 0.5 };
  }

  return { type: RequirementTypes.UNKNOWN, confidence: 0.2 };
}

function extractConstraint(text, requirementType) {
  const constraint = {};
  const numbers = extractNumericValues(text);

  switch (requirementType) {
    case RequirementTypes.DATA_TYPE: {
      const typeMatch = text.match(/\b(numeric|number|integer|string|boolean|array|object)\b/i);
      if (typeMatch) constraint.dataType = typeMatch[1].toLowerCase();
      break;
    }
    case RequirementTypes.RANGE_CONSTRAINT: {
      const comparator = detectComparator(text);
      if (comparator && numbers.length > 0) {
        constraint.comparator = comparator;
        constraint.comparisonValue = numbers[0];
      }
      // Direct min/max extraction
      const minMatch = text.match(/(?:minimum|min|at\s+least|no\s+less\s+than)\s*(?:value\s+)?(?:of\s+)?(\d+)/i);
      const maxMatch = text.match(/(?:maximum|max|at\s+most|no\s+more\s+than|exceed)\s*(?:value\s+)?(?:of\s+)?(\d+)/i);
      if (minMatch) constraint.minimum = Number(minMatch[1]);
      if (maxMatch) constraint.maximum = Number(maxMatch[1]);
      break;
    }
    case RequirementTypes.LENGTH_CONSTRAINT: {
      const minMatch = text.match(/(?:minimum|min|at\s+least)\s*(?:length\s+)?(?:of\s+)?(\d+)/i);
      const maxMatch = text.match(/(?:maximum|max|at\s+most|exceed|no\s+more\s+than)\s*(?:length\s+)?(?:of\s+)?(\d+)/i);
      if (minMatch) constraint.minLength = Number(minMatch[1]);
      if (maxMatch) constraint.maxLength = Number(maxMatch[1]);
      break;
    }
    case RequirementTypes.FORMAT_CONSTRAINT: {
      const formatMatch = text.match(/\b(email|date|phone|zip|postal|url|uri|uuid|guid|ip)\b/i);
      if (formatMatch) constraint.format = formatMatch[1].toLowerCase();
      break;
    }
    case RequirementTypes.ENUM_CONSTRAINT: {
      // Try to extract enum values: "one of [A, B, C]" or "must be either X, Y, or Z"
      const enumMatch = text.match(/(?:one\s+of|either)\s*[:\-]?\s*(.+?)(?:\.|$)/i);
      if (enumMatch) {
        const values = enumMatch[1]
          .split(/[,;]/)
          .map((v) => v.trim().replace(/^(and|or)\s+/i, ""))
          .filter((v) => v && v.length > 0);
        if (values.length > 0) constraint.enum = values;
      }
      break;
    }
    case RequirementTypes.REQUIRED_FIELD: {
      constraint.required = true;
      break;
    }
  }

  return Object.keys(constraint).length > 0 ? constraint : undefined;
}

// ─── Main extraction ─────────────────────────────────────────────────────────

function extractRequirements(ticket) {
  const requirements = [];
  let reqCounter = 0;

  const allSources = [];

  // Collect all text sources with their origin type
  if (ticket.acceptanceCriteria && Array.isArray(ticket.acceptanceCriteria)) {
    for (const ac of ticket.acceptanceCriteria) {
      allSources.push({ text: ac, type: "AC" });
    }
  }

  if (ticket.description) {
    // Also extract inline ACs from description
    const inlineACs = extractAcceptanceCriteria(ticket.description);
    for (const ac of inlineACs) {
      // Avoid duplicates with explicit ACs
      if (!ticket.acceptanceCriteria || !ticket.acceptanceCriteria.includes(ac)) {
        allSources.push({ text: ac, type: "AC" });
      }
    }
    // Add the full description as a source (after removing already-extracted ACs)
    const cleanDesc = compactText(ticket.description);
    if (cleanDesc) {
      allSources.push({ text: cleanDesc, type: "DESCRIPTION" });
    }
  }

  if (ticket.comments && Array.isArray(ticket.comments)) {
    for (const comment of ticket.comments) {
      if (comment.body) {
        allSources.push({ text: compactText(comment.body), type: "COMMENT" });
      }
    }
  }

  // Process each source
  const seen = new Set();

  for (const source of allSources) {
    const text = source.text.trim();
    if (!text || text.length < 5) continue;

    // Split compound requirements
    const parts = splitCompound(text);

    for (const part of parts) {
      const normalized = part.trim();
      if (!normalized || normalized.length < 5) continue;

      // Normalize for dedup check
      const dedupKey = normalized.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80);
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const { type, confidence } = classifyRequirement(normalized);
      const field = detectField(normalized);
      const constraint = extractConstraint(normalized, type);

      reqCounter++;
      const reqId = `REQ-${String(reqCounter).padStart(3, "0")}`;

      requirements.push({
        requirementId: reqId,
        sourceText: normalized,
        sourceType: source.type,
        requirementType: type,
        subject: field || ticket.summary || "unknown",
        constraint: constraint,
        explicit: source.type === "AC" || source.type === "CONTRACT",
        confidence: confidence,
      });
    }
  }

  return requirements;
}

module.exports = {
  extractRequirements,
  classifyRequirement,
  splitCompound,
  detectField,
};
