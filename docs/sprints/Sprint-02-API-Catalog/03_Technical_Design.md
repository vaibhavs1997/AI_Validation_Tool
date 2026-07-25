# Sprint 02 – API Catalog Technical Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Frontend (React + TypeScript)                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │ Import Dialog│  │ Catalog View │  │ Search/Filter│                 │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                 │
│         │                  │                  │                        │
│         └──────────────────┼──────────────────┘                        │
│                            │                                           │
│                    ┌───────▼────────┐                                  │
│                    │  Catalog Hook  │                                  │
│                    │  (useCatalog)  │                                  │
│                    └───────┬────────┘                                  │
└──────────────────────────────│──────────────────────────────────────────┘
                               │
                     REST API Calls
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│  Backend (Node.js + Express + TypeScript)                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  API Routes (catalog.ts)                                         │  │
│  │    POST /api/projects/:id/catalog/import                          │  │
│  │    GET  /api/projects/:id/catalog                                 │  │
│  │    GET  /api/projects/:id/catalog/services                       │  │
│  │    GET  /api/projects/:id/catalog/services/:serviceId/operations  │  │
│  │    POST /api/projects/:id/catalog/health-check                    │  │
│  │    POST /api/projects/:id/catalog/versions                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                            │                                           │
│         ┌──────────────────┼──────────────────┐                        │
│         │                  │                  │                        │
│  ┌──────▼──────┐   ┌───────▼───────┐   ┌──────▼──────┐                 │
│  │ Import Svc  │   │ Parse Engine  │   │ Search Svc  │                 │
│  │ (file/url)  │   │ (OpenAPI)     │   │ (FTS/Filter)│                 │
│  └──────┬──────┘   └───────┬───────┘   └──────┬──────┘                 │
│         │                  │                  │                        │
│         └──────────────────┼──────────────────┘                        │
│                            │                                           │
│                    ┌───────▼────────┐                                  │
│                    │ Catalog Repo   │                                  │
│                    │ (Postgres)     │                                  │
│                    └────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Frontend Architecture

### 1.1 Directory Structure

```
src/features/api-catalog/
├── components/
│   ├── ApiCatalog.tsx              # Main catalog view
│   ├── ImportDialog.tsx            # Import modal
│   ├── ImportDropzone.tsx          # File drag/drop
│   ├── ValidationResult.tsx        # Parse result display
│   ├── ServiceGroup.tsx            # Collapsible service
│   ├── OperationRow.tsx            # Single operation
│   ├── OperationDrawer.tsx         # Right-side detail panel
│   ├── SearchBar.tsx               # Search input
│   ├── FilterBar.tsx               # Filter chips
│   ├── HealthSummary.tsx           # Service health cards
│   └── EmptyStates/
│       ├── NoCatalog.tsx
│       ├── NoResults.tsx
│       └── AllFiltered.tsx
├── hooks/
│   ├── useCatalog.ts               # Main catalog state
│   ├── useCatalogSearch.ts         # Search/filter logic
│   ├── useHealthCheck.ts           # Health check orchestration
│   └── useImport.ts                # Import state machine
├── services/
│   └── CatalogService.ts           # API client
├── types/
│   ├── catalog.ts                  # Core entities
│   ├── import.ts                   # Import types
│   └── health.ts                   # Health types
├── utils/
│   ├── parsers/
│   │   ├── openapi.ts
│   │   ├── swagger.ts
│   │   ├── postman.ts
│   │   └── har.ts
│   ├── validators/
│   │   └── specValidator.ts
│   └── formatters/
│       ├── methodColors.ts
│       └── healthStatus.ts
├── styles/
│   └── api-catalog.css
└── __tests__/
    ├── ApiCatalog.test.tsx
    ├── ImportDialog.test.tsx
    ├── useCatalog.test.ts
    └── parsers/
        ├── openapi.test.ts
        ├── postman.test.ts
        └── har.test.ts
```

### 1.2 State Management

**Primary State (from backend):**

```typescript
interface CatalogState {
  services: Service[];
  totalOperations: number;
  totalServices: number;
  loading: boolean;
  error: string | null;
  lastImportedAt: Date | null;
  currentVersion: CatalogVersion | null;
}

interface CatalogActions {
  importCatalog: (file: File) => Promise<void>;
  importFromUrl: (url: string) => Promise<void>;
  importFromPaste: (content: string, format: SpecFormat) => Promise<void>;
  refreshCatalog: () => Promise<void>;
  searchOperations: (query: string) => Promise<Operation[]>;
  filterOperations: (filters: FilterState) => Promise<Operation[]>;
  runHealthCheck: (serviceId?: string) => Promise<HealthResult[]>;
  toggleService: (serviceId: string) => void;
  selectOperation: (operation: Operation) => void;
}
```

**Derived State:**

```typescript
// Filtered operations based on search/filter
const filteredOperations = useMemo(() => {
  return services.flatMap(s => s.operations).filter(op => matches(op));
}, [services, searchQuery, filters]);

// Health summary
const healthSummary = useMemo(() => {
  return {
    total: operations.length,
    healthy: operations.filter(o => o.health === 'healthy').length,
    degraded: operations.filter(o => o.health === 'degraded').length,
    failing: operations.filter(o => o.health === 'failing').length,
  };
}, [operations]);
```

### 1.3 Component Data Flow

```
ImportDialog
  ├── onFileSelect → useImport.importFile(file)
  ├── onUrlFetch → useImport.importUrl(url)
  └── onPaste → useImport.importPaste(content, format)
        │
        ▼
  useImport (state machine)
    ├── idle → parsing → valid → imported
    ├── error → shows ValidationResult
    └── success → calls CatalogService.import()
        │
        ▼
  CatalogService
    ├── POST /api/projects/:id/catalog/import
    └── On success → emits 'catalogUpdated' event
        │
        ▼
  ApiCatalog (listens to event)
    └── Refreshes service list
        │
        ▼
  User Interaction
    ├── SearchBar → useCatalogSearch (debounced)
    ├── FilterBar → useCatalogSearch (filters)
    ├── ServiceGroup → toggleService (local state)
    └── OperationRow → openOperation(drawer)
```

### 1.4 Hooks

#### useCatalog

**Purpose:** Fetch and cache catalog data.

```typescript
function useCatalog(projectId: string) {
  const [state, setState] = useState<CatalogState>({
    services: [],
    totalOperations: 0,
    totalServices: 0,
    loading: false,
    error: null,
    lastImportedAt: null,
    currentVersion: null,
  });

  // Fetch catalog on mount and project change
  useEffect(() => {
    if (!projectId) return;
    setState(prev => ({ ...prev, loading: true }));
    CatalogService.getCatalog(projectId)
      .then(data => setState(prev => ({ ...prev, ...data, loading: false })))
      .catch(err => setState(prev => ({ ...prev, error: err.message, loading: false })));
  }, [projectId]);

  return state;
}
```

#### useImport

**Purpose:** Manage import flow state machine.

```typescript
type ImportState = 
  | { status: 'idle' }
  | { status: 'parsing'; file?: File }
  | { status: 'validating'; content: string }
  | { status: 'success'; result: ParseResult }
  | { status: 'error'; errors: ParseError[] };

function useImport(projectId: string) {
  const [state, setState] = useState<ImportState>({ status: 'idle' });

  const importFile = async (file: File) => {
    setState({ status: 'parsing', file });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    try {
      const result = await CatalogService.importFile(formData);
      setState({ status: 'success', result });
    } catch (err) {
      setState({ status: 'error', errors: err.errors });
    }
  };

  const confirmImport = async () => {
    if (state.status !== 'success') return;
    await CatalogService.confirmImport(projectId, state.result);
    // Trigger catalog refresh
  };

  return { state, importFile, importFromUrl, importFromPaste, confirmImport, reset };
}
```

#### useCatalogSearch

**Purpose:** Debounced search and filter.

```typescript
function useCatalogSearch(services: Service[]) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    methods: [],
    services: [],
    health: [],
  });
  const [results, setResults] = useState<Operation[]>([]);
  const [searching, setSearching] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const ops = await CatalogService.search(projectId, query);
      setResults(ops);
      setSearching(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, projectId]);

  // Filter logic (runs on filters change)
  useEffect(() => {
    const filtered = services.flatMap(s => s.operations).filter(op => {
      if (filters.methods.length && !filters.methods.includes(op.method)) return false;
      if (filters.services.length && !filters.services.includes(op.serviceId)) return false;
      if (filters.health.length && !filters.health.includes(op.health)) return false;
      return true;
    });
    setFilteredResults(filtered);
  }, [filters, services]);

  return { query, setQuery, filters, setFilters, results, searching };
}
```

### 1.5 Parsing Strategy

#### Format Detection

```typescript
type SpecFormat = 'openapi' | 'swagger' | 'postman' | 'har';

function detectFormat(content: string, filename?: string): SpecFormat {
  // Try JSON parse
  let json: any;
  try {
    json = JSON.parse(content);
  } catch {
    json = {};
  }

  // Detection logic
  if (json.openapi?.startsWith('3.')) return 'openapi';
  if (json.swagger === '2.0') return 'swagger';
  if (json['schema']?.startsWith('http://postman.com/')) return 'postman';
  if (json.log?.entries) return 'har';
  
  // Fallback to filename
  if (filename?.endsWith('.yaml') || filename?.endsWith('.yml')) {
    // Could be OpenAPI or Swagger; need content inspection
    if (content.includes('openapi:')) return 'openapi';
    if (content.includes('swagger:')) return 'swagger';
  }

  throw new Error('Unsupported format');
}
```

#### Parser Selection

```typescript
interface Parser {
  parse(content: string): ParseResult;
}

class OpenAPIParser implements Parser {
  parse(content: string): ParseResult {
    const spec = yaml.load(content) as OpenAPISpec;
    const services = this.extractServices(spec);
    // ... parse operations, parameters, schemas
    return { services, errors, warnings };
  }

  private extractServices(spec: OpenAPISpec): Service[] {
    // Group by tag or info
  }
}

class PostmanParser implements Parser {
  parse(content: string): ParseResult {
    const collection = JSON.parse(content) as PostmanCollection;
    // Convert to internal model
  }
}

class HarParser implements Parser {
  parse(content: string): ParseResult {
    const har = JSON.parse(content) as HAR;
    // Extract requests as operations
  }
}
```

### 1.6 Validation Rules

```typescript
interface ValidationError {
  code: string;
  message: string;
  line?: number;
  severity: 'error' | 'warning';
  suggestion?: string;
}

class SpecValidator {
  validate(spec: any, format: SpecFormat): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Common checks
    if (!spec.info?.title) {
      errors.push({
        code: 'MISSING_TITLE',
        message: 'Missing required field: info.title',
        line: this.findLine('info', 'title'),
        severity: 'error',
        suggestion: 'Add: "title": "My API"',
      });
    }

    // Format-specific checks
    if (format === 'openapi' || format === 'swagger') {
      this.validatePaths(spec.paths, errors);
      this.validateSchemas(spec.components?.schemas, errors);
      this.detectCircularRefs(spec, errors);
    }

    return { valid: errors.filter(e => e.severity === 'error').length === 0, errors };
  }
}
```

---

## 2. Backend Architecture

### 2.1 Data Model

```typescript
// entities/Catalog.ts
interface CatalogVersion {
  id: string;
  projectId: string;
  version: string;
  format: SpecFormat;
  importedAt: Date;
  importedBy: string;
  spec: RawSpec; // Original spec content
  services: Service[];
}

interface Service {
  id: string;
  versionId: string;
  name: string;
  description?: string;
  baseUrl?: string;
  version?: string;
  health: HealthStatus;
  healthLastChecked?: Date;
  operationCount: number;
}

interface Operation {
  id: string;
  serviceId: string;
  path: string;
  method: HttpMethod;
  summary?: string;
  description?: string;
  deprecated: boolean;
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Response[];
}

interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  type: string;
  required: boolean;
  default?: any;
  description?: string;
}

interface RequestBody {
  contentType: string;
  schema: Schema;
  required: boolean;
}

interface Response {
  statusCode: number;
  description: string;
  schema?: Schema;
}

interface Schema {
  type: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  items?: Schema;
  allOf?: Schema[];
  oneOf?: Schema[];
}

interface SchemaProperty {
  type: string;
  description?: string;
  enum?: any[];
  format?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'failing' | 'unknown';
  responseTime?: number;
  lastChecked?: Date;
  error?: string;
}
```

### 2.2 API Routes

```typescript
// routes/catalog.ts
import { Router } from 'express';
import { CatalogService } from '../services/CatalogService';

const router = Router();

// Import catalog
router.post('/projects/:projectId/catalog/import', async (req, res) => {
  const { projectId } = req.params;
  const file = req.file; // from multer
  
  try {
    const result = await CatalogService.import(projectId, file);
    res.json(result);
  } catch (err) {
    res.status(400).json({ errors: err.errors });
  }
});

// Get catalog
router.get('/projects/:projectId/catalog', async (req, res) => {
  const { projectId } = req.params;
  const catalog = await CatalogService.getCatalog(projectId);
  res.json(catalog);
});

// Search operations
router.get('/projects/:projectId/catalog/operations/search', async (req, res) => {
  const { projectId } = req.params;
  const { q, methods, services, health } = req.query;
  
  const results = await CatalogService.search(projectId, {
    query: q as string,
    filters: { methods, services, health },
  });
  
  res.json(results);
});

// Health check
router.post('/projects/:projectId/catalog/health-check', async (req, res) => {
  const { projectId } = req.params;
  const { serviceId } = req.body;
  
  const results = await CatalogService.runHealthCheck(projectId, serviceId);
  res.json(results);
});

export default router;
```

### 2.3 Service Layer

```typescript
// services/CatalogService.ts
export class CatalogService {
  // Import with file upload
  async import(projectId: string, file: ExpressFile): Promise<ImportResult> {
    // 1. Read file content
    const content = await fs.readFile(file.path, 'utf-8');
    
    // 2. Detect format
    const format = detectFormat(content, file.originalname);
    
    // 3. Validate
    const validator = new SpecValidator();
    const validation = validator.validate(content, format);
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }
    
    // 4. Parse
    const parser = this.getParser(format);
    const parseResult = parser.parse(content);
    
    // 5. Normalize
    const services = this.normalizeServices(parseResult);
    
    // 6. Store
    const version = await this.storeCatalog(projectId, {
      format,
      spec: content,
      services,
    });
    
    // 7. Trigger background health check (optional)
    if (services.length > 0) {
      this.queueHealthCheck(projectId, version.id);
    }
    
    return { version, services, warnings: validation.warnings };
  }

  // Get catalog
  async getCatalog(projectId: string): Promise<Catalog> {
    const version = await this.getLatestVersion(projectId);
    if (!version) return { services: [], version: null };
    
    // Attach health status
    const servicesWithHealth = await Promise.all(
      version.services.map(svc => this.attachHealth(projectId, svc))
    );
    
    return {
      services: servicesWithHealth,
      version,
    };
  }

  // Search operations
  async search(projectId: string, query: SearchQuery): Promise<Operation[]> {
    const version = await this.getLatestVersion(projectId);
    if (!version) return [];
    
    // Use Postgres FTS or in-memory filter
    return this.searchOperations(version.id, query);
  }

  // Health check
  async runHealthCheck(projectId: string, serviceId?: string): Promise<HealthResult[]> {
    const version = await this.getLatestVersion(projectId);
    if (!version) return [];
    
    const services = serviceId 
      ? version.services.filter(s => s.id === serviceId)
      : version.services;
    
    const results: HealthResult[] = [];
    
    // Check each service's endpoints (sample)
    for (const service of services) {
      // Check base URL or first few operations
      const checks = await Promise.all(
        service.operations.slice(0, 5).map(op => this.checkEndpoint(op))
      );
      
      // Aggregate service health
      const healthy = checks.filter(c => c.status === 'healthy').length;
      const health: HealthStatus = {
        status: healthy === checks.length ? 'healthy' : healthy > 0 ? 'degraded' : 'failing',
        lastChecked: new Date(),
      };
      
      // Update service health in DB
      await this.updateServiceHealth(service.id, health);
      results.push({ serviceId: service.id, health, checks });
    }
    
    return results;
  }

  private async checkEndpoint(operation: Operation): Promise<EndpointHealth> {
    // Implementation with axios/fetch
    const url = this.buildUrl(operation);
    const start = Date.now();
    
    try {
      const response = await axios({
        method: operation.method.toLowerCase(),
        url,
        timeout: 5000,
        validateStatus: () => true, // Accept any status
      });
      
      const responseTime = Date.now() - start;
      return {
        status: response.status < 400 ? (responseTime < 200 ? 'healthy' : 'degraded') : 'failing',
        responseTime,
        statusCode: response.status,
      };
    } catch (err) {
      return {
        status: 'failing',
        error: err.message,
      };
    }
  }
}
```

### 2.4 Database Schema

```sql
-- Catalog versions
CREATE TABLE catalog_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  version VARCHAR(50) NOT NULL,
  format VARCHAR(20) NOT NULL,
  spec JSONB NOT NULL,
  imported_at TIMESTAMP NOT NULL DEFAULT NOW(),
  imported_by UUID NOT NULL REFERENCES users(id)
);

-- Services
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES catalog_versions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  base_url TEXT,
  version VARCHAR(50),
  health_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
  health_last_checked TIMESTAMP,
  health_response_time INT,
  operation_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Operations
CREATE TABLE operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  method VARCHAR(10) NOT NULL,
  summary TEXT,
  description TEXT,
  deprecated BOOLEAN NOT NULL DEFAULT FALSE,
  parameters JSONB,
  request_body JSONB,
  responses JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for search
CREATE INDEX idx_operations_service_id ON operations(service_id);
CREATE INDEX idx_operations_method ON operations(method);
CREATE INDEX idx_operations_path ON operations USING gin(to_tsvector('english', path || ' ' || COALESCE(summary, '')));

-- Full-text search index
CREATE INDEX idx_operations_fts ON operations USING gin(
  to_tsvector('english', path || ' ' || COALESCE(summary, '') || ' ' || COALESCE(description, ''))
);
```

---

## 3. Parsing Implementation

### 3.1 OpenAPI Parser

```typescript
class OpenAPIParser {
  parse(content: string): ParseResult {
    const spec = yaml.load(content) as OpenAPISpec;
    const errors: ParseError[] = [];
    const services: Service[] = [];

    // Extract services (group by tag)
    const tags = spec.tags?.map(t => t.name) || [];
    const servicesMap = new Map<string, Service>();

    // Parse paths
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
          continue;
        }

        const op = operation as OperationObject;
        
        // Determine service (by tag or default)
        const serviceName = op.tags?.[0] || 'Default';
        if (!servicesMap.has(serviceName)) {
          servicesMap.set(serviceName, {
            id: generateId(),
            name: serviceName,
            description: spec.tags?.find(t => t.name === serviceName)?.description,
            baseUrl: this.extractBaseUrl(spec.servers || []),
            version: spec.info?.version,
            operations: [],
          });
        }

        // Parse operation
        const service = servicesMap.get(serviceName)!;
        service.operations.push({
          id: generateId(),
          serviceId: service.id,
          path: this.normalizePath(path),
          method: method.toUpperCase(),
          summary: op.summary || '',
          description: op.description || '',
          deprecated: op.deprecated || false,
          parameters: this.parseParameters(pathItem.parameters || [], op.parameters || []),
          requestBody: op.requestBody ? this.parseRequestBody(op.requestBody) : undefined,
          responses: this.parseResponses(op.responses),
        });
      }
    }

    // Resolve schemas
    const schemaResolver = new SchemaResolver(spec.components?.schemas || {});
    for (const service of servicesMap.values()) {
      for (const op of service.operations) {
        for (const param of op.parameters) {
          param.schema = schemaResolver.resolve(param.schema);
        }
        if (op.requestBody) {
          op.requestBody.schema = schemaResolver.resolve(op.requestBody.schema);
        }
        for (const resp of op.responses) {
          resp.schema = schemaResolver.resolve(resp.schema);
        }
      }
    }

    return {
      services: Array.from(servicesMap.values()),
      errors,
      warnings: [],
    };
  }

  private normalizePath(path: string): string {
    // Convert /users/{id} to /users/{id}
    return path.replace(/\{([^}]+)\}/g, '{$1}');
  }

  private parseParameters(...): Parameter[] {
    // Implementation
  }

  private parseRequestBody(requestBody: RequestBodyObject): RequestBody {
    // Implementation
  }

  private parseResponses(responses: ResponsesObject): Response[] {
    // Implementation
  }
}
```

### 3.2 Schema Resolver

```typescript
class SchemaResolver {
  private schemas: Map<string, JsonSchema>;
  private resolving: Set<string> = new Set();

  constructor(schemas: Record<string, JsonSchema>) {
    this.schemas = new Map(Object.entries(schemas));
  }

  resolve(ref: string | JsonSchema): JsonSchema {
    if (typeof ref !== 'string') return ref;
    
    const match = ref.match(/^#\/components\/schemas\/(.+)$/);
    if (!match) return { type: 'string' };

    const schemaName = match[1];
    if (this.resolving.has(schemaName)) {
      return { type: 'string' }; // Circular ref fallback
    }

    this.resolving.add(schemaName);
    const schema = this.schemas.get(schemaName);
    if (!schema) return { type: 'string' };

    // Deep clone and resolve nested refs
    const resolved = this.deepResolve(schema);
    this.resolving.delete(schemaName);
    
    return resolved;
  }

  private deepResolve(schema: JsonSchema): JsonSchema {
    if (schema.$ref) {
      return this.resolve(schema.$ref);
    }
    if (schema.allOf) {
      return this.flattenAllOf(schema.allOf);
    }
    if (schema.oneOf || schema.anyOf) {
      return {
        ...schema,
        oneOf: schema.oneOf?.map(s => this.deepResolve(s)),
      };
    }
    if (schema.properties) {
      return {
        ...schema,
        properties: Object.fromEntries(
          Object.entries(schema.properties).map(([k, v]) => [k, this.deepResolve(v)])
        ),
      };
    }
    return schema;
  }

  private flattenAllOf(schemas: JsonSchema[]): JsonSchema {
    const merged: JsonSchema = { type: 'object', properties: {} };
    for (const schema of schemas) {
      const resolved = this.deepResolve(schema);
      if (resolved.type) merged.type = resolved.type;
      if (resolved.properties) {
        merged.properties = { ...merged.properties, ...resolved.properties };
      }
      if (resolved.required) {
        merged.required = [...(merged.required || []), ...resolved.required];
      }
    }
    return merged;
  }
}
```

### 3.3 Postman Parser

```typescript
class PostmanParser {
  parse(content: string): ParseResult {
    const collection = JSON.parse(content) as PostmanCollection;
    const servicesMap = new Map<string, Service>();

    // Recursively process items
    const processItems = (items: PostmanItem[], folder?: string) => {
      for (const item of items) {
        if (item.request) {
          const serviceName = folder || 'Default';
          if (!servicesMap.has(serviceName)) {
            servicesMap.set(serviceName, {
              id: generateId(),
              name: serviceName,
              description: item.description,
              baseUrl: this.extractBaseUrl(item.request.url),
              version: collection.info?.schema?.includes('v2.1') ? '2.1' : undefined,
              operations: [],
            });
          }

          const service = servicesMap.get(serviceName)!;
          service.operations.push({
            id: generateId(),
            serviceId: service.id,
            path: this.extractPath(item.request.url),
            method: item.request.method.toUpperCase(),
            summary: item.name,
            description: item.description,
            deprecated: false,
            parameters: this.parseParameters(item.request),
            requestBody: item.request.body ? this.parseBody(item.request.body) : undefined,
            responses: [], // Postman doesn't have response schemas
          });
        } else if (item.items) {
          processItems(item.items, item.name);
        }
      }
    };

    processItems(collection.item);
    
    return { services: Array.from(servicesMap.values()), errors: [], warnings: [] };
  }
}
```

### 3.4 HAR Parser

```typescript
class HarParser {
  parse(content: string): ParseResult {
    const har = JSON.parse(content) as HAR;
    const servicesMap = new Map<string, Service>();

    for (const entry of har.log.entries) {
      const url = new URL(entry.request.url);
      const serviceName = url.hostname;
      
      if (!servicesMap.has(serviceName)) {
        servicesMap.set(serviceName, {
          id: generateId(),
          name: serviceName,
          description: `Imported from HAR`,
          baseUrl: `${url.protocol}//${url.hostname}`,
          operations: [],
        });
      }

      const service = servicesMap.get(serviceName)!;
      service.operations.push({
        id: generateId(),
        serviceId: service.id,
        path: url.pathname + url.search,
        method: entry.request.method.toUpperCase(),
        summary: entry.request.url,
        description: '',
        deprecated: false,
        parameters: this.parseHarParams(entry.request),
        responses: [],
      });
    }

    return { services: Array.from(servicesMap.values()), errors: [], warnings: [] };
  }
}
```

---

## 4. Search Implementation

### 4.1 Postgres Full-Text Search

```sql
-- Trigger function to keep search vector updated
CREATE OR REPLACE FUNCTION operations_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    to_tsvector('english', COALESCE(NEW.path, '') || ' ' || COALESCE(NEW.summary, '') || ' ' || COALESCE(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER operations_search_vector_trigger
  BEFORE INSERT OR UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION operations_search_vector_update();
```

### 4.2 Search Service

```typescript
class SearchService {
  async search(projectId: string, query: string, filters: FilterState): Promise<Operation[]> {
    const version = await this.getLatestVersion(projectId);
    if (!version) return [];

    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    // Base query
    let sql = `
      SELECT o.*, s.name as service_name
      FROM operations o
      JOIN services s ON o.service_id = s.id
      WHERE s.version_id = $1
    `;
    params.push(version.id);

    // Full-text search
    if (query) {
      paramCount++;
      sql += ` AND to_tsvector('english', o.path || ' ' || COALESCE(o.summary, '') || ' ' || COALESCE(o.description, '')) @@ plainto_tsquery('english', $${paramCount})`;
      params.push(query);
    }

    // Method filter
    if (filters.methods?.length) {
      paramCount++;
      sql += ` AND o.method = ANY($${paramCount}::text[])`;
      params.push(filters.methods);
    }

    // Service filter
    if (filters.services?.length) {
      paramCount++;
      sql += ` AND s.id = ANY($${paramCount}::uuid[])`;
      params.push(filters.services);
    }

    // Health filter
    if (filters.health?.length) {
      paramCount++;
      sql += ` AND s.health_status = ANY($${paramCount}::text[])`;
      params.push(filters.health);
    }

    sql += ' ORDER BY o.created_at DESC LIMIT 100';

    const result = await db.query(sql, params);
    return result.rows;
  }
}
```

---

## 5. Health Check Implementation

### 5.1 Health Check Service

```typescript
class HealthCheckService {
  async checkEndpoint(operation: Operation): Promise<EndpointCheck> {
    const url = this.buildUrl(operation);
    const start = Date.now();

    try {
      const response = await axios({
        method: operation.method.toLowerCase(),
        url,
        timeout: 5000,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'TestForge-HealthCheck/1.0',
        },
      });

      const responseTime = Date.now() - start;
      
      let status: HealthStatusValue;
      if (response.status >= 400) {
        status = 'failing';
      } else if (responseTime > 500) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        operationId: operation.id,
        status,
        responseTime,
        statusCode: response.status,
        lastChecked: new Date(),
      };
    } catch (err) {
      return {
        operationId: operation.id,
        status: 'failing',
        error: err.message,
        lastChecked: new Date(),
      };
    }
  }

  async checkService(serviceId: string): Promise<ServiceHealth> {
    const operations = await this.getServiceOperations(serviceId);
    const checks = await Promise.all(
      operations.slice(0, 10).map(op => this.checkEndpoint(op))
    );

    const healthy = checks.filter(c => c.status === 'healthy').length;
    const avgResponseTime = checks.reduce((sum, c) => sum + (c.responseTime || 0), 0) / checks.length;

    return {
      status: healthy === checks.length ? 'healthy' : healthy > 0 ? 'degraded' : 'failing',
      checkedAt: new Date(),
      avgResponseTime,
      operationCount: operations.length,
      healthyCount: healthy,
    };
  }
}
```

---

## 6. Performance Optimizations

### 6.1 Frontend

- **Virtual scrolling** for operation lists >100 items
- **Debounced search** (150ms)
- **Memoized selectors** for filtered operations
- **Lazy loading** for operation details (drawer)
- **Cache API responses** in React Query (stale-while-revalidate)

### 6.2 Backend

- **Database indexes** on service_id, method, and search_vector
- **Connection pooling** (pg-pool)
- **Concurrent health checks** (p-limit, max 10)
- **Response compression** (gzip)
- **Pagination** for large catalogs (limit/offset)

### 6.3 Caching Strategy

```typescript
// Redis cache for catalog (5-minute TTL)
const catalogCache = {
  get: async (projectId: string) => redis.get(`catalog:${projectId}`),
  set: async (projectId: string, data: any) => redis.setex(`catalog:${projectId}`, 300, JSON.stringify(data)),
};

// Invalidation on import
await redis.del(`catalog:${projectId}`);
```

---

## 7. Error Handling

### 7.1 Frontend Error Boundaries

```typescript
class CatalogErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Catalog error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

### 7.2 API Error Standardization

```typescript
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
  }

  static fromResponse(response: AxiosResponse) {
    return new ApiError(
      response.status,
      response.data.code || 'UNKNOWN_ERROR',
      response.data.message,
      response.data.details
    );
  }
}
```

### 7.3 Parse Error Recovery

- Keep existing catalog on parse failure
- Allow partial import (skip failed services)
- Provide export of parse errors for debugging
- Support re-upload with same version detection

---

## 8. Testing Strategy

### 8.1 Unit Tests

- Parsers: OpenAPI, Swagger, Postman, HAR (sample files)
- Validators: All validation rules
- Formatters: Method colors, health status
- Hooks: useCatalog, useImport, useCatalogSearch

### 8.2 Integration Tests

- Import → Parse → Store → Retrieve flow
- Search and filter accuracy
- Health check orchestration

### 8.3 E2E Tests

- First import journey
- Failed import recovery
- Search and filter interactions
- Health check workflow

---

## 9. Security Considerations

- **File upload**: Validate MIME type, size limit (50MB), scan for malware (future)
- **URL fetch**: Restrict to HTTPS, validate domain against allowlist (configurable)
- **Secrets**: Strip Authorization headers from logs
- **Access control**: Catalog access restricted to project members
- **SQL injection**: Use parameterized queries
- **XSS**: Sanitize schema content before rendering

---

## 10. Monitoring

- Import success/failure rate
- Parse time (p95)
- Search latency (p95)
- Health check accuracy
- Error types and frequency
- Catalog size per project