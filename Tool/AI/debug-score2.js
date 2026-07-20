const { matchTestCases } = require('./src/engine/matching/matchingEngine');
const { extractIntent, extractActionTerms } = require('./src/engine/matching/targetIntentExtractor');

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9/{}_-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function isResourceTerm(word) {
  const ACTION_VERBS = ["create", "add", "post", "submit", "insert", "register",
    "get", "fetch", "retrieve", "list", "search", "find",
    "update", "edit", "modify", "change", "patch",
    "delete", "remove", "cancel", "deactivate", "archive",
    "approve", "reject", "validate", "verify", "confirm",
    "process", "execute", "run", "trigger",
    "login", "logout", "authenticate", "authorize",
    "upload", "download", "export", "import",
    "enable", "disable", "activate", "deactivate"];
  return !ACTION_VERBS.includes(word) && word.length > 2;
}

async function test() {
  const testCases = [
    { id: 'TC-001', title: 'Verify happy path: Send a valid request with correct data and confirm the API returns a successful response', type: 'positive', sourceAc: 'Happy path', description: 'User registration and management', traceability: { requirementIds: ['REQ-001'], sourceText: 'Create user account management API with POST /users endpoint' } },
    { id: 'TC-002', title: 'Verify: Users can be created via POST — should succeed', type: 'positive', sourceAc: 'Users can be created via POST', description: 'User registration and management', traceability: { requirementIds: ['REQ-001'], sourceText: 'Create user account management API with POST /users endpoint' } },
    { id: 'TC-003', title: 'Verify: Users can be retrieved via GET — should succeed', type: 'positive', sourceAc: 'Users can be retrieved via GET', description: 'User registration and management', traceability: { requirementIds: ['REQ-001'], sourceText: 'Create user account management API with POST /users endpoint' } },
    { id: 'TC-004', title: 'Verify: Users can be deleted via DELETE — should succeed', type: 'positive', sourceAc: 'Users can be deleted via DELETE', description: 'User registration and management', traceability: { requirementIds: ['REQ-001'], sourceText: 'Create user account management API with POST /users endpoint' } }
  ];
  
  const endpoints = [
    { id: 'ep1', method: 'POST', path: '/users', operationId: 'createUser', summary: 'Create a new user' }, 
    { id: 'ep2', method: 'GET', path: '/users/{userId}', operationId: 'getUser', summary: 'Get user by ID' }, 
    { id: 'ep3', method: 'DELETE', path: '/users/{userId}', operationId: 'deleteUser', summary: 'Delete a user' }
  ];
  
  const { results, scenarioAssignments } = matchTestCases(testCases, endpoints, { maxCandidates: 20 });
  
  console.log('Matching Results:');
  results.forEach((r, i) => {
    console.log(`\n[${i+1}] Context ${r.contextId}`);
    console.log(`    Confidence: ${r.confidence}`);
    console.log(`    Level: ${r.confidenceLevel}`);
    console.log(`    NeedsReview: ${r.needsHumanReview}`);
    console.log(`    ResolvedEndpoint: ${r.resolvedEndpointId}`);
    console.log(`    Reasons:`, r.reviewReasons?.slice(0, 2));
    if (r.candidates?.length) {
      console.log(`    Top Candidates:`);
      r.candidates.slice(0, 3).forEach((c, j) => {
        console.log(`      ${j+1}. ${c.endpointId} (score: ${c.totalScore})`);
        if (c.signals) {
          c.signals.forEach(sig => {
            if (sig.score > 0.3) console.log(`         ${sig.name}: ${sig.score} (${sig.explanation || ''})`);
          });
        }
      });
    }
  });
}

test().catch(e => console.error('Error:', e));