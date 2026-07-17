const fs = require("fs");
const path = require("path");

const outDir = path.resolve(__dirname, "../outputs");
const outFile = path.join(outDir, "ai-api-validation-solution-architecture.pdf");

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const fonts = {
  regular: "F1",
  bold: "F2",
  mono: "F3",
};

const pages = [];
let current = null;
let y = PAGE_HEIGHT - MARGIN_TOP;
let pageNumber = 0;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function textWidth(text, fontSize, fontName) {
  const mono = fontName === fonts.mono;
  let units = 0;
  for (const ch of String(text)) {
    if (mono) {
      units += 0.6;
    } else if (ch === " ") {
      units += 0.28;
    } else if ("ilI.,:;!'|".includes(ch)) {
      units += 0.25;
    } else if ("mwMW@#%&".includes(ch)) {
      units += 0.85;
    } else if ("0123456789".includes(ch)) {
      units += 0.53;
    } else {
      units += 0.5;
    }
  }
  return units * fontSize;
}

function wrapText(text, maxWidth, fontSize, fontName) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, fontSize, fontName) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);

    if (textWidth(word, fontSize, fontName) <= maxWidth) {
      line = word;
      continue;
    }

    let chunk = "";
    for (const ch of word) {
      const next = `${chunk}${ch}`;
      if (textWidth(next, fontSize, fontName) <= maxWidth) {
        chunk = next;
      } else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    line = chunk;
  }

  if (line) lines.push(line);
  return lines;
}

function newPage() {
  pageNumber += 1;
  current = [];
  pages.push(current);
  y = PAGE_HEIGHT - MARGIN_TOP;

  if (pageNumber > 1) {
    drawText("AI API Validation Tool - Solution Architecture", MARGIN_X, PAGE_HEIGHT - 30, {
      size: 8,
      font: fonts.regular,
      color: "0.35 0.35 0.35",
    });
    y -= 16;
  }
}

function drawText(text, x, baseline, options = {}) {
  const size = options.size || 10;
  const font = options.font || fonts.regular;
  const color = options.color || "0 0 0";
  current.push(
    `BT ${color} rg /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`
  );
}

function drawLine(x1, y1, x2, y2, color = "0.85 0.85 0.85", width = 0.8) {
  current.push(`${color} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
}

function requireSpace(height) {
  if (!current) newPage();
  if (y - height < MARGIN_BOTTOM) newPage();
}

function addTitle(title, subtitle) {
  requireSpace(100);
  drawText(title, MARGIN_X, y, { size: 22, font: fonts.bold });
  y -= 26;
  drawText(subtitle, MARGIN_X, y, { size: 11, color: "0.25 0.25 0.25" });
  y -= 22;
  drawLine(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y, "0.15 0.35 0.55", 1.2);
  y -= 22;
}

function addHeading(text) {
  requireSpace(42);
  y -= 6;
  drawText(text, MARGIN_X, y, { size: 14, font: fonts.bold, color: "0.1 0.22 0.34" });
  y -= 9;
  drawLine(MARGIN_X, y, PAGE_WIDTH - MARGIN_X, y);
  y -= 14;
}

function addSubheading(text) {
  requireSpace(30);
  y -= 4;
  drawText(text, MARGIN_X, y, { size: 11, font: fonts.bold, color: "0.12 0.12 0.12" });
  y -= 15;
}

function addParagraph(text) {
  const size = 9.4;
  const lineHeight = 13;
  const lines = wrapText(text, CONTENT_WIDTH, size, fonts.regular);
  requireSpace(lines.length * lineHeight + 7);
  for (const line of lines) {
    drawText(line, MARGIN_X, y, { size, font: fonts.regular });
    y -= lineHeight;
  }
  y -= 4;
}

function addBullets(items, indent = 14) {
  const size = 9.2;
  const lineHeight = 12.5;
  for (const item of items) {
    const lines = wrapText(item, CONTENT_WIDTH - indent - 10, size, fonts.regular);
    requireSpace(lines.length * lineHeight + 4);
    drawText("-", MARGIN_X, y, { size, font: fonts.regular });
    drawText(lines[0], MARGIN_X + indent, y, { size, font: fonts.regular });
    y -= lineHeight;
    for (let i = 1; i < lines.length; i += 1) {
      drawText(lines[i], MARGIN_X + indent, y, { size, font: fonts.regular });
      y -= lineHeight;
    }
    y -= 2;
  }
  y -= 4;
}

function addNumbered(items) {
  const size = 9.2;
  const lineHeight = 12.5;
  items.forEach((item, index) => {
    const label = `${index + 1}.`;
    const lines = wrapText(item, CONTENT_WIDTH - 24, size, fonts.regular);
    requireSpace(lines.length * lineHeight + 4);
    drawText(label, MARGIN_X, y, { size, font: fonts.bold });
    drawText(lines[0], MARGIN_X + 24, y, { size, font: fonts.regular });
    y -= lineHeight;
    for (let i = 1; i < lines.length; i += 1) {
      drawText(lines[i], MARGIN_X + 24, y, { size, font: fonts.regular });
      y -= lineHeight;
    }
    y -= 2;
  });
  y -= 4;
}

function addCodeBlock(lines) {
  const size = 7.6;
  const lineHeight = 10.5;
  const blockLines = [];
  for (const line of lines) {
    const wrapped = wrapText(line, CONTENT_WIDTH - 20, size, fonts.mono);
    blockLines.push(...(wrapped.length ? wrapped : [""]));
  }

  requireSpace(blockLines.length * lineHeight + 20);
  const top = y + 6;
  const bottom = y - blockLines.length * lineHeight - 7;
  current.push(`0.96 0.97 0.98 rg ${MARGIN_X - 4} ${bottom.toFixed(2)} ${CONTENT_WIDTH + 8} ${(top - bottom).toFixed(2)} re f`);
  current.push(`0.82 0.84 0.86 RG 0.6 w ${MARGIN_X - 4} ${bottom.toFixed(2)} ${CONTENT_WIDTH + 8} ${(top - bottom).toFixed(2)} re S`);

  for (const line of blockLines) {
    drawText(line, MARGIN_X + 6, y, { size, font: fonts.mono, color: "0.08 0.08 0.08" });
    y -= lineHeight;
  }
  y -= 12;
}

function addKeyValue(label, value) {
  const size = 9.2;
  const lines = wrapText(value, CONTENT_WIDTH - 120, size, fonts.regular);
  requireSpace(lines.length * 12.5 + 5);
  drawText(label, MARGIN_X, y, { size, font: fonts.bold });
  drawText(lines[0], MARGIN_X + 120, y, { size, font: fonts.regular });
  y -= 12.5;
  for (let i = 1; i < lines.length; i += 1) {
    drawText(lines[i], MARGIN_X + 120, y, { size, font: fonts.regular });
    y -= 12.5;
  }
  y -= 2;
}

function addFooterNumbers() {
  pages.forEach((page, index) => {
    page.push(
      `BT 0.45 0.45 0.45 rg /${fonts.regular} 8 Tf 1 0 0 1 ${(PAGE_WIDTH / 2 - 14).toFixed(2)} 24 Tm (${index + 1} / ${pages.length}) Tj ET`
    );
  });
}

function buildPdf() {
  const objects = [];
  function addObject(content) {
    objects.push(content);
    return objects.length;
  }

  const fontRegular = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBold = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const fontMono = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  const pageRefs = [];
  const pageObjectPlaceholders = [];
  const contentRefs = [];

  for (const page of pages) {
    const stream = page.join("\n");
    const contentRef = addObject(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    contentRefs.push(contentRef);
    pageObjectPlaceholders.push(objects.length + 1);
    pageRefs.push(`${objects.length + 1} 0 R`);
    addObject("");
  }

  const pagesRef = objects.length + 1;

  pageObjectPlaceholders.forEach((pageRef, index) => {
    objects[pageRef - 1] =
      `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /${fonts.regular} ${fontRegular} 0 R /${fonts.bold} ${fontBold} 0 R /${fonts.mono} ${fontMono} 0 R >> >> /Contents ${contentRefs[index]} 0 R >>`;
  });

  addObject(`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`);
  const catalogRef = addObject(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

function renderDocument() {
  newPage();
  addTitle("AI API Validation Tool", "Solution Architecture and Delivery Structure");
  addParagraph(
    "This document describes an automated QA assistant that fetches Jira requirements, generates API test scenarios from ticket descriptions and acceptance criteria, mutates request payloads, executes APIs, validates responses, and produces QA-verifiable reports."
  );

  addHeading("Architecture Overview");
  addParagraph(
    "The platform should combine Jira requirements with deterministic API knowledge. Jira gives intent, but reliable automation also needs OpenAPI or Swagger contracts, Postman collections, sample payloads, environment configuration, authentication rules, reusable test data, and validation logic."
  );
  addCodeBlock([
    "Jira Ticket -> Jira Integration Service -> Requirement Parser -> AI Test Scenario Generator",
    "OpenAPI / Swagger / Postman -> API Contract Repository -> Scenario Generator",
    "Scenario Generator + Test Data Repository -> Payload Builder -> API Execution Engine",
    "Environment + Auth Manager -> API Execution Engine -> Response Validator",
    "Response Validator -> AI Result Analyzer -> QA Review Report -> Dashboard / Jira",
  ]);

  addHeading("Core Components");
  addSubheading("1. Jira Integration Service");
  addParagraph(
    "Fetches Jira tickets, descriptions, acceptance criteria, labels, comments, attachments, and linked stories. It should also publish generated reports back to Jira as comments or attachments."
  );
  addBullets([
    "Authenticate with Jira using OAuth or API token.",
    "Fetch tickets by ticket key, JQL, sprint, status, assignee, or webhook trigger.",
    "Extract summary, description, acceptance criteria, business rules, attachments, and linked issues.",
    "Push the final QA report back to Jira for traceability.",
  ]);

  addSubheading("2. Requirement Parser");
  addParagraph(
    "Converts unstructured Jira text into structured requirements that can be mapped to APIs and test scenarios."
  );
  addBullets([
    "Identify affected feature, entities, endpoints, user actions, preconditions, and business rules.",
    "Classify positive flows, negative flows, boundary conditions, auth checks, and missing details.",
    "Produce a structured intermediate model that the test generator can use safely.",
  ]);
  addCodeBlock([
    "{",
    '  "feature": "Refund payment",',
    '  "rules": [',
    '    "Refund allowed only for settled payments",',
    '    "Refund amount must be less than or equal to captured amount"',
    "  ],",
    '  "entities": ["payment", "refund"],',
    '  "missingInfo": ["Exact refund endpoint not mentioned"]',
    "}",
  ]);

  addSubheading("3. API Contract Repository");
  addParagraph(
    "Stores the API truth source. This component helps the AI map Jira requirements to actual endpoints, request schemas, response schemas, auth requirements, and expected status codes."
  );
  addBullets([
    "Import OpenAPI or Swagger files.",
    "Import Postman collections and sample request/response payloads.",
    "Index internal API docs, historical tests, and known defect patterns.",
    "Version contracts so generated tests can be traced to a specific API definition.",
  ]);

  addSubheading("4. AI Test Scenario Generator");
  addParagraph(
    "Generates reviewable test scenarios using Jira requirements, API contracts, historical test patterns, and business rules."
  );
  addBullets([
    "Generate positive, negative, boundary, required-field, data-type, auth, idempotency, and state-transition scenarios.",
    "Trace each scenario back to a Jira acceptance criterion or business rule.",
    "Return structured JSON, not free-form text, so scenarios can be edited, stored, and executed.",
  ]);
  addCodeBlock([
    "{",
    '  "scenarioId": "PAY-1234-TC-004",',
    '  "title": "Refund amount greater than captured amount",',
    '  "type": "negative",',
    '  "endpoint": "POST /payments/{paymentId}/refunds",',
    '  "payloadMutation": { "amount": 150, "reason": "Customer request" },',
    '  "expectedStatus": 400',
    "}",
  ]);

  addSubheading("5. Payload Builder and Mutation Engine");
  addParagraph(
    "Builds executable requests from base payloads and modifies them according to each generated test case."
  );
  addBullets([
    "Support replace, remove, nullify, empty string, invalid type, max length, boundary min/max, duplicate request, and special-character mutations.",
    "Resolve dynamic values from previous API responses, fixtures, test data, or environment variables.",
    "Keep original and mutated payloads in the report so QA can inspect exactly what was sent.",
  ]);

  addSubheading("6. Test Data Manager");
  addParagraph(
    "Prepares valid system state before API execution and cleans it up after test runs where possible."
  );
  addBullets([
    "Create prerequisite users, orders, payments, tokens, accounts, and other domain records.",
    "Fetch valid IDs from APIs or allowed databases.",
    "Mask sensitive data and avoid production data by default.",
    "Maintain reusable fixtures for common preconditions such as settled payment or inactive user.",
  ]);

  addSubheading("7. API Execution Engine");
  addParagraph(
    "Runs generated scenarios against the selected environment and captures complete evidence for review."
  );
  addBullets([
    "Execute REST calls with generated headers, path params, query params, and payloads.",
    "Support chained requests, token refresh, retries for transient failures, and async job polling.",
    "Capture request, response, status code, headers, latency, timestamps, and correlation IDs.",
    "Run jobs asynchronously for large ticket batches.",
  ]);

  addSubheading("8. Response Validator");
  addParagraph(
    "Uses deterministic checks wherever possible. The AI can help explain results, but pass/fail decisions should rely on explicit assertions."
  );
  addBullets([
    "Validate HTTP status code, response schema, required fields, error codes, and field values.",
    "Validate response time SLA and contract compliance.",
    "Optionally validate downstream state using read APIs or approved database checks.",
    "Classify results as passed, failed, blocked, skipped, or needs manual review.",
  ]);

  addSubheading("9. AI Result Analyzer");
  addParagraph(
    "Summarizes execution results in QA-friendly language and explains likely causes of failures."
  );
  addBullets([
    "Explain which acceptance criterion appears to be violated.",
    "Classify failures as functional, contract, environment, data, auth, or flaky execution issues.",
    "Recommend specific manual QA verification steps.",
    "Generate defect draft text without automatically creating defects in the MVP.",
  ]);

  addSubheading("10. QA Review Dashboard");
  addParagraph(
    "Provides a human review layer so QA can approve, reject, edit, rerun, or export generated scenarios and results."
  );
  addBullets([
    "Ticket-wise run summary, generated scenarios, request/response evidence, pass/fail trend, and AI reasoning.",
    "Manual QA verdict with comments.",
    "Exportable PDF/HTML/JSON report and Jira publishing action.",
    "Optional integrations with Xray, Zephyr, TestRail, Slack, Teams, or CI/CD.",
  ]);

  addHeading("End-to-End Flow");
  addNumbered([
    "QA selects a Jira ticket, sprint, or JQL query.",
    "The tool fetches ticket details and linked context from Jira.",
    "The requirement parser extracts structured business rules and missing information.",
    "The API mapper finds relevant endpoints from OpenAPI, Swagger, Postman, or indexed API docs.",
    "The AI generator creates structured and traceable test scenarios.",
    "QA optionally reviews and approves generated scenarios before execution.",
    "The payload engine creates valid and mutated request bodies for each scenario.",
    "The execution engine runs APIs in the selected non-production environment.",
    "Validators check status, schema, body, business assertions, and system state.",
    "The result analyzer summarizes failures and recommends QA follow-up.",
    "The dashboard shows the final report and can publish it back to Jira.",
  ]);

  addHeading("Recommended Technology Stack");
  addKeyValue("Backend", "Python with FastAPI, Celery or RQ workers, PostgreSQL, Redis, httpx, Pydantic, jsonschema, and OpenAPI parsing libraries.");
  addKeyValue("AI Layer", "LLM-based requirement parsing, scenario generation, result explanation, structured JSON outputs, RAG over API docs and historical tests, and prompt/version governance.");
  addKeyValue("Knowledge Store", "PostgreSQL plus pgvector or another vector database for API docs, sample payloads, historical scenarios, and defect patterns.");
  addKeyValue("Frontend", "React or Next.js dashboard for ticket selection, scenario review, execution monitoring, evidence inspection, and report export.");
  addKeyValue("Integrations", "Jira REST API, OpenAPI/Swagger, Postman collections, CI/CD, Slack or Teams, and optional test management tools such as Xray, Zephyr, or TestRail.");

  addHeading("Suggested Project Structure");
  addCodeBlock([
    "ai-api-validation-tool/",
    "  backend/",
    "    app/",
    "      integrations/            # Jira, Postman, OpenAPI, test-management clients",
    "      requirements/            # Requirement parser, models, prompt templates",
    "      knowledge_base/           # Indexing, retrieval, embeddings",
    "      test_generation/          # Scenario generation and coverage classification",
    "      payload_engine/           # Base payloads, mutations, generated data",
    "      execution/                # Runner, HTTP client, auth, environments, chains",
    "      validation/               # Status, schema, assertion, business validators",
    "      analysis/                 # Result analyzer, defect suggester, QA summary",
    "      reports/                  # PDF/HTML/JSON reports and Jira publishing",
    "      db/                       # Models, migrations, repositories",
    "      workers/                  # Async job definitions",
    "      config/                   # Settings and environment configs",
    "    tests/",
    "      unit/",
    "      integration/",
    "      contract/",
    "  frontend/",
    "    src/",
    "      views/",
    "        TicketView.tsx",
    "        ScenarioReview.tsx",
    "        ExecutionReport.tsx",
    "  docs/",
    "  openapi-specs/",
    "  postman-collections/",
    "  sample-payloads/",
    "  docker-compose.yml",
    "  README.md",
  ]);

  addHeading("MVP Scope");
  addBullets([
    "Fetch Jira ticket details and acceptance criteria.",
    "Import OpenAPI or Postman definitions.",
    "Generate structured AI test scenarios with traceability to Jira AC.",
    "Review scenarios before execution.",
    "Mutate payloads for positive, negative, and boundary cases.",
    "Execute APIs against a selected non-production environment.",
    "Validate status code, schema, required fields, and configured assertions.",
    "Generate PDF/HTML/JSON reports and publish summary back to Jira.",
  ]);
  addParagraph(
    "Do not start with fully autonomous defect creation. In the MVP, generate a defect draft and let QA review it before creating or linking bugs."
  );

  addHeading("Important Guardrails");
  addBullets([
    "Do not execute generated tests against production by default.",
    "Require environment-level permissions and explicit execution approval.",
    "Use deterministic validators for pass/fail decisions wherever possible.",
    "Keep generated tests editable and auditable before execution.",
    "Store request/response evidence and mask secrets, tokens, PII, and payment data.",
    "Version prompts, contracts, scenarios, and execution results.",
    "Track which Jira acceptance criterion produced each test case.",
    "Classify uncertain results as needs manual review instead of forcing pass/fail.",
  ]);

  addHeading("Example QA Output");
  addCodeBlock([
    "Ticket: PAY-1234",
    "Generated Scenarios: 18",
    "Executed: 18",
    "Passed: 14",
    "Failed: 3",
    "Blocked: 1",
    "",
    "Failures:",
    "1. Refund amount greater than captured amount returned 201 instead of 400.",
    "2. Missing reason field returned 500 instead of 400.",
    "3. Duplicate refund request created two refunds instead of one.",
    "",
    "QA Recommendation:",
    "Manual verification required for failed scenarios. Failures appear related to refund validation and idempotency handling.",
  ]);

  addHeading("Delivery Roadmap");
  addSubheading("Phase 1 - Foundation");
  addBullets([
    "Build Jira fetch, OpenAPI/Postman import, environment config, and basic scenario generation.",
    "Create report storage and a simple execution history model.",
  ]);
  addSubheading("Phase 2 - Execution");
  addBullets([
    "Implement payload mutation, API execution, auth management, and deterministic validation.",
    "Add request/response evidence and rerun support.",
  ]);
  addSubheading("Phase 3 - QA Workflow");
  addBullets([
    "Build scenario review, result dashboard, export, Jira publishing, and manual QA verdict.",
    "Add defect draft generation and integration with test management tools.",
  ]);
  addSubheading("Phase 4 - Intelligence and Scale");
  addBullets([
    "Add RAG over API docs and historical tests, regression impact analysis, and CI/CD integration.",
    "Improve confidence scoring, flaky test classification, and cross-ticket learning.",
  ]);
}

ensureDir(outDir);
renderDocument();
addFooterNumbers();
fs.writeFileSync(outFile, buildPdf(), "binary");
console.log(outFile);
