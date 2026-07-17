const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

function loadDotEnv() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function intEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  rootDir,
  publicDir: path.join(rootDir, "public"),
  sampleDir: path.join(rootDir, "sample-data"),
  dataDir: path.join(rootDir, "data"),
  port: intEnv("PORT", 4173),
  requestTimeoutMs: intEnv("REQUEST_TIMEOUT_MS", 20000),
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || "",
    email: process.env.JIRA_EMAIL || "",
    apiToken: process.env.JIRA_API_TOKEN || "",
  },
  ai: {
    enabledByDefault: boolEnv("AI_ENABLED_BY_DEFAULT", false),
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
  },
};

module.exports = config;
