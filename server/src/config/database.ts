import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const parseDbUrl = (url: string) => {
  const pattern = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
  const matches = url.match(pattern);
  if (!matches) throw new Error('Invalid database URL format');
  const [, user, password, host, port, database] = matches;
  return { user, password, host, port: parseInt(port), database };
};

export const config: PoolConfig = process.env.DATABASE_URL
  ? {
      ...parseDbUrl(process.env.DATABASE_URL),
      ssl: {
        rejectUnauthorized: false
      },
    }
  : {
      user: process.env.DB_USER || 'chatgenius',
      password: process.env.DB_PASSWORD || 'chatgenius',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'chatgenius',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    };

// Add some debugging
console.log('Database config:', {
  connectionString: process.env.DATABASE_URL ? '[REDACTED]' : undefined,
  host: config.host,
  database: config.database,
  ssl: config.ssl,
  timeouts: {
    connection: config.connectionTimeoutMillis,
    statement: config.statement_timeout
  }
});

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Database connection successful');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

export default pool; 