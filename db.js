const { Pool } = require("pg");

let pool;
let dbConnected = false;
let warnedDatabaseFailure = false;

function getDatabaseUrl() {
  const configured = String(process.env.DATABASE_URL || "").trim();
  if (!configured) {
    throw new Error("DATABASE_URL environment variable is required; refusing to connect without explicit configuration.");
  }
  return configured;
}
function isConfigured() { return Boolean(String(process.env.DATABASE_URL || "").trim()); }

function getPool() {
  if (pool) return pool;
  const databaseUrl = getDatabaseUrl();
  const isProduction = process.env.NODE_ENV === "production";
  let connectionString = databaseUrl;
  let ssl = false;

  if (isProduction) {
    const ca = String(process.env.SUPABASE_CA_CERT || "").trim();
    if (!ca.includes("-----BEGIN CERTIFICATE-----") ||
        !ca.includes("-----END CERTIFICATE-----")) {
      throw new Error(
        "SUPABASE_CA_CERT must contain the Supabase PostgreSQL root CA certificate in PEM format."
      );
    }

    // node-postgres lets SSL query parameters in connectionString override the
    // explicit ssl object. Remove URL-level TLS options so the verified CA below
    // is the single authoritative production TLS configuration.
    const parsedUrl = new URL(databaseUrl);
    for (const key of ["ssl", "sslmode", "sslrootcert", "sslcert", "sslkey"]) {
      parsedUrl.searchParams.delete(key);
    }
    connectionString = parsedUrl.toString();
    ssl = { ca, rejectUnauthorized: true };
  }

  pool = new Pool({
    connectionString,
    ssl,
    max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, statement_timeout: 5000, query_timeout: 5000
  });
  pool.on("error", error => {
    dbConnected = false;
    console.error("[Database] Unexpected idle client error:", error.message);
  });
  return pool;
}

async function testConnection() {
  try {
    const client = await getPool().connect();
    try { await client.query("SELECT 1"); }
    finally { client.release(); }
    dbConnected = true;
    warnedDatabaseFailure = false;
    console.log("[Database] PostgreSQL connection established.");
    return true;
  } catch (error) {
    dbConnected = false;
    if (!warnedDatabaseFailure) {
      warnedDatabaseFailure = true;
      console.error("[Database] PostgreSQL connection failed:", error.message);
    }
    return false;
  }
}

function getStatus() {
  return { connected: dbConnected, configured: isConfigured(), source: isConfigured() ? "environment" : "missing" };
}

async function query(text, params = []) {
  try {
    const result = await getPool().query(text, params);
    dbConnected = true;
    return result;
  } catch (error) {
    dbConnected = false;
    throw error;
  }
}

async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    dbConnected = true;
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (rollbackError) { console.error("[Database] Transaction rollback failed:", rollbackError.message); }
    dbConnected = false;
    throw error;
  } finally { client.release(); }
}

module.exports = { getPool, query, withTransaction, isConfigured, getDatabaseUrl, testConnection, getStatus };
