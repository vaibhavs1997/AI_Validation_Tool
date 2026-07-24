const config = require("../config");

let cachedPool = null;
let poolFactoryForTests = null;
let connected = false;

function isPostgresEnabled() {
  return Boolean(
    (config.features && config.features.pgEnabled) ||
    (config.pg && config.pg.enabled)
  );
}

function buildPoolConfig() {
  const pg = config.pg || {};
  const connectionString = pg.connectionString || pg.databaseUrl || "";
  const base = {
    max: pg.max || 10,
    idleTimeoutMillis: pg.idleTimeoutMs || 30000,
    connectionTimeoutMillis: pg.connectionTimeoutMs || 5000,
  };

  if (connectionString) {
    return {
      ...base,
      connectionString,
      ssl: pg.ssl ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    ...base,
    host: pg.host,
    port: pg.port,
    database: pg.database,
    user: pg.user,
    password: pg.password,
    ssl: pg.ssl ? { rejectUnauthorized: false } : undefined,
  };
}

function createPool() {
  if (typeof poolFactoryForTests === "function") {
    return poolFactoryForTests(buildPoolConfig());
  }

  if (!isPostgresEnabled()) {
    return null;
  }

  let Pool;
  try {
    Pool = require("pg").Pool;
  } catch (error) {
    throw new Error("PostgreSQL support requires the 'pg' package. Install it or set PG_ENABLED=false.");
  }

  const pool = new Pool(buildPoolConfig());
  if (typeof pool.on === "function") {
    pool.on("error", (err) => {
      connected = false;
      console.error("[db] Unexpected pool error:", err.message);
    });
  }
  return pool;
}

function getPool() {
  if (!cachedPool) {
    cachedPool = createPool();
  }
  return cachedPool;
}

async function query(text, params) {
  const pool = getPool();
  if (!pool) {
    throw new Error("PostgreSQL is not enabled. Set PG_ENABLED=true and DATABASE_URL.");
  }

  try {
    const result = await pool.query(text, params);
    connected = true;
    return result;
  } catch (error) {
    connected = false;
    throw new Error(`Database query failed: ${error.message}`);
  }
}

async function checkConnection() {
  const pool = getPool();
  if (!pool) {
    return { connected: false, reason: "PostgreSQL disabled (PG_ENABLED=false)" };
  }

  try {
    await pool.query("SELECT 1");
    connected = true;
    return typeof poolFactoryForTests === "function" ? true : { connected: true };
  } catch (error) {
    connected = false;
    if (typeof poolFactoryForTests === "function") {
      throw error;
    }
    return { connected: false, reason: error.message };
  }
}

function isHealthy() {
  return connected;
}

async function closePool() {
  if (cachedPool && typeof cachedPool.end === "function") {
    await cachedPool.end();
  }
  cachedPool = null;
  connected = false;
}

async function shutdown() {
  await closePool();
}

function __setPoolFactoryForTests(factory) {
  poolFactoryForTests = factory;
  cachedPool = null;
  connected = false;
}

function __resetPoolForTests() {
  poolFactoryForTests = null;
  cachedPool = null;
  connected = false;
}

module.exports = {
  getPool,
  query,
  checkConnection,
  isHealthy,
  closePool,
  shutdown,
  __setPoolFactoryForTests,
  __resetPoolForTests,
};
