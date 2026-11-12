import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

const pool = new Pool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
});

pool.on('error', (err) => {
  console.warn('[Database Pool]: Idle connection closed by server, will reconnect on next query:', err.message);
});

export const db = drizzle(pool, { schema });
export { pool };
