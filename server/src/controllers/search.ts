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
      WITH RankedMessages AS (
        (
          SELECT
            m.id,
            m.content,
            m.created_at AS "createdAt",
            m.channel_id AS "channelId",
            m.dm_id AS "dmId",
            u.username AS "senderName",
            c.name AS "channelName",
            NULL AS "dmRecipientName",
            ROW_NUMBER() OVER (PARTITION BY COALESCE(m.channel_id, m.dm_id) ORDER BY m.created_at) as "messageIndex"
          FROM messages m
          JOIN users u ON m.user_id = u.id
          JOIN channels c ON c.id = m.channel_id
          JOIN channel_members cm ON (cm.channel_id = m.channel_id AND cm.user_id = $2)
          WHERE m.channel_id IS NOT NULL
            AND m.content ILIKE $1
        )
        UNION ALL
        (
          SELECT
            m.id,
            m.content,
            m.created_at AS "createdAt",
            m.channel_id AS "channelId",
            m.dm_id AS "dmId",
            u.username AS "senderName",
            NULL AS "channelName",
            CASE 
              WHEN dm.user1_id = $2 THEN u2.username
              ELSE u1.username
            END AS "dmRecipientName",
            ROW_NUMBER() OVER (PARTITION BY m.dm_id ORDER BY m.created_at) as "messageIndex"
          FROM messages m
          JOIN users u ON m.user_id = u.id
          JOIN direct_messages dm ON dm.id = m.dm_id
          JOIN users u1 ON u1.id = dm.user1_id
          JOIN users u2 ON u2.id = dm.user2_id
          WHERE m.dm_id IS NOT NULL
            AND (dm.user1_id = $2 OR dm.user2_id = $2)
            AND m.content ILIKE $1
        )
      )
      SELECT * FROM RankedMessages
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