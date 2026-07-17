# AI API Validation Tool - Technical Documentation

## Overview
A Node.js-based MVP that automates API validation by generating test scenarios from Jira tickets and API contracts.

## Architecture

### Backend Stack
- **Runtime:** Node.js 20+ 
- **Server:** Native HTTP module (no Express)
- **Storage:** File-based JSON storage in `data/` directory

### Core Modules

#### 1. Configuration (`src/config.js`)
Loads environment variables with `.env` support:
- `PORT` - Server port (default: 4173)
- `JIRA_*` - Jira API credentials
- `OPENAI_*` - AI provider configuration
- `REQUEST_TIMEOUT_MS` - Request timeout (default: 20000ms)

#### 2. Storage (`src/storage.js`)
Local JSON file storage with these buckets:
- `tickets/` - Jira ticket data
- `contracts/` - Parsed API contracts
- `runs/` - Test execution results
- `reports/` - HTML reports

#### 3. Contracts (`src/contracts/`)
- **contractParser.js** - Parses OpenAPI 3.x, Postman v2.1, and HAR files
- **openapiDiff.js** - Compares contract versions for breaking changes

Key functions:
- `parseContract()` - Auto-detects format and parses
- `parseOpenApi()` - OpenAPI/Swagger parser
- `parsePostman()` - Postman collection parser
- `parseHarLog()` - HAR file parser
- `compareContracts()` - Diff two contracts

#### 4. Scenarios (`src/scenarios/scenarioGenerator.js`)
Intelligently generates test scenarios:
- **Positive** - Happy path tests
- **Negative** - Invalid input, missing fields
- **Boundary** - Edge cases (min/max values)
- **Auth** - Security tests (401/403)
- **Edge Cases** - SQL injection, XSS attempts

Key functions:
- `createTestCasesFromTicket()` - Generates from acceptance criteria
- `scoreEndpointForTestCase()` - Matches tests to endpoints (0-20 score)
- `prioritizeScenarios()` - Sorts by risk score

#### 5. Payload Mutation (`src/payload/mutationEngine.js`)
Mutates payloads for negative testing:
- `remove` - Removes field
- `nullify` - Sets field to null
- `emptyString` - Sets field to ""
- `invalidType` - Sets wrong type value
- `boundaryMin/Max` - Boundary value testing
- `duplicate` - Duplicate idempotency key

#### 6. Execution (`src/execution/executionEngine.js`)
Executes API requests with:
- Parallel batched execution (5 at a time)
- Multiple auth methods (Bearer, Basic, Custom, Auto-token)
- Response time tracking
- Dry-run mode support

Key functions:
- `executeRun()` - Main execution orchestrator
- `executeScenario()` - Single request execution
- `acquireBearerToken()` - Auto token refresh

#### 7. Validation (`src/validation/validators.js`)
Validates responses:
- Status code validation
- Schema validation
- Response time assertions

#### 8. Reporting (`src/reporting/reportGenerator.js`)
Generates HTML reports with:
- Summary statistics
- Individual test results
- Evidence (request/response)
- Status badges (passed/failed/blocked)

## API Endpoints

### GET /api/health
Health check endpoint
```json
{ "ok": true, "app": "AI API Validation Tool MVP", "time": "..." }
```

### GET /api/config/status
Configuration status
```json
{ "jiraConfigured": bool, "aiConfigured": bool, "port": number }
```

### GET /api/runs
List all runs with summaries

### GET /api/runs/:id
Get specific run details

### DELETE /api/runs/:id
Delete a run

### POST /api/jira/ticket
Fetch Jira ticket by key
```json
{ "issueKey": "PAY-1234" }
```

### POST /api/jira/jql
Search Jira tickets
```json
{ "jql": "project = PAY", "maxResults": 10 }
```

### POST /api/contracts/parse
Parse API contract (OpenAPI/Postman/HAR)
```json
{ "contract": {...}, "name": "optional-name" }
```

### POST /api/contracts/diff
Compare two contracts for breaking changes
```json
{ "oldContract": {...}, "newContract": {...} }
```

### POST /api/scenarios/generate
Generate test scenarios
```json
{ "ticket": {...}, "contract": {...}, "useAi": bool }
```

### POST /api/runs/execute
Execute test scenarios
```json
{ 
  "ticket": {...}, 
  "contract": {...}, 
  "scenarios": [...], 
  "environment": {...} 
}
```

## Frontend (`public/`)

### index.html
Main application shell with:
- Sidebar navigation
- Metrics dashboard
- Workspace panels (ticket, contract, scenarios, execution)
- History and results views

### app.js
Vanilla JavaScript frontend:
- State management
- API communication
- Form handling
- Dark/light theme toggle
- Scenario table rendering
- Run results display

### styles.css
CSS with CSS variables for theming:
- Light/Dark mode support
- Responsive layout (mobile-friendly)
- Custom button styles

## Test Types Generated

| Type | Count | Purpose |
|------|-------|---------|
| Positive | 1 + N | Happy path for each AC |
| Negative | Variable | Invalid/missing data tests |
| Boundary | Variable | Min/max value tests |
| Auth | 2 | Missing/invalid token tests |
| Edge | 4 | SQL injection, XSS, empty body, unknown fields |

Where N = number of acceptance criteria

## Environment Variables (`.env`)
```env
PORT=4173
JIRA_BASE_URL=https://company.atlassian.net
JIRA_EMAIL=user@company.com
JIRA_API_TOKEN=api-token

OPENAI_API_KEY=your-key
OPENAI_MODEL=llama-3.3-70b-versatile
OPENAI_BASE_URL=https://api.groq.com/openai/v1

REQUEST_TIMEOUT_MS=30000
```

## Docker Deployment
```bash
docker-compose up -d
# Or custom build:
docker build -t ai-validator .
docker run -p 4173:4173 ai-validator
```

## Project Structure
```
2026-07-04/i/
├── public/           # Frontend
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── src/
│   ├── config.js
│   ├── server.js
│   ├── storage.js
│   ├── contracts/
│   ├── execution/
│   ├── integrations/
│   ├── payload/
│   ├── reporting/
│   ├── scenarios/
│   └── validation/
├── sample-data/        # Demo data
├── data/              # Generated data (created on first run)
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Error Handling
- Graceful fallback when AI is unavailable
- Detailed error messages in responses
- Blocked status for failed executions
- Needs review status for schema mismatches

## Security Features
- Secret masking in reports
- No credential logging
- Non-root Docker user
- Token auto-refresh capability