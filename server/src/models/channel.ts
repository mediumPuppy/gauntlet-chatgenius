import { Pool } from 'pg';
import { config } from '../config/database';

const pool = new Pool(config);

export interface Channel {
  id: string;
  name: string;
  is_dm: boolean;
  created_at: Date;
}

export interface ChannelMember {
  channel_id: string;
  user_id: string;
}

export const channelQueries = {
  async createChannel(name: string, isDm: boolean = false): Promise<Channel> {
    const result = await pool.query(
      'INSERT INTO channels (name, is_dm) VALUES ($1, $2) RETURNING *',
      [name, isDm]
    );
    return result.rows[0];
  },

  async getChannel(id: string): Promise<Channel | null> {
    const result = await pool.query('SELECT * FROM channels WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async listChannels(): Promise<Channel[]> {
    const result = await pool.query('SELECT * FROM channels WHERE is_dm = false ORDER BY created_at DESC');
    return result.rows;
  },

  async addMember(channelId: string, userId: string): Promise<void> {
    await pool.query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
      [channelId, userId]
    );
  },

  async getMembers(channelId: string): Promise<string[]> {
    const result = await pool.query(
      'SELECT user_id FROM channel_members WHERE channel_id = $1',
      [channelId]
    );
    return result.rows.map(row => row.user_id);
  },

  async createDM(userIds: [string, string]): Promise<Channel> {
    // Start a transaction to ensure atomicity
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create DM channel
      const channelResult = await client.query(
        'INSERT INTO channels (name, is_dm) VALUES ($1, true) RETURNING *',
        [`dm-${userIds[0]}-${userIds[1]}`]
      );
      
      // Add both users to the channel
      await client.query(
        'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2), ($1, $3)',
        [channelResult.rows[0].id, userIds[0], userIds[1]]
      );
      
      await client.query('COMMIT');
      return channelResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async getUserChannels(userId: string): Promise<Channel[]> {
    const result = await pool.query(
      `SELECT c.* FROM channels c
       INNER JOIN channel_members cm ON c.id = cm.channel_id
       WHERE cm.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );
    return result.rows;
  }
}; 