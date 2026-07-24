/**
 * Database Pool
 *
 * STEP 7.3A — PostgreSQL connection management.
 *
 * Responsibilities:
 * - Create/manage pg Pool
 * - query helper
 * - connectivity check
 * - clean shutdown
 * - clear error handling
 *
 * Does NOT contain domain/repository logic.
 */

const config = require('../config');

let pool = null;
let isConnected = false;

/**
 * Get or create the pg Pool.
 * Returns null when PG_ENABLED=false.
 */
function getPool() {
  if (!config.pg.enabled) return null;
  if (pool) return pool;

  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: config.pg.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.error('[db] Unexpected pool error:', err.message);
    isConnected = false;
  });

  return pool;
}

/**
 * Execute a query against PostgreSQL.
 * Throws clear error when PG is disabled or not connected.
 *
 * @param {string} text - SQL query text
 * @param {Array} [params] - Query parameters
 * @returns {Promise<{ rows: Array, rowCount: number }>}
 */
async function query(text, params) {
  const p = getPool();
  if (!p) {
    throw new Error('PostgreSQL is not enabled. Set PG_ENABLED=true and DATABASE_URL.');
  }
  try {
    const result = await p.query(text, params);
    return result;
  } catch (err) {
    throw new Error(`Database query failed: ${err.message}`);
  }
}

/**
 * Check PostgreSQL connectivity.
 * Returns { connected: false, reason: string } when disabled or unreachable.
 * Returns { connected: true } when healthy.
 */
async function checkConnection() {
  if (!config.pg.enabled) {
    return { connected: false, reason: 'PostgreSQL disabled (PG_ENABLED=false)' };
  }

  try {
    const p = getPool();
    if (!p) {
      return { connected: false, reason: 'Pool not initialized' };
    }
    await p.query('SELECT 1');
    isConnected = true;
    return { connected: true };
  } catch (err) {
    isConnected = false;
    return { connected: false, reason: err.message };
  }
}

/**
 * Whether the pool has ever successfully connected.
 */
function isHealthy() {
  return isConnected;
}

/**
 * Gracefully shut down the pool.
 */
async function shutdown() {
  if (pool) {
    try {
      await pool.end();
    } catch (err) {
      console.error('[db] Error during pool shutdown:', err.message);
    }
    pool = null;
    isConnected = false;
  }
}

module.exports = {
  getPool,
  query,
  checkConnection,
  isHealthy,
  shutdown,
};