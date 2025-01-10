import { Pool } from 'pg';
import dotenv from 'dotenv';
import { config } from './database';

dotenv.config();

const pool = new Pool(config);

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