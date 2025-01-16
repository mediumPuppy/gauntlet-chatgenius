import pool from "../config/database";

export interface User {
  id: string;
  email: string;
  username: string;
  created_at: Date;
  last_seen?: Date;
  is_online?: boolean;
}

export interface UserWithPassword extends User {
  password_hash: string;
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
  async searchOrganizationUsers(
    query: string,
    organizationId: string,
    excludeUserId: string,
  ): Promise<User[]> {
    const result = await pool.query(
      `SELECT DISTINCT u.id, u.username, u.email, u.created_at 
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1
       AND (u.username ILIKE $2 OR u.email ILIKE $2) 
       AND u.id != $3 
       LIMIT 10`,
      [organizationId, `%${query}%`, excludeUserId],
    );
    return result.rows;
  },

  async getUserById(id: string): Promise<User | null> {
    const result = await pool.query(
      "SELECT id, username, email, created_at FROM users WHERE id = $1",
      [id],
    );
    return result.rows[0] || null;
  },

  async getUserOrganizations(
    userId: string,
  ): Promise<{ organization_id: string; role: string }[]> {
    const result = await pool.query(
      "SELECT organization_id, role FROM organization_members WHERE user_id = $1",
      [userId],
    );
    return result.rows;
  },

  async getOrganizationMembers(
    organizationId: string,
  ): Promise<(User & { role: string })[]> {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.created_at, om.role
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY u.username`,
      [organizationId],
    );
    return result.rows;
  },

  async updatePresence(userId: string, isOnline: boolean): Promise<void> {
    await pool.query(
      `UPDATE users 
       SET is_online = $1, last_seen = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [isOnline, userId],
    );
  },

  async getUserPresence(
    userId: string,
  ): Promise<{ is_online: boolean; last_seen: Date } | null> {
    const result = await pool.query(
      "SELECT is_online, last_seen FROM users WHERE id = $1",
      [userId],
    );
    return result.rows[0] || null;
  },

  async getOrganizationMemberPresence(
    organizationId: string,
  ): Promise<{ user_id: string; is_online: boolean; last_seen: Date }[]> {
    const result = await pool.query(
      `SELECT u.id as user_id, u.is_online, u.last_seen
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1`,
      [organizationId],
    );
    return result.rows;
  },
};
