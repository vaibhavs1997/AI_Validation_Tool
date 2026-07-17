# AI API Validation Tool
## Production-Ready Edition

A modern AI-assisted API validation platform for QA and API teams.

### Core Features
- Jira ticket integration with automatic acceptance criteria extraction
- OpenAPI 3.x / Postman contract parsing with schema resolution
- **HAR file import support** - Convert browser recordings to test scenarios
- AI-powered test scenario generation (positive, negative, boundary, auth, edge cases)
- **Test prioritization** - Risk-based ordering (high → medium → low)
- Multiple authentication methods (Bearer, Basic, API Key, Auto-token)
- Dry-run and live execution modes
- **Performance testing** - Response time assertions
- **OpenAPI diff comparison** - Identify breaking changes between versions
- Comprehensive HTML/JSON reporting
- Run history with ticket-based grouping
- **Postman collection export** - For test interoperability

### ✅ Features Added for Production Demo
- Dark/Light theme toggle with system preference detection and localStorage persistence
- Postman collection export for test scenario interoperability  
- HAR file import for browser recording conversion
- OpenAPI diff comparison endpoint (`/api/contracts/diff`)
- Test prioritization by risk score
- Performance testing with response time tracking
- Docker production deployment with docker-compose.yml
- GitHub Actions CI/CD pipeline
- Average response time display in run results

### Quick Start
```bash
# Run locally
cd 2026-07-04/i
node src/server.js
# Open http://localhost:4173

# Or use Docker
docker-compose up -d
# Open http://localhost:4173

# Or double-click START_SERVER.BAT
```

### New API Endpoints
- `POST /api/contracts/diff` - Compare two contracts for breaking changes
  ```json
  { "oldContract": {...}, "newContract": {...} }
  ```

### Configuration
Copy `.env.example` to `.env` and configure your integrations. Supports both OpenAI and Groq AI providers.