/**
 * KnowledgeIndexBuilder
 *
 * Builds searchable knowledge index from Confluence pages.
 * Handles content hashing, versioning, and incremental updates.
 */

const crypto = require('crypto');
const { extractContent, buildKnowledgeIndex } = require('./ContentExtractor');

/**
 * Build knowledge index for a page
 */
function buildPageIndex(pageContent, pageMetadata) {
  const { id, title, spaceId, version, lastModified, author, labels } = pageMetadata;
  
  // Extract content
  const extracted = extractContent(pageContent, title);
  const index = buildKnowledgeIndex(extracted);
  
  // Generate content hash for change detection
  const contentHash = generateContentHash(pageContent);
  
  return {
    pageId: id,
    spaceId,
    title: index.title,
    knowledgeType: index.knowledgeType,
    version,
    lastModified,
    author,
    labels,
    contentHash,
    sections: index.sections,
    metadata: {
      ...index.metadata,
      wordCount: index.metadata.wordCount,
      hasTables: index.metadata.hasTables,
      hasCodeBlocks: index.metadata.hasCodeBlocks,
      hasLists: index.metadata.hasLists,
      hasImages: index.metadata.hasImages,
      businessRules: index.metadata.businessRules,
      authenticationFlows: index.metadata.authenticationFlows,
      apiReferences: index.metadata.apiReferences,
    },
    fullText: index.fullText,
    searchableContent: index.searchableContent,
    indexedAt: new Date().toISOString(),
  };
}

/**
 * Generate hash for content change detection
 */
function generateContentHash(content) {
  if (!content) return '';
  // Normalize content for hashing (remove whitespace variations)
  const normalized = content
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Compare two versions to detect changes
 */
function detectChanges(oldIndex, newIndex) {
  if (!oldIndex) {
    return {
      changeType: 'added',
      changes: [{ type: 'added', section: 'All', description: 'New page indexed' }],
    };
  }

  if (oldIndex.contentHash === newIndex.contentHash) {
    return {
      changeType: 'none',
      changes: [],
    };
  }

  const changes = [];
  
  // Check for metadata changes
  if (oldIndex.version !== newIndex.version) {
    changes.push({
      type: 'modified',
      section: 'Version',
      description: `Updated from version ${oldIndex.version} to ${newIndex.version}`,
    });
  }
  
  if (oldIndex.lastModified !== newIndex.lastModified) {
    changes.push({
      type: 'modified',
      section: 'Timestamp',
      description: `Last modified: ${newIndex.lastModified}`,
    });
  }

  // Check for section changes
  const oldSections = new Map(oldIndex.sections.map(s => [s.id, s]));
  const newSections = new Map(newIndex.sections.map(s => [s.id, s]));

  // Detect added sections
  for (const [id, section] of newSections) {
    if (!oldSections.has(id)) {
      changes.push({
        type: 'added',
        section: section.title,
        description: 'New section added',
      });
    }
  }

  // Detect removed sections
  for (const [id, section] of oldSections) {
    if (!newSections.has(id)) {
      changes.push({
        type: 'removed',
        section: section.title,
        description: 'Section removed',
      });
    }
  }

  // Detect modified sections (simplified - compare content hashes)
  for (const [id, newSection] of newSections) {
    const oldSection = oldSections.get(id);
    if (oldSection && oldSection.content !== newSection.content) {
      changes.push({
        type: 'modified',
        section: newSection.title,
        description: 'Content modified',
      });
    }
  }

  const changeType = changes.some(c => c.type === 'added') ? 'added' 
    : changes.some(c => c.type === 'removed') ? 'removed'
    : 'modified';

  return {
    changeType,
    changes,
    oldVersion: oldIndex.version,
    newVersion: newIndex.version,
  };
}

/**
 * Determine if page needs re-indexing
 */
function needsReindexing(oldIndex, newMetadata) {
  if (!oldIndex) return true;
  
  // Re-index if version changed
  if (oldIndex.version !== newMetadata.version) return true;
  
  // Re-index if last modified changed
  if (oldIndex.lastModified !== newMetadata.lastModified) return true;
  
  // Re-index if content hash changed
  return false;
}

module.exports = {
  buildPageIndex,
  generateContentHash,
  detectChanges,
  needsReindexing,
};