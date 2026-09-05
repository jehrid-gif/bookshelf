import { Pool, type QueryResultRow, type PoolClient } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __booklibPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global.__booklibPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add it in your Vercel project's Environment Variables."
      );
    }
    global.__booklibPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return global.__booklibPool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const pool = getPool();
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// For multi-statement operations that must all succeed or all roll back
// (the debug-page restore/wipe tools, notably) — a dedicated client held for
// BEGIN/COMMIT/ROLLBACK rather than the pool's per-query connections.
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
