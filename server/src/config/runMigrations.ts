import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import initializeDatabase from './init-db';

dotenv.config();

console.log('Environment variables:', {
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME
});

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigrations() {
  try {
    // Initialize database first
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Create migrations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Get executed migrations
    const { rows: executedMigrations } = await pool.query(
      'SELECT name FROM migrations'
    );
    const executedFiles = new Set(executedMigrations.map(row => row.name));

    // Run pending migrations
    for (const file of files) {
      if (!executedFiles.has(file)) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query(
            'INSERT INTO migrations (name) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          console.log(`Migration ${file} completed successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`Error running migration ${file}:`, error);
          throw error;
        } finally {
          client.release();
        }
      }
    }

    console.log('All migrations completed');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations(); 
