import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

// Example controller function for searching messages across channels and DMs
export async function searchMessages(req: AuthRequest, res: Response) {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const searchTerm = req.query.q as string;

    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term (q) is required' });
    }

    // Perform a search across channel messages (where user is a member)
    // and DM messages (where user is one of the participants)
    // Limiting to 50 results, sorted by descending creation time
    const query = `
      (
        SELECT
          m.id,
          m.content,
          m.created_at AS "createdAt",
          m.channel_id AS "channelId",
          m.dm_id AS "dmId",
          u.username AS "senderName"
        FROM messages m
        JOIN users u ON m.user_id = u.id
        JOIN channel_members cm ON (cm.channel_id = m.channel_id AND cm.user_id = $2)
        WHERE m.channel_id IS NOT NULL
          AND m.content ILIKE $1
      )
      UNION
      (
        SELECT
          m.id,
          m.content,
          m.created_at AS "createdAt",
          m.channel_id AS "channelId",
          m.dm_id AS "dmId",
          u.username AS "senderName"
        FROM messages m
        JOIN users u ON m.user_id = u.id
        JOIN direct_messages dm ON dm.id = m.dm_id
        WHERE m.dm_id IS NOT NULL
          AND (dm.user1_id = $2 OR dm.user2_id = $2)
          AND m.content ILIKE $1
      )
      ORDER BY "createdAt" DESC
      LIMIT 50
    `;

    // The term for ILIKE should be wrapped in % for substring matching
    const ilikeTerm = `%${searchTerm}%`;

    // Execute the union query
    const result = await pool.query(query, [ilikeTerm, userId]);

    // You can transform rows here if needed (e.g., rename fields to match your front end)
    res.json(result.rows);
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
} 