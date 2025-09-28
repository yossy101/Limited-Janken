import { createPool, PoolClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const connectionString = Deno.env.get("SUPABASE_DB_URL") ?? Deno.env.get("DATABASE_URL");

if (!connectionString) {
  throw new Error("SUPABASE_DB_URL (or DATABASE_URL) is required for transactional access");
}

const pool = createPool(connectionString, 5, true);

export type TransactionClient = PoolClient;

export const withTransaction = async <T>(handler: (client: TransactionClient) => Promise<T>): Promise<T> => {
  const connection = await pool.connect();
  try {
    await connection.queryObject("begin");
    const result = await handler(connection);
    await connection.queryObject("commit");
    return result;
  } catch (error) {
    await connection.queryObject("rollback").catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
};

export const selectOne = async <T>(
  client: TransactionClient,
  query: string,
  params: unknown[]
): Promise<T | null> => {
  const result = await client.queryObject<T>({ text: query, args: params });
  return result.rows[0] ?? null;
};

export const selectMany = async <T>(
  client: TransactionClient,
  query: string,
  params: unknown[]
): Promise<T[]> => {
  const result = await client.queryObject<T>({ text: query, args: params });
  return result.rows as T[];
};

export const nowIso = () => new Date().toISOString();
