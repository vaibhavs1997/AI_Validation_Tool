const config = require("../config");

let cachedPool = null;
let poolFactoryForTests = null;

function buildPoolConfig() {
  const pg = config.pg || {};
  const base = {
    max: pg.max || 10,
    idleTimeoutMillis: pg.idleTimeoutMs || 30000,
    connectionTimeoutMillis: pg.connectionTimeoutMs || 5000,
  };

  if (pg.connectionString) {
    return {
      ...base,
      connectionString: pg.connectionString,
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

  let Pool;
  try {
    Pool = require("pg").Pool;
  } catch (error) {
    throw new Error("PostgreSQL support requires the 'pg' package. Install it or set PG_ENABLED=false.");
  }
  return new Pool(buildPoolConfig());
}

function getPool() {
  if (!cachedPool) {
    cachedPool = createPool();
  }
  return cachedPool;
}

async function checkConnection() {
  const pool = getPool();
  await pool.query("SELECT 1");
  return true;
}

async function closePool() {
  if (cachedPool && typeof cachedPool.end === "function") {
    await cachedPool.end();
  }
  cachedPool = null;
}

function __setPoolFactoryForTests(factory) {
  poolFactoryForTests = factory;
  cachedPool = null;
}

function __resetPoolForTests() {
  poolFactoryForTests = null;
  cachedPool = null;
}

module.exports = {
  getPool,
  checkConnection,
  closePool,
  __setPoolFactoryForTests,
  __resetPoolForTests,
};
