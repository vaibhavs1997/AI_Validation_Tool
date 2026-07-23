const { generateScenarios } = require("./src/scenarios/scenarioGenerator");
const { parseContract } = require("./src/contracts/contractParser");

async function test() {
  const ticket = require("./sample-data/jira-ticket.json");
  const rawContract = require("./sample-data/openapi-refund.json");
  const contract = parseContract(rawContract);
  
  console.log("=== SAMPLE DATA TEST ===\n");
  console.log("Ticket:", ticket.key, "-", ticket.summary);
  console.log("Contract endpoints:", contract.endpoints?.map(e => `${e.method} ${e.path} (${e.operationId})`).join(", "));
  
  const result = await generateScenarios({ ticket, contract });
  
  console.log("\n=== SCENARIOS ===");
  result.scenarios.forEach((s, i) => {
    console.log(`\n[${i+1}] ${s.title.substring(0,80)}...`);
    console.log(`    Type: ${s.type}, Risk: ${s.risk}`);
    console.log(`    Endpoint: ${s.endpointId ? s.method + ' ' + s.path : 'Unlinked'}`);
    console.log(`    Match Score: ${s.matchScore || 0}, Confidence: ${s.matchConfidence || 'none'}`);
    if (s.matchReasons?.length) console.log(`    Reasons: ${s.matchReasons.join(', ')}`);
  });
  
  console.log("\n=== UNLINKED SCENARIOS ===");
  const unlinked = result.scenarios.filter(s => s.unlinked);
  console.log(`Count: ${unlinked.length}`);
  unlinked.forEach(s => console.log(`  - ${s.title.substring(0,60)}...`));
  
  console.log("\n=== UNUSED ENDPOINTS ===");
  console.log(result.unusedEndpoints?.map(e => `${e.method} ${e.path}`).join(', ') || 'None');
}

test().catch(console.error);