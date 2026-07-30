/**
 * KnowledgeSourceService
 *
 * Frontend service for interacting with Knowledge Sources API.
 */

export interface KnowledgeSource {
  id: string;
  projectId: string;
  type: 'confluence' | 'local-documents' | 'project-notes';
  name: string;
  description: string;
  status: 'available' | 'connected' | 'not-connected' | 'syncing' | 'error';
  config: Record<string, unknown>;
  syncConfig: {
    autoSync: boolean;
    interval: number;
  };
  lastSync: {
    status: string;
    timestamp: string | null;
    pagesIndexed: number;
    pagesChanged: number;
    errors: string[];
  };
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeRepositoryItem {
  id: string;
  projectId: string;
  sourceId: string;
  sourceType: string;
  title: string;
  content: string;
  contentType: string;
  knowledgeType: string;
  version: number;
  lastUpdated: string;
  status: string;
  metadata: Record<string, unknown>;
  syncVersion: string;
  createdAt: string;
  updatedAt: string;
  sourceName?: string;
  sourceStatus?: string;
}

export interface AggregatedRepository {
  sources: KnowledgeSource[];
  items: (KnowledgeRepositoryItem & { sourceName: string; sourceStatus: string })[];
  stats: {
    totalSources: number;
    connectedSources: number;
    totalItems: number;
    bySource: (KnowledgeSource & { itemCount: number })[];
  };
}

export interface ReadinessMetrics {
  totalSources: number;
  connectedSources: number;
  totalDocuments: number;
  sourceBreakdown: Array<{
    id: string;
    type: string;
    name: string;
    status: string;
    itemCount: number;
  }>;
  knowledgeTypes: Record<string, number>;
  coveragePercentage: number;
}

const API_BASE = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function listKnowledgeSources(projectId: string): Promise<KnowledgeSource[]> {
  const response = await fetch(
    `${API_BASE}/knowledge-sources?projectId=${encodeURIComponent(projectId)}`
  );
  const data = await handleResponse<{ sources: KnowledgeSource[] }>(response);
  return data.sources;
}

export async function getKnowledgeSource(
  projectId: string,
  sourceId: string
): Promise<KnowledgeSource> {
  const response = await fetch(
    `${API_BASE}/knowledge-sources/${encodeURIComponent(sourceId)}?projectId=${encodeURIComponent(projectId)}`
  );
  const data = await handleResponse<{ source: KnowledgeSource }>(response);
  return data.source;
}

export async function createKnowledgeSource(
  projectId: string,
  sourceData: Partial<KnowledgeSource>
): Promise<KnowledgeSource> {
  const response = await fetch(`${API_BASE}/knowledge-sources?projectId=${encodeURIComponent(projectId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...sourceData, projectId }),
  });
  const data = await handleResponse<{ source: KnowledgeSource }>(response);
  return data.source;
}

export async function updateKnowledgeSource(
  projectId: string,
  sourceId: string,
  updates: Partial<KnowledgeSource>
): Promise<KnowledgeSource> {
  const response = await fetch(
    `${API_BASE}/knowledge-sources/${encodeURIComponent(sourceId)}?projectId=${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    }
  );
  const data = await handleResponse<{ source: KnowledgeSource }>(response);
  return data.source;
}

export async function deleteKnowledgeSource(
  projectId: string,
  sourceId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/knowledge-sources/${encodeURIComponent(sourceId)}?projectId=${encodeURIComponent(projectId)}`,
    {
      method: 'DELETE',
    }
  );
  await handleResponse<{ success: boolean }>(response);
}

export async function getAggregatedRepository(projectId: string): Promise<AggregatedRepository> {
  const response = await fetch(
    `${API_BASE}/knowledge-repository?projectId=${encodeURIComponent(projectId)}`
  );
  const data = await handleResponse<{ repository: AggregatedRepository }>(response);
  return data.repository;
}

export async function getRepositoryItems(projectId: string): Promise<KnowledgeRepositoryItem[]> {
  const response = await fetch(
    `${API_BASE}/knowledge-repository/items?projectId=${encodeURIComponent(projectId)}`
  );
  const data = await handleResponse<{ items: KnowledgeRepositoryItem[] }>(response);
  return data.items;
}

export async function getKnowledgeHealth(projectId: string): Promise<any> {
  const response = await fetch(
    `${API_BASE}/knowledge-repository/health?projectId=${encodeURIComponent(projectId)}`
  );
  const data = await handleResponse<{ health: any }>(response);
  return data.health;
}

export async function getReadinessMetrics(projectId: string): Promise<ReadinessMetrics> {
  const response = await fetch(
    `${API_BASE}/knowledge-repository/readiness?projectId=${encodeURIComponent(projectId)}`
  );
  const data = await handleResponse<{ readiness: ReadinessMetrics }>(response);
  return data.readiness;
}

export async function syncConfluenceSource(projectId: string, sourceId: string): Promise<any> {
  const response = await fetch(
    `${API_BASE}/knowledge-sources/${encodeURIComponent(sourceId)}/sync?projectId=${encodeURIComponent(projectId)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectId }),
    }
  );
  const data = await handleResponse<{ sync: any }>(response);
  return data.sync;
}

export async function testConfluenceConnection(config: { baseUrl: string; email: string; apiToken: string }): Promise<any> {
  const response = await fetch(
    `${API_BASE}/integrations/confluence/test`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    }
  );
  return handleResponse<any>(response);
}

export async function getConfluenceSpaces(sourceId: string): Promise<any> {
  const response = await fetch(
    `${API_BASE}/integrations/confluence/spaces?sourceId=${encodeURIComponent(sourceId)}`
  );
  const data = await handleResponse<{ spaces: any[]; total: number }>(response);
  return data;
}

export async function getConfluencePages(sourceId: string, spaceId: string): Promise<any> {
  const response = await fetch(
    `${API_BASE}/integrations/confluence/spaces/${encodeURIComponent(spaceId)}/pages?sourceId=${encodeURIComponent(sourceId)}`
  );
  const data = await handleResponse<{ pages: any[]; total: number }>(response);
  return data;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function uploadDocument(projectId: string, file: File, sourceId?: string): Promise<KnowledgeRepositoryItem> {
  const buffer = await file.arrayBuffer();
  const bufferBase64 = arrayBufferToBase64(buffer);
  
  const response = await fetch(`${API_BASE}/knowledge-sources/upload?projectId=${encodeURIComponent(projectId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      sourceId: sourceId || `local-documents-${projectId}`,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      bufferBase64,
    }),
  });
  
  const data = await handleResponse<{ item: KnowledgeRepositoryItem }>(response);
  return data.item;
}
