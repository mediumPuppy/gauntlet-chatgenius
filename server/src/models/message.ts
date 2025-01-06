import { Pool } from 'pg';
import { config } from '../config/database';

const pool = new Pool(config);

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: Date;
  username?: string;
}

interface CreateMessageData {
  channelId: string;
  userId: string;
  content: string;
}

export const messageQueries = {
  async getChannelMessages(channelId: string): Promise<Message[]> {
    const result = await pool.query(
      `SELECT m.*, u.username 
       FROM messages m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.channel_id = $1 
       ORDER BY m.created_at DESC 
       LIMIT 50`,
      [channelId]
    );
    return result.rows;
  },

  async createMessage(data: CreateMessageData): Promise<Message> {
    // First verify user is member of channel
    const memberCheck = await pool.query(
      'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [data.channelId, data.userId]
    );

    if (memberCheck.rows.length === 0) {
      throw new Error('Not a member of this channel');
    }

    // Create message
    const result = await pool.query(
      `INSERT INTO messages (channel_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, channel_id, user_id, content, created_at`,
      [data.channelId, data.userId, data.content]
    );

    // Get username for response
    const userResult = await pool.query(
      'SELECT username FROM users WHERE id = $1',
      [data.userId]
    );

    return {
      ...result.rows[0],
      username: userResult.rows[0].username
    };
  }
}; 