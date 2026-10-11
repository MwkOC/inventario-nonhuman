import pg from "pg";
import { config } from "./config.mjs";

const state = (globalThis.__nonhumanDb ||= { queue: Promise.resolve() });
async function connection() {
  const c = config();
  if (!state.db) {
    state.url = c.database;
    if (c.database.startsWith("sqlite:")) {
      const { DatabaseSync } = await import("node:sqlite");
      state.db = new DatabaseSync(c.database.slice(7));
      state.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;");
    } else {
      const url = new URL(c.database);
      if (c.production)
        for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
          url.searchParams.delete(key);
      state.db = new pg.Pool({
        connectionString: url.toString(),
        max: 3,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 10000,
        ...(c.production ? { ssl: { rejectUnauthorized: true } } : {}),
      });
    }
  }
  if (state.url !== c.database)
    throw new Error("Database cannot change within one process");
  return { db: state.db, sqlite: c.database.startsWith("sqlite:") };
}

export async function transaction(work) {
  // Serialize lab transactions across instances; revisit for substantially larger workloads.
  const previous = state.queue;
  let release;
  state.queue = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  let client, sqlite;
  try {
    const connectionInfo = await connection();
    sqlite = connectionInfo.sqlite;
    client = sqlite ? connectionInfo.db : await connectionInfo.db.connect();
    const query = async (sql, values = []) => {
      if (sqlite) {
        const statement = client.prepare(sql);
        return statement.columns().length
          ? statement.all(...values)
          : (statement.run(...values), []);
      }
      let i = 0;
      return (
        await client.query(
          sql.replace(/\?/g, () => `$${++i}`),
          values,
        )
      ).rows;
    };
    await query(sqlite ? "BEGIN IMMEDIATE" : "BEGIN");
    if (!sqlite) await query("SELECT pg_advisory_xact_lock(7812401)");
    const result = await work({
      query,
      sqlite,
      one: async (sql, args) => (await query(sql, args))[0],
    });
    await query("COMMIT");
    return result;
  } catch (error) {
    if (client) {
      try {
        sqlite ? client.exec("ROLLBACK") : await client.query("ROLLBACK");
      } catch {}
    }
    throw error;
  } finally {
    if (client && !sqlite) client.release();
    release();
  }
}

export async function closeDatabase() {
  if (state.db)
    await (state.url.startsWith("sqlite:") ? state.db.close() : state.db.end());
  state.db = null;
}
