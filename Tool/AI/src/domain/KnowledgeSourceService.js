/**
 * KnowledgeSourceService
 *
 * Service layer for managing knowledge sources and the aggregated repository.
 * Includes real Confluence synchronization and knowledge indexing.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { ConfluenceClient } = require('../integrations/confluenceClient');
const { buildPageIndex, detectChanges, needsReindexing, generateContentHash } = require('./knowledge-sources/KnowledgeIndexBuilder');
const { createKnowledgeSource, createKnowledgeRepositoryItem } = require('./knowledge-sources');
const {
  getKnowledgeSources,
  saveKnowledgeSources,
  getKnowledgeSource,
  addKnowledgeSource,
  updateKnowledgeSource,
  deleteKnowledgeSource,
  getRepositoryItems,
  saveRepositoryItems,
  getRepositoryItem,
  addRepositoryItem,
  updateRepositoryItem,
} = require('./repositories/FileKnowledgeSourceRepository');

const KNOWLEDGE_SOURCES_DIR = path.join(config.dataDir, "knowledge-sources");
const REPOSITORY_DIR = path.join(config.dataDir, "knowledge-repository");

function ensureStorage() {
  if (!fs.existsSync(KNOWLEDGE_SOURCES_DIR)) fs.mkdirSync(KNOWLEDGE_SOURCES_DIR, { recursive: true });
  if (!fs.existsSync(REPOSITORY_DIR)) fs.mkdirSync(REPOSITORY_DIR, { recursive: true });
}

// ─── Knowledge Sources CRUD ───────────────────────────────────────────────────

function listSources(projectId) {
  return getKnowledgeSources(projectId);
}

function getSource(projectId, sourceId) {
  return getKnowledgeSource(projectId, sourceId);
}

function createSource(projectId, sourceData) {
  ensureStorage();
  return addKnowledgeSource(projectId, sourceData);
}

function modifySource(projectId, sourceId, updates) {
  return updateKnowledgeSource(projectId, sourceId, updates);
}

function removeSource(projectId, sourceId) {
  // Also remove associated repository items
  const items = getRepositoryItems(projectId);
  const filtered = items.filter(item => item.sourceId !== sourceId);
  saveRepositoryItems(projectId, filtered);
  
  return deleteKnowledgeSource(projectId, sourceId);
}

// ─── Knowledge Repository ─────────────────────────────────────────────────────

function listRepositoryItems(projectId) {
  return getRepositoryItems(projectId);
}

function getRepositoryItemById(projectId, itemId) {
  return getRepositoryItem(projectId, itemId);
}

function addRepositoryItemToProject(projectId, itemData) {
  return addRepositoryItem(projectId, itemData);
}

function modifyRepositoryItem(projectId, itemId, updates) {
  return updateRepositoryItem(projectId, itemId, updates);
}

function removeRepositoryItem(projectId, itemId) {
  const items = getRepositoryItems(projectId);
  const filtered = items.filter(i => i.id !== itemId);
  saveRepositoryItems(projectId, filtered);
  return filtered;
}

function getFullRepository(projectId) {
  const sources = getKnowledgeSources(projectId);
  const items = getRepositoryItems(projectId);

  // Enrich items with source metadata
  const enriched = items.map(item => {
    const source = sources.find(s => s.id === item.sourceId);
    return {
      ...item,
      sourceName: source ? source.name : 'Unknown Source',
      sourceStatus: source ? source.status : 'unknown',
    };
  });

  return {
    sources,
    items: enriched,
    stats: {
      totalSources: sources.length,
      connectedSources: sources.filter(s => s.status === 'connected' || s.status === 'available').length,
      totalItems: items.length,
      bySource: sources.map(s => ({
        ...s,
        itemCount: items.filter(i => i.sourceId === s.id).length,
      })),
    }
  };
}

// ─── Confluence Synchronization ──────────────────────────────────────────────

async function syncConfluenceSource(projectId, sourceId) {
  const source = getKnowledgeSource(projectId, sourceId);
  if (!source || source.type !== 'confluence') {
    throw new Error('Confluence source not found');
  }

  const { baseUrl, email, apiToken, spaces, pages, syncConfig } = source.config;
  
  if (!baseUrl || !email || !apiToken) {
    throw new Error('Confluence source not configured');
  }

  // Initialize Confluence client
  const client = new ConfluenceClient({
    baseUrl,
    email,
    apiToken: apiToken,
  });

  // Test connection
  const connectionResult = await client.testConnection();
  if (!connectionResult.connected) {
    throw new Error(connectionResult.error || 'Connection failed');
  }

  // Update source status to syncing
  updateKnowledgeSource(projectId, sourceId, {
    status: 'syncing',
    lastSync: {
      status: 'running',
      timestamp: new Date().toISOString(),
      pagesIndexed: 0,
      pagesChanged: 0,
      errors: [],
    },
  });

  try {
    // Fetch selected spaces and pages
    const indexedPages = [];
    let pagesIndexed = 0;
    let pagesChanged = 0;
    const errors = [];

    for (const spaceId of spaces) {
      try {
        // Get pages from space
        const pagesResult = await client.getPages(spaceId, { limit: 100 });
        
        for (const page of pagesResult.pages) {
          // Skip if not in selected pages list (if provided)
          if (pages && pages.length > 0 && !pages.includes(page.id)) {
            continue;
          }

          try {
            // Get full page content
            const pageContent = await client.getPageContent(page.id);
            
            // Build knowledge index
            const pageIndex = buildPageIndex(pageContent.content, {
              id: pageContent.id,
              title: pageContent.title,
              spaceId: pageContent.spaceId,
              version: pageContent.version,
              lastModified: pageContent.lastModified,
              author: pageContent.author,
              labels: pageContent.labels,
            });

            // Check if page already exists in repository
            const existingItem = getRepositoryItems(projectId).find(
              item => item.sourceId === sourceId && item.sourcePageId === page.id
            );

            if (existingItem) {
              // Detect changes
              const oldIndex = {
                contentHash: existingItem.contentHash,
                version: existingItem.version,
                lastModified: existingItem.lastUpdated,
                sections: existingItem.sections,
              };

              const changes = detectChanges(oldIndex, pageIndex);
              
              if (changes.changeType !== 'none') {
                // Update existing item
                const updatedItem = {
                  ...existingItem,
                  ...pageIndex,
                  sourcePageId: page.id,
                  lastUpdated: pageIndex.lastModified,
                  indexedAt: new Date().toISOString(),
                  status: 'indexed',
                  changeType: changes.changeType,
                  changes: changes.changes,
                  version: pageIndex.version,
                  contentHash: pageIndex.contentHash,
                };

                updateRepositoryItem(projectId, existingItem.id, updatedItem);
                pagesChanged++;
              }
            } else {
              // Add new item
              const newItem = {
                ...pageIndex,
                sourceId,
                sourcePageId: page.id,
                projectId,
                status: 'indexed',
                changeType: 'added',
                changes: [{ type: 'added', description: 'New page indexed' }],
              };

              addRepositoryItem(projectId, newItem);
              pagesIndexed++;
            }
          } catch (pageError) {
            errors.push(`Failed to index page ${page.id}: ${pageError.message}`);
          }
        }
      } catch (spaceError) {
        errors.push(`Failed to process space ${spaceId}: ${spaceError.message}`);
      }
    }

    // Update source with sync results
    updateKnowledgeSource(projectId, sourceId, {
      status: 'connected',
      lastSync: {
        status: 'completed',
        timestamp: new Date().toISOString(),
        pagesIndexed,
        pagesChanged,
        errors,
      },
    });

    return {
      success: true,
      pagesIndexed,
      pagesChanged,
      errors,
    };

  } catch (error) {
    // Update source with error
    updateKnowledgeSource(projectId, sourceId, {
      status: 'error',
      lastSync: {
        status: 'failed',
        timestamp: new Date().toISOString(),
        pagesIndexed: 0,
        pagesChanged: 0,
        errors: [error.message],
      },
    });

    throw error;
  }
}

// ─── Knowledge Health ─────────────────────────────────────────────────────────

function getKnowledgeHealth(projectId) {
  const repo = getFullRepository(projectId);
  const health = {
    connected: 0,
    indexed: 0,
    pendingIndex: 0,
    failed: 0,
    outdated: 0,
    warnings: [],
  };

  const now = new Date();
  const OUTDATED_DAYS = 7;

  repo.items.forEach(item => {
    switch (item.status) {
      case 'indexed':
        health.indexed++;
        break;
      case 'pending':
        health.pendingIndex++;
        break;
      case 'failed':
        health.failed++;
        break;
    }

    // Check if outdated
    if (item.indexedAt) {
      const lastIndexed = new Date(item.indexedAt);
      const daysSinceIndex = (now - lastIndexed) / (1000 * 60 * 60 * 24);
      
      if (daysSinceIndex > OUTDATED_DAYS) {
        health.outdated++;
        health.warnings.push({
          type: 'outdated',
          item: item.title,
          message: `Not indexed for ${Math.floor(daysSinceIndex)} days`,
        });
      }
    }
  });

  // Count connected sources
  health.connected = repo.stats.connectedSources;

  // Check for sources with sync errors
  repo.sources.forEach(source => {
    if (source.lastSync?.errors?.length > 0) {
      health.warnings.push({
        type: 'sync_error',
        source: source.name,
        message: source.lastSync.errors.join(', '),
      });
    }
  });

  return health;
}

// ─── AI Readiness Calculation ─────────────────────────────────────────────────

function calculateAIReadiness(projectId) {
  const repo = getFullRepository(projectId);
  const health = getKnowledgeHealth(projectId);

  const metrics = {
    totalSources: repo.stats.totalSources,
    connectedSources: repo.stats.connectedSources,
    totalDocuments: repo.stats.totalItems,
    sourceBreakdown: repo.stats.bySource.map(s => ({
      id: s.id,
      type: s.type,
      name: s.name,
      status: s.status,
      itemCount: s.itemCount,
    })),
    knowledgeTypes: {},
    coveragePercentage: 0,
    health,
  };

  // Calculate knowledge type distribution
  repo.items.forEach(item => {
    const kt = item.knowledgeType || 'documentation';
    metrics.knowledgeTypes[kt] = (metrics.knowledgeTypes[kt] || 0) + 1;
  });

  // Calculate readiness score (0-100)
  let score = 0;

  // Source connectivity (25 points)
  if (metrics.totalSources > 0) {
    const sourceScore = (metrics.connectedSources / metrics.totalSources) * 25;
    score += sourceScore;
  }

  // Document count (25 points)
  const docScore = Math.min(repo.items.length * 2.5, 25);
  score += docScore;

  // Knowledge type diversity (20 points)
  const typeScore = Math.min(Object.keys(metrics.knowledgeTypes).length * 5, 20);
  score += typeScore;

  // Health (30 points)
  if (metrics.totalDocuments > 0) {
    const healthRatio = (metrics.health.indexed - metrics.health.outdated) / metrics.totalDocuments;
    const healthScore = Math.max(0, healthRatio * 30);
    score += healthScore;
  }

  metrics.coveragePercentage = Math.round(score);

  // Determine readiness level
  if (metrics.coveragePercentage >= 80) {
    metrics.level = 'ready';
  } else if (metrics.coveragePercentage >= 60) {
    metrics.level = 'good';
  } else if (metrics.coveragePercentage >= 40) {
    metrics.level = 'fair';
  } else {
    metrics.level = 'poor';
  }

  return metrics;
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function getBackendName() {
  return "file";
}

async function ensureReady() {
  ensureStorage();
  return true;
}

module.exports = {
  // Knowledge Sources
  listSources,
  getSource,
  createSource,
  modifySource,
  removeSource,

  // Knowledge Repository
  listRepositoryItems,
  getRepositoryItemById,
  addRepositoryItemToProject,
  modifyRepositoryItem,
  removeRepositoryItem,
  getFullRepository,

  // Confluence Synchronization
  syncConfluenceSource,

  // Health and Readiness
  getKnowledgeHealth,
  calculateAIReadiness,

  // Utility
  getBackendName,
  ensureReady,
};