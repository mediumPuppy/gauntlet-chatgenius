import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  user: process.env.PGUSER ||  'chatgenius',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'chatgenius',
  password: process.env.PGPASSWORD || 'chatgenius',
  port: parseInt(process.env.PGPORT || '5432'),
});

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations', '002_create_direct_messages.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(sql);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration(); 