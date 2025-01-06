import { Pool } from 'pg';
import { config } from '../config/database';

const pool = new Pool(config);

export interface User {
  id: string;
  email: string;
  username: string;
  created_at: Date;
}

export interface CreateUserDTO {
  email: string;
  username: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export const userQueries = {
  async searchUsers(query: string, excludeUserId: string): Promise<User[]> {
    const result = await pool.query(
      `SELECT id, username, email, created_at 
       FROM users 
       WHERE (username ILIKE $1 OR email ILIKE $1) 
       AND id != $2 
       LIMIT 10`,
      [`%${query}%`, excludeUserId]
    );
    return result.rows;
  },

  async getUserById(id: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }
}; 