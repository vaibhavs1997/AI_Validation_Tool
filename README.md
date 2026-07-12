# AI API Validation Tool

This repository contains a local MVP for an AI-assisted API validation workflow. It helps QA and API teams turn Jira tickets and API contracts into runnable validation scenarios, execute them against a target environment, and generate reviewable reports.

## What the project does

The tool can:

- Pull Jira ticket details from Jira REST API credentials or use bundled sample data.
- Accept Jira descriptions as plain text or JSON.
- Parse OpenAPI/Swagger and Postman collection files.
- Generate API test scenarios from the ticket and contract context.
- Mutate payloads for positive, negative, boundary, auth, and business-rule cases.
- Execute requests in dry-run or live mode.
- Validate response status codes and basic schema expectations.
- Create JSON and HTML reports for review and audit history.

## Main application

The runnable application is located in the project folder:

- [2026-07-04/i](2026-07-04/i)

It includes the server, UI, contract parsing logic, scenario generation, execution engine, validators, and reporting modules.

## Quick start

1. Open the app folder:
   ```bash
   cd 2026-07-04/i
   ```
2. Start the local server:
   ```bash
   npm run dev
   ```
3. Open the app in your browser:
   ```text
   http://localhost:4173
   ```

## Configuration

The app can use Jira credentials and optional AI enhancement settings through environment variables. Typical settings include:

```text
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_jira_api_token
```

Optional AI support:

```text
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

## Project structure

```text
2026-07-04/i/
  src/
    config.js
    server.js
    storage.js
    integrations/
    contracts/
    scenarios/
    payload/
    execution/
    validation/
    reporting/
  public/
  data/
  sample-data/
```

## Output and history

Each run is stored locally under the data folders, including:

- Run history and metadata
- JSON evidence files
- HTML reports
- Ticket-based grouping for comparison and review

## Notes

- Dry-run mode is enabled by default for safety.
- The generated results are intended for QA review and validation workflows.
- Secrets are masked in reports and should not be exposed in shared output.
