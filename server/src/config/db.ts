import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'chatgenius',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chatgenius',
  password: process.env.DB_PASSWORD || 'chatgenius',
  port: parseInt(process.env.DB_PORT || '5432'),
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