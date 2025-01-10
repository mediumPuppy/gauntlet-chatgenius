import { Pool, PoolConfig } from 'pg';

export const config: PoolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    }
  : {
      user: process.env.PGUSER || 'chatgenius',
      password: process.env.PGPASSWORD || 'chatgenius',
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432'),
      database: process.env.PGDATABASE || 'chatgenius',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };

const pool = new Pool(config);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Add some debugging
console.log('Database config:', {
  connectionString: process.env.DATABASE_URL ? '[REDACTED]' : undefined,
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'chatgenius',
  port: process.env.PGPORT || '5432',
  ssl: config.ssl
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