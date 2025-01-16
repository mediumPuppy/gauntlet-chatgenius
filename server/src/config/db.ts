import dotenv from "dotenv";
import pool from "../config/database";

dotenv.config();

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("Error connecting to the database:", err);
  } else {
    console.log("Successfully connected to PostgreSQL database");
    release();
  }
});

export default pool;
