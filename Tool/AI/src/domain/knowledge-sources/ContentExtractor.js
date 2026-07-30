/**
 * ContentExtractor
 *
 * Extracts structured content from Confluence pages for AI indexing.
 * Parses HTML storage format and extracts meaningful sections.
 */

const { KNOWLEDGE_TYPES } = require('./KnowledgeSourceTypes');

/**
 * Extract structured content from Confluence HTML storage format
 */
function extractContent(htmlContent, pageTitle) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return {
      title: pageTitle || 'Untitled',
      sections: [],
      metadata: {},
    };
  }

  const sections = [];
  const metadata = {
    wordCount: 0,
    hasTables: false,
    hasCodeBlocks: false,
    hasLists: false,
    hasImages: false,
    businessRules: [],
    authenticationFlows: [],
    apiReferences: [],
  };

  // Extract title
  const title = pageTitle || extractTitle(htmlContent);

  // Extract headings and sections
  const headingRegex = /<h([1-6])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi;
  const headings = [];
  let headingMatch;
  
  while ((headingMatch = headingRegex.exec(htmlContent)) !== null) {
    headings.push({
      level: parseInt(headingMatch[1]),
      id: headingMatch[2],
      text: stripHtml(headingMatch[3]),
    });
  }

  // Split content by headings
  if (headings.length > 0) {
    for (let i = 0; i < headings.length; i++) {
      const currentHeading = headings[i];
      const nextHeading = headings[i + 1];
      
      const sectionStart = htmlContent.indexOf(currentHeading.id) + currentHeading.id.length;
      const sectionEnd = nextHeading ? htmlContent.indexOf(nextHeading.id) : htmlContent.length;
      
      const sectionContent = htmlContent.substring(sectionStart, sectionEnd);
      
      const section = {
        id: currentHeading.id,
        title: currentHeading.text,
        level: currentHeading.level,
        content: stripHtml(sectionContent),
        rawHtml: sectionContent,
        wordCount: countWords(sectionContent),
        hasTables: sectionContent.includes('<table'),
        hasCodeBlocks: sectionContent.includes('<pre>') || sectionContent.includes('<code>'),
        hasLists: sectionContent.includes('<ul>') || sectionContent.includes('<ol>'),
      };

      sections.push(section);
      metadata.wordCount += section.wordCount;

      if (section.hasTables) metadata.hasTables = true;
      if (section.hasCodeBlocks) metadata.hasCodeBlocks = true;
      if (section.hasLists) metadata.hasLists = true;

      // Detect business rules (text containing "must", "should", "required", "mandatory")
      if (/must|should|required|mandatory|shall/i.test(section.content)) {
        metadata.businessRules.push({
          section: currentHeading.text,
          content: section.content.substring(0, 200),
        });
      }

      // Detect authentication flows
      if (/oauth|authentication|authorization|token|jwt|saml/i.test(section.content)) {
        metadata.authenticationFlows.push({
          section: currentHeading.text,
          type: detectAuthType(section.content),
        });
      }

      // Detect API references
      if (/api|endpoint|route|path/i.test(section.content)) {
        metadata.apiReferences.push({
          section: currentHeading.text,
        });
      }
    }
  } else {
    // No headings, treat entire content as one section
    sections.push({
      id: 'section-1',
      title: 'Main Content',
      level: 1,
      content: stripHtml(htmlContent),
      rawHtml: htmlContent,
      wordCount: countWords(htmlContent),
      hasTables: htmlContent.includes('<table'),
      hasCodeBlocks: htmlContent.includes('<pre>') || htmlContent.includes('<code>'),
      hasLists: htmlContent.includes('<ul>') || htmlContent.includes('<ol>'),
    });
    metadata.wordCount = sections[0].wordCount;
    if (sections[0].hasTables) metadata.hasTables = true;
    if (sections[0].hasCodeBlocks) metadata.hasCodeBlocks = true;
    if (sections[0].hasLists) metadata.hasLists = true;
  }

  // Detect images
  metadata.hasImages = htmlContent.includes('<img');

  // Determine knowledge type
  const knowledgeType = detectKnowledgeType(sections, metadata);

  return {
    title,
    sections,
    metadata,
    knowledgeType,
  };
}

/**
 * Extract title from HTML content
 */
function extractTitle(htmlContent) {
  const titleMatch = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (titleMatch) {
    return stripHtml(titleMatch[1]);
  }
  return 'Untitled';
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/&/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * Count words in text
 */
function countWords(text) {
  const stripped = stripHtml(text);
  if (!stripped) return 0;
  return stripped.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Detect knowledge type based on content
 */
function detectKnowledgeType(sections, metadata) {
  if (metadata.authenticationFlows.length > 0) {
    return 'authentication';
  }
  
  if (metadata.businessRules.length > 0) {
    return 'business-rule';
  }
  
  if (metadata.apiReferences.length > 0) {
    return 'api-spec';
  }
  
  if (metadata.hasCodeBlocks || metadata.hasTables) {
    return 'architecture';
  }
  
  return 'documentation';
}

/**
 * Detect authentication type
 */
function detectAuthType(content) {
  const lower = content.toLowerCase();
  if (lower.includes('oauth')) return 'oauth';
  if (lower.includes('jwt')) return 'jwt';
  if (lower.includes('saml')) return 'saml';
  if (lower.includes('basic auth')) return 'basic';
  return 'unknown';
}

/**
 * Build searchable knowledge index from extracted content
 */
function buildKnowledgeIndex(extractedContent) {
  const { title, sections, metadata, knowledgeType } = extractedContent;
  
  const index = {
    title,
    knowledgeType,
    metadata,
    sections: sections.map(section => ({
      id: section.id,
      title: section.title,
      level: section.level,
      content: section.content,
      wordCount: section.wordCount,
      features: {
        tables: section.hasTables,
        codeBlocks: section.hasCodeBlocks,
        lists: section.hasLists,
      },
    })),
    fullText: sections.map(s => s.content).join('\n\n'),
    searchableContent: [
      title,
      ...sections.map(s => `${s.title} ${s.content}`)
    ].join(' '),
  };

  return index;
}

module.exports = {
  extractContent,
  buildKnowledgeIndex,
  stripHtml,
  countWords,
};