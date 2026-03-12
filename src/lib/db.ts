import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
const pool = connectionString ? new Pool({ connectionString }) : null;

export const isDatabaseConfigured = Boolean(connectionString);

interface QueryResult<T> {
  rows: T[];
}

export const query = async <T = Record<string, unknown>>(
  text: string,
  params?: readonly unknown[],
) => {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  return pool.query(text, params) as Promise<QueryResult<T>>;
};

export default pool;
