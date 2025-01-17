import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../config/database";
import { User } from "../models/user";
import { AuthRequest } from "../middleware/auth";

interface DMResponse {
  id: string;
  other_username: string;
  other_user_id: string;
  created_at: string;
  last_message?: {
    content: string;
    created_at: string;
  };
}

export const startDM = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  const { targetUserId } = req.body;
  const userId = req.user.id;

  try {
    // Check if users are the same
    if (userId === targetUserId) {
      return res.status(400).json({ error: "Cannot start DM with yourself" });
    }

    // Check if target user exists
    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [
      targetUserId,
    ]);

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "Target user not found" });
    }

    // Check if DM already exists
    const existingDM = await pool.query(
      `SELECT dm.*, u.username as other_username
       FROM direct_messages dm
       JOIN users u ON (CASE 
         WHEN dm.user1_id = $1 THEN dm.user2_id
         ELSE dm.user1_id
       END) = u.id
       WHERE (user1_id = $1 AND user2_id = $2) 
       OR (user1_id = $2 AND user2_id = $1)`,
      [userId, targetUserId],
    );

    if (existingDM.rows.length > 0) {
      const dm = existingDM.rows[0];
      return res.status(200).json({
        id: dm.id,
        other_username: dm.other_username,
        other_user_id: dm.user1_id === userId ? dm.user2_id : dm.user1_id,
        created_at: dm.created_at,
      });
    }

    // Create new DM
    const dmId = uuidv4();
    const newDM = await pool.query(
      `INSERT INTO direct_messages (id, user1_id, user2_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [dmId, userId, targetUserId],
    );

    // Get other user's info
    const otherUser = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [targetUserId],
    );

    res.status(201).json({
      id: newDM.rows[0].id,
      other_username: otherUser.rows[0].username,
      other_user_id: targetUserId,
      created_at: newDM.rows[0].created_at,
    });
  } catch (error) {
    console.error("Error in startDM:", error);
    res.status(500).json({ error: "Failed to start DM" });
  }
};

export const getUserDMs = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "User not authenticated" });
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
        END as other_user_id,
        (
          SELECT json_build_object(
            'content', m.content,
            'created_at', m.created_at
          )
          FROM messages m
          WHERE m.dm_id = dm.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message
      FROM direct_messages dm
      JOIN users u1 ON dm.user1_id = u1.id
      JOIN users u2 ON dm.user2_id = u2.id
      WHERE dm.user1_id = $1 OR dm.user2_id = $1
      ORDER BY (
        SELECT m.created_at
        FROM messages m
        WHERE m.dm_id = dm.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) DESC NULLS LAST`,
      [req.user.id],
    );

    res.json(dms.rows);
  } catch (error) {
    console.error("Error in getUserDMs:", error);
    res.status(500).json({ error: "Failed to get DMs" });
  }
};

export const getDMById = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "User not authenticated" });
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
      [userId, dmId],
    );

    if (dm.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "DM not found or you do not have access" });
    }

    res.json({
      id: dm.rows[0].id,
      other_username: dm.rows[0].other_username,
      other_user_id: dm.rows[0].other_user_id,
      created_at: dm.rows[0].created_at,
    });
  } catch (error) {
    console.error("Error in getDMById:", error);
    res.status(500).json({ error: "Failed to get DM details" });
  }
};

export const getDMMessages = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  const dmId = req.params.id;
  const userId = req.user.id;

  try {
    // First verify the user has access to this DM
    const dmCheck = await pool.query(
      "SELECT * FROM direct_messages WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)",
      [dmId, userId],
    );

    if (dmCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "Not authorized to access this DM" });
    }

    // Get messages with reactions and reply information
    const messages = await pool.query(
      `WITH reaction_groups AS (
        SELECT 
          message_id,
          emoji,
          array_agg(user_id::text) as user_ids
        FROM message_reactions
        GROUP BY message_id, emoji
      )
      SELECT 
        m.id,
        m.content,
        m.user_id as "userId",
        m.dm_id as "dmId",
        u.username as "senderName",
        m.created_at as timestamp,
        m.has_replies as "hasReplies",
        m.reply_count as "replyCount",
        m.parent_id as "parentId",
        COALESCE(
          jsonb_object_agg(
            rg.emoji,
            rg.user_ids
          ) FILTER (WHERE rg.emoji IS NOT NULL),
          '{}'::jsonb
        ) as reactions
      FROM messages m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN reaction_groups rg ON m.id = rg.message_id
      WHERE m.dm_id = $1
      AND m.parent_id IS NULL
      GROUP BY m.id, u.username
      ORDER BY m.created_at ASC`,
      [dmId],
    );

    res.json(messages.rows);
  } catch (error) {
    console.error("Error in getDMMessages:", error);
    res.status(500).json({ error: "Failed to get DM messages" });
  }
};
