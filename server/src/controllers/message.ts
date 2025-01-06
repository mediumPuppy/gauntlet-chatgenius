import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  content: string;
  user_id: string;
  username: string;
  created_at: Date;
  channel_id?: string;
  dm_id?: string;
  sender_name: string;
  timestamp: Date;
}

export const createMessage = async (req: Request, res: Response): Promise<void> => {
  const { content, channelId, dmId } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    if (dmId) {
      // Verify user is part of the DM
      const dmCheck = await pool.query(
        `SELECT * FROM direct_messages 
         WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
        [dmId, userId]
      );
      if (dmCheck.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }
    } else if (channelId) {
      // Verify user is part of the channel
      const channelCheck = await pool.query(
        'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      if (channelCheck.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Must provide either channelId or dmId' });
      return;
    }

    const message = await pool.query(
      `INSERT INTO messages (id, content, user_id, channel_id, dm_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [uuidv4(), content, userId, channelId, dmId]
    );

    // Get sender info for the response
    const sender = await pool.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );

    const response = {
      ...message.rows[0],
      senderName: sender.rows[0].username
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Failed to create message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  const { channelId, dmId } = req.query;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!channelId && !dmId) {
    res.status(400).json({ error: 'Must provide either channelId or dmId' });
    return;
  }

  try {
    let messages;
    if (dmId) {
      // Verify user is part of the DM and get messages
      messages = await pool.query(
        `SELECT 
          m.*,
          u.username as sender_name,
          m.created_at as timestamp
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.dm_id = $1
         AND EXISTS (
           SELECT 1 FROM direct_messages dm
           WHERE dm.id = m.dm_id
           AND (dm.user1_id = $2 OR dm.user2_id = $2)
         )
         ORDER BY m.created_at DESC
         LIMIT 50`,
        [dmId, userId]
      );
    } else {
      // Verify user is part of the channel and get messages
      messages = await pool.query(
        `SELECT 
          m.*,
          u.username as sender_name,
          m.created_at as timestamp
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.channel_id = $1
         AND EXISTS (
           SELECT 1 FROM channel_members cm
           WHERE cm.channel_id = m.channel_id
           AND cm.user_id = $2
         )
         ORDER BY m.created_at DESC
         LIMIT 50`,
        [channelId, userId]
      );
    }

    // Transform the messages to match the client's expected format
    const formattedMessages = messages.rows.map((msg: Message) => ({
      id: msg.id,
      content: msg.content,
      userId: msg.user_id,
      channelId: msg.channel_id,
      dmId: msg.dm_id,
      senderName: msg.sender_name,
      timestamp: new Date(msg.timestamp).getTime()
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Failed to get messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
}; 