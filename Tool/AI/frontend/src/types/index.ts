/**
 * Shared TypeScript types for the MVP backend workflow.
 * Aligned with backend domain model response shapes.
 */

// ─── Project ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  id: string;
  name: string;
}

export interface ListProjectsResponse {
  projects: Project[];
}

export interface GetProjectResponse {
  project: Project;
}

// ─── Service Definition ─────────────────────────────────────────────────────

export interface ServiceDefinition {
  id: string;
  name: string;
  protocol: string;
  description: string;
  projectId?: string;
}

export interface ListServicesResponse {
  services: ServiceDefinition[];
}

export interface GetServiceResponse {
  service: ServiceDefinition;
  apiModel: ApiModel | null;
}

// ─── API Operation ──────────────────────────────────────────────────────────

export interface ApiOperation {
  id: string;
  protocol: string;
  method: string;
  path: string;
  summary: string;
  description: string;
}

// ─── API Model ──────────────────────────────────────────────────────────────

export interface ApiModel {
  service: {
    id: string;
    name: string;
    protocol: string;
    description?: string;
  };
  sourceType: string;
  title: string;
  baseUrl: string;
  operations: ApiOperation[];
  projectId?: string;
  serviceId?: string;
}

// ─── Knowledge Relationship ─────────────────────────────────────────────────

export interface RelationshipSourceTarget {
  serviceId: string;
  operationId: string;
  location: string;
}

export interface KnowledgeRelationship {
  id: string;
  type: string;
  source: RelationshipSourceTarget;
  target: RelationshipSourceTarget;
  transform: string;
  status: "proposed" | "confirmed" | "rejected";
  confidence: number;
  evidence: string;
}

// ─── Project Knowledge ──────────────────────────────────────────────────────

export interface ProjectKnowledge {
  projectId: string;
  instructions: string;
  relationships: KnowledgeRelationship[];
  createdAt: string;
  updatedAt: string;
}

export interface GetKnowledgeResponse {
  knowledge: ProjectKnowledge;
}

export interface ListRelationshipsResponse {
  relationships: KnowledgeRelationship[];
}

// ─── Service Registration ───────────────────────────────────────────────────

export interface RegisterServiceRequest {
  projectId?: string;
  contract: unknown;
  serviceId?: string;
}

export interface RegisterServiceResponse {
  service: ServiceDefinition;
  apiModel: ApiModel;
}

// ─── Knowledge Instructions ─────────────────────────────────────────────────

export interface UpdateInstructionsRequest {
  projectId?: string;
  instructions: string;
}

export interface UpdateInstructionsResponse {
  knowledge: ProjectKnowledge;
}

// ─── Confirm/Reject Relationship ────────────────────────────────────────────

export interface ConfirmRejectRequest {
  projectId?: string;
  sourceKey: string;
}

export interface ConfirmRejectResponse {
  knowledge: ProjectKnowledge;
}

// ─── TestSpecification ──────────────────────────────────────────────────────

export interface TestSpecification {
  id: string;
  title: string;
  description: string;
  method?: string;
  path?: string;
  requirementRefs: Array<{
    acIndex: number;
    acText?: string;
  }>;
  operationRefs: Array<{
    serviceId?: string;
    operationId?: string;
    endpointId?: string;
    method?: string;
    path?: string;
  }>;
  prerequisites: Array<{
    serviceId?: string;
    operationId?: string;
  }>;
  testData: {
    pathParams: Record<string, unknown>;
    queryParams: Record<string, unknown>;
    headers: Record<string, unknown>;
    body: Record<string, unknown>;
  };
  expectedBehavior: {
    status: number;
    responseAssertions: string[];
  };
  assertions: string[];
  planningIssue?: string;
}

export interface ExecutionPlanStep {
  order: number;
  operation: {
    serviceId: string;
    operationId: string;
    method?: string;
    path?: string;
    summary?: string;
    protocol?: string;
  };
  prerequisites: Array<{
    serviceId: string;
    operationId: string;
  }>;
  bindings: Array<{
    type: string;
    source: string;
    target: string;
    transform: string;
  }>;
  status: string;
}

export interface ExecutionPlan {
  target: {
    serviceId: string;
    operationId: string;
    method?: string;
    path?: string;
  };
  steps: ExecutionPlanStep[];
  errors: string[];
  isValid: boolean;
}

export interface GenerateTestSpecificationsRequest {
  projectId?: string;
  ticket?: Record<string, unknown>;
  contract?: Record<string, unknown>;
}

export interface GenerateTestSpecificationsResponse {
  projectId: string;
  testSpecifications: TestSpecification[];
  executionPlans: Record<string, ExecutionPlan>;
  diagnostics: {
    scenariosGenerated: number;
    specificationsCreated: number;
    plansBuilt: number;
    unresolved: number;
  };
  warnings: string[];
}

// ─── TestCase ────────────────────────────────────────────────────────────────

export interface TestCase {
  id: string;
  title: string;
  description: string;
  type: string;
  requirementRefs: Array<{
    acIndex: number;
    acText?: string;
  }>;
  testData: {
    pathParams: Record<string, unknown>;
    queryParams: Record<string, unknown>;
    headers: Record<string, unknown>;
    body: Record<string, unknown>;
  };
  expectedBehavior: {
    status: number;
    responseAssertions: string[];
  };
  assertions: string[];
}

export interface GenerateTestCasesRequest {
  projectId?: string;
  ticket?: Record<string, unknown>;
}

export interface GenerateTestCasesResponse {
  projectId: string;
  testCases: TestCase[];
  diagnostics: {
    generated: number;
  };
  warnings: string[];
}

// ─── API Matching (STEP 5.5D) ────────────────────────────────────────────────

export interface MatchCandidate {
  serviceId: string | null;
  operationId: string;
  method: string | null;
  path: string | null;
  confidence: number;
  reasons: string[];
}

export interface MatchResult {
  testCaseId: string;
  status: "matched" | "ambiguous" | "unmatched";
  selectedMatch: MatchCandidate | null;
  candidates: MatchCandidate[];
}

export interface MatchDiagnostics {
  total: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
}

export interface MatchTestCasesRequest {
  projectId?: string;
  testCases: TestCase[];
}

export interface MatchTestCasesResponse {
  projectId: string;
  matches: MatchResult[];
  diagnostics: MatchDiagnostics;
  warnings: string[];
}

export interface TestCaseApiMapping {
  testCaseId: string;
  serviceId: string;
  operationId: string;
  method: string;
  path: string;
  source: "automatic" | "manual";
}

export interface ConfirmMappingsResponse {
  projectId: string;
  includedTestCases: TestCase[];
  mappings: TestCaseApiMapping[];
  diagnostics: MatchDiagnostics;
}

export interface UnresolvedTestCase {
  testCaseId: string;
  reason: string;
}

export interface PrepareResponse {
  projectId: string;
  testSpecifications: TestSpecification[];
  plans: Record<string, ExecutionPlan>;
  unresolvedTestCases: UnresolvedTestCase[];
  diagnostics: {
    included: number;
    prepared: number;
    unresolved: number;
    plansBuilt: number;
  };
  warnings: string[];
}
