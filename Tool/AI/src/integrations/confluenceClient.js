/**
 * Confluence Client
 *
 * Real Atlassian REST API integration for Confluence.
 * Handles authentication, space retrieval, page fetching, and content extraction.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const ATHLASSIAN_API_BASE = 'api.atlassian.com';
const CONFLUENCE_API_PATH = '/wiki/rest/api';

class ConfluenceClient {
  constructor(config) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') || '';
    this.email = config.email || config.username || '';
    this.apiToken = config.apiToken || '';
    this.authenticated = false;
    this.user = null;
    this.permissions = [];
  }

  /**
   * Test connection and authenticate with Confluence
   */
  async testConnection() {
    try {
      const result = await this._makeRequest('GET', `${CONFLUENCE_API_PATH}/user/current`);
      
      if (result.statusCode === 200) {
        const user = JSON.parse(result.body);
        this.authenticated = true;
        this.user = {
          username: user.name || user.displayName,
          email: user.email,
          displayName: user.displayName,
        };
        
        return {
          connected: true,
          user: this.user,
          permissions: ['read', 'write'],
        };
      } else if (result.statusCode === 401) {
        return {
          connected: false,
          error: 'Invalid credentials',
        };
      } else {
        return {
          connected: false,
          error: `HTTP ${result.statusCode}: ${result.body}`,
        };
      }
    } catch (error) {
      return {
        connected: false,
        error: `Connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Retrieve available Confluence spaces
   */
  async getSpaces(options = {}) {
    const { limit = 100, start = 0, search = '' } = options;
    
    let endpoint = `${CONFLUENCE_API_PATH}/space?limit=${limit}&start=${start}&type=global`;
    if (search) {
      endpoint += `&query=${encodeURIComponent(search)}`;
    }

    const result = await this._makeRequest('GET', endpoint);
    
    if (result.statusCode !== 200) {
      throw new Error(`Failed to retrieve spaces: HTTP ${result.statusCode}`);
    }

    const data = JSON.parse(result.body);
    return {
      spaces: data.results?.map(space => ({
        id: space.id,
        key: space.key,
        name: space.name,
        description: space.description?.plain?.value || space.description || '',
        type: space.type,
        status: space.status,
        pageCount: space._links?.webui || space.id, // We'll fetch actual count separately
        lastUpdated: space._updated,
      })) || [],
      total: data.size || 0,
      start: data.start || 0,
      limit: data.limit || 100,
    };
  }

  /**
   * Retrieve pages from a specific space
   */
  async getPages(spaceId, options = {}) {
    const { 
      limit = 50, 
      start = 0, 
      search = '', 
      parentId = null,
      expand = 'version,history,metadata.labels' 
    } = options;
    
    let endpoint = `${CONFLUENCE_API_PATH}/content?limit=${limit}&start=${start}&spaceKey=${encodeURIComponent(spaceId)}&type=page&expand=${expand}`;
    
    if (search) {
      endpoint += `&query=${encodeURIComponent(search)}`;
    }
    
    if (parentId) {
      endpoint += `&ancestorId=${parentId}`;
    }

    const result = await this._makeRequest('GET', endpoint);
    
    if (result.statusCode !== 200) {
      throw new Error(`Failed to retrieve pages: HTTP ${result.statusCode}`);
    }

    const data = JSON.parse(result.body);
    return {
      pages: data.results?.map(page => ({
        id: page.id,
        title: page.title,
        type: page.type,
        status: page.status,
        spaceId: spaceId,
        parentId: page.ancestors?.[0]?.id || null,
        version: page.version?.number || 1,
        lastModified: page.history?.lastUpdated?.when || page._updated,
        author: page.history?.lastUpdated?.by?.displayName || 'Unknown',
        labels: page.metadata?.labels?.results?.map(l => l.name) || [],
        excerpt: page.excerpt || '',
        _links: page._links,
      })) || [],
      total: data.size || 0,
      start: data.start || 0,
      limit: data.limit || 50,
    };
  }

  /**
   * Retrieve page hierarchy (child pages)
   */
  async getPageHierarchy(pageId, options = {}) {
    const { limit = 50, start = 0 } = options;
    
    const endpoint = `${CONFLUENCE_API_PATH}/content/${pageId}/child/page?limit=${limit}&start=${start}&expand=version,history`;
    
    const result = await this._makeRequest('GET', endpoint);
    
    if (result.statusCode !== 200) {
      throw new Error(`Failed to retrieve page hierarchy: HTTP ${result.statusCode}`);
    }

    const data = JSON.parse(result.body);
    return {
      children: data.results?.map(page => ({
        id: page.id,
        title: page.title,
        type: page.type,
        status: page.status,
        version: page.version?.number || 1,
        lastModified: page.history?.lastUpdated?.when || page._updated,
        author: page.history?.lastUpdated?.by?.displayName || 'Unknown',
        hasChildren: page.children?.page?.size > 0,
      })) || [],
      total: data.size || 0,
    };
  }

  /**
   * Get full page content with storage format
   */
  async getPageContent(pageId) {
    const endpoint = `${CONFLUENCE_API_PATH}/content/${pageId}?expand=body.storage,version,history,metadata.labels,ancestors`;
    
    const result = await this._makeRequest('GET', endpoint);
    
    if (result.statusCode !== 200) {
      throw new Error(`Failed to retrieve page content: HTTP ${result.statusCode}`);
    }

    const page = JSON.parse(result.body);
    
    return {
      id: page.id,
      title: page.title,
      spaceId: page.spaceId,
      content: page.body?.storage?.value || '',
      contentFormat: page.body?.storage?.representation || 'storage',
      version: page.version?.number || 1,
      lastModified: page.history?.lastUpdated?.when || page._updated,
      author: page.history?.lastUpdated?.by?.displayName || 'Unknown',
      labels: page.metadata?.labels?.results?.map(l => l.name) || [],
      ancestors: page.ancestors?.map(a => ({
        id: a.id,
        title: a.title,
        type: a.type,
      })) || [],
    };
  }

  /**
   * Make HTTP request to Confluence API
   */
  async _makeRequest(method, path) {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
      
      // Determine if we need to use the full base URL or construct it
      let host = this.baseUrl;
      let fullPath = path;
      
      if (!this.baseUrl.includes('atlassian.net')) {
        // On-premise Confluence
        host = this.baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      }
      
      const options = {
        hostname: host,
        path: fullPath,
        method: method.toUpperCase(),
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };

      const client = host.startsWith('https') ? https : http;
      
      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: body,
            headers: res.headers,
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (method.toUpperCase() !== 'GET') {
        req.write('');
      }
      
      req.end();
    });
  }
}

module.exports = { ConfluenceClient };