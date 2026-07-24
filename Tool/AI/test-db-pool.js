const assert = require("node:assert");

function clearModule(modulePath) {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {}
}

clearModule("./src/config");
clearModule("./src/db/pool");

const poolModule = require("./src/db/pool");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
  } catch (error) {
    failed++;
    console.error("FAIL:", name);
    console.error(error && error.stack ? error.stack : error);
  }
}

async function run() {
  await test("checkConnection uses injected pool factory", async () => {
    let queried = false;
    poolModule.__setPoolFactoryForTests(() => ({
      async query(sql) {
        assert.strictEqual(String(sql).trim(), "SELECT 1");
        queried = true;
        return { rows: [{ ok: 1 }] };
      },
      async end() {},
    }));

    const ok = await poolModule.checkConnection();
    assert.strictEqual(ok, true);
    assert.strictEqual(queried, true);
  });

  await test("pool is cached until reset", async () => {
    let created = 0;
    poolModule.__setPoolFactoryForTests(() => {
      created += 1;
      return {
        async query() {
          return { rows: [] };
        },
        async end() {},
      };
    });

    const a = poolModule.getPool();
    const b = poolModule.getPool();
    assert.strictEqual(a, b);
    assert.strictEqual(created, 1);
  });

  await test("reset clears cached pool", async () => {
    let created = 0;
    poolModule.__setPoolFactoryForTests(() => {
      created += 1;
      return {
        async query() {
          return { rows: [] };
        },
        async end() {},
      };
    });

    poolModule.getPool();
    poolModule.__resetPoolForTests();
    poolModule.__setPoolFactoryForTests(() => {
      created += 1;
      return {
        async query() {
          return { rows: [] };
        },
        async end() {},
      };
    });
    poolModule.getPool();
    assert.strictEqual(created, 2);
  });

  await poolModule.closePool();
  poolModule.__resetPoolForTests();

  console.log(`\nDB pool tests: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

run();
