import * as fs from "fs";
import * as path from "path";
import pool from "../config/database";

async function runMigration() {
  try {
    const migrationPath = path.join(
      __dirname,
      "migrations",
      "002_create_direct_messages.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    await pool.query(sql);
    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

runMigration();
