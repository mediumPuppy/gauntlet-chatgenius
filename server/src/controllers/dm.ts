import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { User } from '../models/user';
import { AuthRequest } from '../middleware/auth';

export const startDM = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  const { targetUserId } = req.body;
  const userId = req.user.id;
  
  try {
    // Check if DM already exists
    const existingDM = await pool.query(
      `SELECT * FROM direct_messages 
       WHERE (user1_id = $1 AND user2_id = $2) 
       OR (user1_id = $2 AND user2_id = $1)`,
      [userId, targetUserId]
    );

    if (existingDM.rows.length > 0) {
      res.status(200).json({ dmId: existingDM.rows[0].id });
      return;
    }

    // Create new DM
    const dmId = uuidv4();
    await pool.query(
      'INSERT INTO direct_messages (id, user1_id, user2_id) VALUES ($1, $2, $3)',
      [dmId, userId, targetUserId]
    );

    res.status(201).json({ dmId });
  } catch (error) {
    console.error('Error in startDM:', error);
    res.status(500).json({ error: 'Failed to start DM' });
  }
};

export const getUserDMs = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  try {
    const dms = await pool.query(
      `SELECT 
        dm.id,
        dm.created_at,
        CASE 
          WHEN dm.user1_id = $1 THEN u2.username
          ELSE u1.username
        END as other_username,
        CASE 
          WHEN dm.user1_id = $1 THEN u2.id
          ELSE u1.id
        END as other_user_id
      FROM direct_messages dm
      JOIN users u1 ON dm.user1_id = u1.id
      JOIN users u2 ON dm.user2_id = u2.id
      WHERE dm.user1_id = $1 OR dm.user2_id = $1
      ORDER BY dm.created_at DESC`,
      [req.user.id]
    );

    res.json(dms.rows);
  } catch (error) {
    console.error('Error in getUserDMs:', error);
    res.status(500).json({ error: 'Failed to get DMs' });
  }
};

export const getDMById = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  const dmId = req.params.id;
  const userId = req.user.id;

  try {
    const dm = await pool.query(
      `SELECT 
        dm.*,
        CASE 
          WHEN dm.user1_id = $1 THEN u2.username
          ELSE u1.username
        END as other_username,
        CASE 
          WHEN dm.user1_id = $1 THEN u2.id
          ELSE u1.id
        END as other_user_id
      FROM direct_messages dm
      JOIN users u1 ON dm.user1_id = u1.id
      JOIN users u2 ON dm.user2_id = u2.id
      WHERE dm.id = $2 AND (dm.user1_id = $1 OR dm.user2_id = $1)`,
      [userId, dmId]
    );

    if (dm.rows.length === 0) {
      res.status(404).json({ error: 'DM not found or you do not have access' });
      return;
    }

    // Format the response to match the channel format
    res.json({
      id: dm.rows[0].id,
      name: dm.rows[0].other_username,
      is_dm: true,
      created_at: dm.rows[0].created_at,
      other_user_id: dm.rows[0].other_user_id
    });
  } catch (error) {
    console.error('Error in getDMById:', error);
    res.status(500).json({ error: 'Failed to get DM details' });
  }
}; 