/**
 * Database Migration Runner
 *
 * STEP 7.3A — Applies the foundation schema at server startup.
 * Idempotent: safe to run on every startup.
 *
 * Does NOT contain domain/repository logic.
 */

const fs = require('fs');
const path = require('path');
const pool = require('./pool');

/**
 * Apply all pending migrations.
 * Currently: single 001-schema.sql file.
 * 
 * @returns {Promise<{ applied: boolean, error?: string }>}
 */
async function migrate() {
  const dbPool = pool.getPool();
  if (!dbPool) {
    // PG disabled — skip migration silently
    return { applied: false, reason: 'PostgreSQL disabled' };
  }

  try {
    const sqlPath = path.join(__dirname, '001-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await dbPool.query(sql);
    console.log('[db] Schema migration applied successfully');
    return { applied: true };
  } catch (err) {
    const msg = `Schema migration failed: ${err.message}`;
    console.error('[db]', msg);
    return { applied: false, error: msg };
  }
}

module.exports = { migrate };