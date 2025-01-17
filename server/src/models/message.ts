import pool from "../config/database";

export interface Message {
  id: string;
  content: string;
  userId: string;
  channelId?: string;
  dmId?: string;
  senderName: string;
  timestamp: number;
  parentId?: string;
  hasReplies?: boolean;
  replyCount?: number;
}

interface CreateMessageData {
  channelId: string;
  userId: string;
  content: string;
}

export const messageQueries = {
  async getChannelMessages(channelId: string): Promise<Message[]> {
    const result = await pool.query(
      `SELECT 
        m.id,
        m.content,
        m.user_id,
        m.channel_id,
        m.dm_id,
        u.username as sender_name,
        m.created_at as timestamp,
        m.has_replies,
        m.reply_count,
        m.parent_id
       FROM messages m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.channel_id = $1 
       ORDER BY m.created_at ASC
       LIMIT 50`,
      [channelId],
    );

    // Transform to match client format
    return result.rows.map((msg) => ({
      id: msg.id,
      content: msg.content,
      userId: msg.user_id,
      channelId: msg.channel_id,
      dmId: msg.dm_id,
      senderName: msg.sender_name,
      timestamp: new Date(msg.timestamp).getTime(),
      hasReplies: msg.has_replies,
      replyCount: msg.reply_count,
      parentId: msg.parent_id
    }));
  },

  async createMessage(data: CreateMessageData): Promise<Message> {
    // First verify user is member of channel
    const memberCheck = await pool.query(
      "SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2",
      [data.channelId, data.userId],
    );

    if (memberCheck.rows.length === 0) {
      throw new Error("Not a member of this channel");
    }

    // Create message
    const result = await pool.query(
      `INSERT INTO messages (channel_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, channel_id, user_id, content, created_at`,
      [data.channelId, data.userId, data.content],
    );

    // Get username for response
    const userResult = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [data.userId],
    );

    // Transform to match client format
    return {
      id: result.rows[0].id,
      content: result.rows[0].content,
      userId: result.rows[0].user_id,
      channelId: result.rows[0].channel_id,
      senderName: userResult.rows[0].username,
      timestamp: new Date(result.rows[0].created_at).getTime(),
    };
  },
};
