import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const globalForDb = globalThis as unknown as {
  __pgPool?: pg.Pool;
};

export const pool =
  globalForDb.__pgPool ??
  new pg.Pool({
    connectionString,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__pgPool = pool;
}

export const db = drizzle(pool, { schema });
