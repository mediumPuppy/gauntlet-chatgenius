import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.PGUSER || 'chatgenius',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'chatgenius',
  password: process.env.PGPASSWORD || 'chatgenius',
  port: parseInt(process.env.PGPORT || '5432'),
});

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Successfully connected to PostgreSQL database');
    release();
  }
});

export default pool; 