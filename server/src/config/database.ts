import { Pool, PoolConfig } from 'pg';

export const config: PoolConfig = {
  user: process.env.DB_USER || 'chatgenius',
  password: process.env.DB_PASSWORD || 'chatgenius',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'chatgenius',
};

const pool = new Pool(config);

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