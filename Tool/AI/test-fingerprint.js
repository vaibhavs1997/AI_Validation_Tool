/**
 * Debug similarity calculations
 */
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "should",
  "when", "then", "user", "api", "able", "only", "will", "must",
  "into", "have", "has", "a", "an", "to", "of", "in", "is", "are",
  "it", "as", "be", "by", "or", "on", "if", "at", "we", "you",
]);

function tokenizeForFingerprint(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function extractActionVerbs(text) {
  const ACTION_VERBS = [
    "create", "add", "post", "submit", "insert", "register", "build", "make", "generate",
    "get", "fetch", "retrieve", "list", "search", "find", "read", "view", "show", "display",
    "update", "edit", "modify", "change", "put", "patch", "replace",
    "delete", "remove", "cancel", "deactivate", "archive", "destroy",
  ];
  const tokens = tokenizeForFingerprint(text);
  return tokens.filter((t) => ACTION_VERBS.includes(t));
}

function extractHttpMethods(text) {
  const methods = [];
  const upper = text.toUpperCase();
  if (/\bPOST\b/.test(upper)) methods.push("POST");
  if (/\bGET\b/.test(upper)) methods.push("GET");
  if (/\bPUT\b/.test(upper)) methods.push("PUT");
  if (/\bPATCH\b/.test(upper)) methods.push("PATCH");
  if (/\bDELETE\b/.test(upper)) methods.push("DELETE");
  return methods;
}

function extractPaths(text) {
  const paths = [];
  const matches = text.match(/\b\/[\w{}]+(?:\/[\w{}]*)*\b/g);
  if (matches) {
    for (const m of matches) {
      const normalized = m.replace(/[{}]/g, "");
      if (!paths.includes(normalized)) paths.push(normalized);
    }
  }
  return paths;
}

function extractResourceTokens(text) {
  const ACTION_VERBS = [
    "create", "add", "post", "submit", "insert", "register",
    "get", "fetch", "retrieve", "list", "search", "find",
    "update", "edit", "modify", "change", "put", "patch",
    "delete", "remove", "cancel", "deactivate", "archive",
    "request", "response", "endpoint", "api", "service",
  ];
  const tokens = tokenizeForFingerprint(text);
  return tokens.filter((t) => !ACTION_VERBS.includes(t) && t.length > 2);
}

function generateSemanticFingerprint(text) {
  const tokens = tokenizeForFingerprint(text);
  const actionVerbs = extractActionVerbs(text);
  const methods = extractHttpMethods(text);
  const paths = extractPaths(text);
  const resources = extractResourceTokens(text);

  return {
    tokenCount: tokens.length,
    tokens: tokens.sort(),
    actionVerbs: actionVerbs,
    httpMethods: methods,
    paths: paths,
    resources: resources,
  };
}

function calculateSimilarity(fp1, fp2) {
  if (!fp1 || !fp2) return 0;

  const methodMatch = fp1.httpMethods.length > 0 && fp2.httpMethods.length > 0 &&
    fp1.httpMethods.some((m) => fp2.httpMethods.includes(m)) ? 0.3 : 0;

  const pathMatch = fp1.paths.length > 0 && fp2.paths.length > 0 &&
    fp1.paths.some((p) => fp2.paths.includes(p)) ? 0.3 : 0;

  const resourceIntersection = fp1.resources.filter((r) => fp2.resources.includes(r));
  const resourceUnion = [...new Set([...fp1.resources, ...fp2.resources])];
  const resourceOverlap = resourceUnion.length > 0 ? (resourceIntersection.length / resourceUnion.length) * 0.25 : 0;

  const actionIntersection = fp1.actionVerbs.filter((a) => fp2.actionVerbs.includes(a));
  const actionUnion = [...new Set([...fp1.actionVerbs, ...fp2.actionVerbs])];
  const actionOverlap = actionUnion.length > 0 ? (actionIntersection.length / actionUnion.length) * 0.25 : 0;

  const combinedSignals = (fp1.actionVerbs.length > 0 && fp2.actionVerbs.length > 0) &&
    (resourceIntersection.length > 0 || fp1.actionVerbs.length > 0) ? 0.2 : 0;

  return methodMatch + pathMatch + resourceOverlap + actionOverlap + combinedSignals;
}

const acTexts = [
  "Given a valid post payload, when a POST request is sent to /posts, then the API should return 201 and the created post.",
  "Given postId 1, when a GET request is sent to /posts/{postId}, then the API should return the requested post.",
  "When a GET request is sent to /posts, then the API should return all posts.",
  "Given postId 1, when a DELETE request is sent to /posts/{postId}, then the API should delete the post."
];

const descText = "Manage posts with create, read, delete operations";

console.log("=== AC FINGERPRINTS ===");
acTexts.forEach((text, i) => {
  const fp = generateSemanticFingerprint(text);
  console.log(`AC ${i+1}:`);
  console.log(`  methods: ${JSON.stringify(fp.httpMethods)}`);
  console.log(`  paths: ${JSON.stringify(fp.paths)}`);
  console.log(`  actionVerbs: ${JSON.stringify(fp.actionVerbs)}`);
  console.log(`  resources: ${JSON.stringify(fp.resources)}`);
});

console.log("\n=== DESC FINGERPRINT ===");
const descFp = generateSemanticFingerprint(descText);
console.log(`methods: ${JSON.stringify(descFp.httpMethods)}`);
console.log(`paths: ${JSON.stringify(descFp.paths)}`);
console.log(`actionVerbs: ${JSON.stringify(descFp.actionVerbs)}`);
console.log(`resources: ${JSON.stringify(descFp.resources)}`);

console.log("\n=== SIMILARITIES ===");
acTexts.forEach((text, i) => {
  const acFp = generateSemanticFingerprint(text);
  const sim = calculateSimilarity(descFp, acFp);
  console.log(`DESC <-> AC ${i+1}: ${sim.toFixed(3)}`);
});