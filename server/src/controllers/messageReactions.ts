import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

export async function addReaction(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    // First check if the reaction exists
    const existingReaction = await pool.query(
      `SELECT id FROM message_reactions 
       WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, userId, emoji]
    );

    let action: 'added' | 'removed';
    
    if (existingReaction.rows.length > 0) {
      // If reaction exists, remove it
      await pool.query(
        `DELETE FROM message_reactions 
         WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [messageId, userId, emoji]
      );
      action = 'removed';
    } else {
      // If reaction doesn't exist, add it
      await pool.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [messageId, userId, emoji]
      );
      action = 'added';
    }

    // Get the channel/DM ID and parentId for this message
    const message = await pool.query(
      'SELECT channel_id, dm_id, parent_id FROM messages WHERE id = $1',
      [messageId]
    );

    if (message.rows.length > 0) {
      const { channel_id, dm_id, parent_id } = message.rows[0];
      // Emit WebSocket event
      global.wss?.handleReaction(null, {
        type: 'reaction',
        messageId,
        userId,
        emoji,
        action,
        parentId: parent_id
      });
    }

    return res.json({ success: true, action });
  } catch (err) {
    console.error('Error toggling reaction:', err);
    return res.status(500).json({ error: 'Failed to toggle reaction' });
  }
}

export async function removeReaction(req: AuthRequest, res: Response) {
  try {
    // user must be authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { messageId } = req.params;
    const { emoji } = req.body; // or pass as query
    const userId = req.user.id;

    const result = await pool.query(
      `DELETE FROM message_reactions
       WHERE message_id = $1 AND user_id = $2 AND emoji = $3
       RETURNING *`,
      [messageId, userId, emoji]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    // Optionally broadcast a websocket event

    return res.json({ success: true });
  } catch (err) {
    console.error('Error removing reaction:', err);
    return res.status(500).json({ error: 'Failed to remove reaction' });
  }
} 