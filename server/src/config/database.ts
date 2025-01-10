import { Pool, PoolConfig } from 'pg';

// Debug environment variables
console.log('Environment variables:', {
  DATABASE_URL: process.env.DATABASE_URL ? '[EXISTS]' : '[MISSING]',
  PGUSER: process.env.PGUSER ? '[EXISTS]' : '[MISSING]',
  PGPASSWORD: process.env.PGPASSWORD ? '[EXISTS]' : '[MISSING]',
  PGHOST: process.env.PGHOST ? '[EXISTS]' : '[MISSING]',
  PGPORT: process.env.PGPORT ? '[EXISTS]' : '[MISSING]',
  PGDATABASE: process.env.PGDATABASE ? '[EXISTS]' : '[MISSING]',
  NODE_ENV: process.env.NODE_ENV
});

// Force SSL in production
const isProduction = process.env.NODE_ENV === 'production';

export const config: PoolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    }
  : {
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      database: process.env.PGDATABASE,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
  };

// Debug final config
console.log('Final database config:', {
  connectionString: process.env.DATABASE_URL ? '[REDACTED]' : undefined,
  host: config.host || '[from connection string]',
  database: config.database || '[from connection string]',
  port: config.port || '[from connection string]',
  ssl: config.ssl
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

export { pool };
export default pool; 