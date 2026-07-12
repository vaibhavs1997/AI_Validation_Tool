# AI API Validation Tool MVP

This is a runnable local MVP for an AI-assisted API validation product.

It can:

- Fetch Jira tickets using Jira REST API credentials.
- Load sample/manual Jira ticket content when credentials are not configured.
- Accept pasted or uploaded Jira descriptions as plain text or JSON.
- Parse OpenAPI/Swagger JSON and exported Postman collection JSON.
- Generate traceable API test scenarios from ticket description and acceptance criteria.
- Mutate payloads for positive, negative, boundary, auth, and business-rule scenarios.
- Execute APIs against a selected environment.
- Validate status code and basic response schema.
- Generate JSON and HTML reports for QA review.
- Store every run in local history, grouped by ticket, with result summaries and report links.

## Run Locally

```powershell
Copy-Item .env.example .env
npm run dev
```

Then open:

```text
http://localhost:4173
```

The app runs without installing packages. It uses only built-in Node.js APIs.

## Configure Jira

Edit `.env`:

```text
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_jira_api_token
```

Restart the server and fetch a ticket by key, for example `PAY-1234`.

## Optional AI Enhancement

The MVP has deterministic local scenario generation. You can optionally enable an OpenAI-compatible endpoint:

```text
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

In the UI, enable `Use AI enhancement`. If the AI call fails, the app keeps the local generated scenarios.

## MVP Workflow

1. Fetch a Jira ticket or load the sample ticket.
2. Paste or upload a Jira description as plain text or JSON.
3. Load, paste, or upload an OpenAPI/Swagger file or full Postman collection.
4. Generate scenarios.
5. Review/select scenarios.
6. Execute in dry-run mode or against a real base URL.
7. Review the latest result and the persistent Run History.
8. Open old runs later by ticket, run id, environment, status, JSON evidence, or HTML report.

## Run History

Every execution is saved locally:

```text
data/runs/
data/reports/
```

The dashboard shows:

- How many times each ticket was run.
- Latest run per ticket.
- Passed, failed, blocked, review, and dry-run counts.
- Search and status filtering.
- Links to reopen JSON evidence and HTML reports.

The left sidebar switches between separate dashboard views:

- Workspace: Jira, contract import, scenario generation, and execution setup.
- Run History: searchable history grouped by ticket.
- Results: latest or selected historical run evidence.

## Safety Notes

- Dry run is enabled by default.
- Do not point this MVP at production unless your organization explicitly approves it.
- Secrets are not printed in reports; authorization headers are masked.
- Generated tests are meant for QA review, not blind defect creation.

## Project Structure

```text
src/
  config.js
  server.js
  storage.js
  integrations/
    jiraClient.js
    llmClient.js
  contracts/
    contractParser.js
  scenarios/
    scenarioGenerator.js
  payload/
    mutationEngine.js
  execution/
    executionEngine.js
  validation/
    validators.js
  reporting/
    reportGenerator.js
public/
  index.html
  styles.css
  app.js
sample-data/
  jira-ticket.json
  openapi-refund.json
```
