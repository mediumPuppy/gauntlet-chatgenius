import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';

export const startDM = async (req: Request, res: Response) => {
  const { userId, targetUserId } = req.body;
  
  try {
    // Check if DM already exists
    const existingDM = await db.query(
      `SELECT * FROM direct_messages 
       WHERE (user1_id = $1 AND user2_id = $2) 
       OR (user1_id = $2 AND user2_id = $1)`,
      [userId, targetUserId]
    );

    if (existingDM.rows.length > 0) {
      return res.status(200).json({ dmId: existingDM.rows[0].id });
    }

    // Create new DM
    const dmId = uuidv4();
    await db.query(
      'INSERT INTO direct_messages (id, user1_id, user2_id) VALUES ($1, $2, $3)',
      [dmId, userId, targetUserId]
    );

    res.status(201).json({ dmId });
  } catch (error) {
    console.error('Failed to start DM:', error);
    res.status(500).json({ error: 'Failed to start DM' });
  }
};

export const getUserDMs = async (req: Request, res: Response) => {
  const userId = req.user.id; // From auth middleware
  
  try {
    const dms = await db.query(
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
       WHERE dm.user1_id = $1 OR dm.user2_id = $1`,
      [userId]
    );

    res.json(dms.rows);
  } catch (error) {
    console.error('Failed to get DMs:', error);
    res.status(500).json({ error: 'Failed to get DMs' });
  }
}; 