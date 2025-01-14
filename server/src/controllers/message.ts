import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { vectorStoreService } from '../services/vectorStore';

interface Message {
  id: string;
  content: string;
  user_id: string;
  channel_id?: string;
  dm_id?: string;
  sender_name: string;
  timestamp: Date;
  created_at: Date;
  reactions: any;
  has_replies?: boolean;
  reply_count?: number;
}

export const createMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  const { content, channelId, dmId, parentId } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!content) {
    res.status(400).json({ error: 'Message content is required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let effectiveChannelId = channelId;

    // If this is a thread reply, get the parent message's channel
    if (parentId) {
      const parentResult = await client.query(
        'SELECT channel_id FROM messages WHERE id = $1',
        [parentId]
      );
      if (parentResult.rows.length === 0) {
        res.status(404).json({ error: 'Parent message not found' });
        return;
      }
      effectiveChannelId = parentResult.rows[0].channel_id;
    }

    // Now check channel membership with the correct channel ID
    if (effectiveChannelId) {
      const channelCheck = await client.query(
        'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [effectiveChannelId, userId]
      );
      
      if (channelCheck.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized to send messages in this channel' });
        return;
      }

      // Get workspace ID for the channel
      const workspaceResult = await client.query(
        'SELECT organization_id FROM channels WHERE id = $1',
        [effectiveChannelId]
      );
      const workspaceId = workspaceResult.rows[0].organization_id;

      // Update vector stores asynchronously
      Promise.all([
        // Update channel-specific store
        vectorStoreService.addDocuments(
          { type: 'channel', channelId },
          [content]
        ),
        // Update workspace-level store
        vectorStoreService.addDocuments(
          { type: 'workspace', workspaceId },
          [content]
        )
      ]).catch(error => {
        console.error('Error updating vector stores:', error);
      });
    }

    if (dmId) {
      // Verify user is part of the DM
      const dmCheck = await client.query(
        `SELECT * FROM direct_messages 
         WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
        [dmId, userId]
      );
      
      if (dmCheck.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized to send messages in this DM' });
        return;
      }
    } else if (channelId) {
      // Verify user is part of the channel
      const channelCheck = await client.query(
        'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
      
      if (channelCheck.rows.length === 0) {
        res.status(403).json({ error: 'Not authorized to send messages in this channel' });
        return;
      }
    } else {
      res.status(400).json({ error: 'Must provide either channelId or dmId' });
      return;
    }

    const messageId = uuidv4();
    const result = await client.query(
      `INSERT INTO messages (id, content, user_id, channel_id, dm_id, parent_id, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING *`,
      [messageId, content, userId, effectiveChannelId, dmId, parentId]
    );
    // 2. If this is a reply (parentId provided), update parent counters
    if (parentId) {
      await client.query(
        `UPDATE messages
         SET has_replies = true,
             reply_count = reply_count + 1
         WHERE id = $1`,
        [parentId]
      );
    }
    // Get sender info
    const sender = await client.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );

    const response = {
      id: result.rows[0].id,
      content: result.rows[0].content,
      userId: result.rows[0].user_id,
      channelId: result.rows[0].channel_id,
      dmId: result.rows[0].dm_id,
      senderName: sender.rows[0].username,
      timestamp: result.rows[0].created_at
    };

    // Add message to vector store if it's in a channel (not DM)
    if (effectiveChannelId) {
      try {
        // Add to channel's vector store
        await vectorStoreService.addDocuments(
          { type: 'channel', channelId: effectiveChannelId },
          [content]
        );

        // Get workspace ID and add to workspace's vector store
        const workspaceResult = await client.query(
          'SELECT organization_id FROM channels WHERE id = $1',
          [effectiveChannelId]
        );
        
        if (workspaceResult.rows.length > 0) {
          await vectorStoreService.addDocuments(
            { type: 'workspace', workspaceId: workspaceResult.rows[0].organization_id },
            [content]
          );
        }
      } catch (vectorError) {
        console.error('Error adding message to vector store:', vectorError);
        // Don't fail the message creation if vector store update fails
      }
    }

    await client.query('COMMIT');
    res.status(201).json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  } finally {
    client.release();
  }
};

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
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
          COALESCE(
            jsonb_object_agg(
              mr.emoji,
              array_agg(mr.user_id::text)
            ) FILTER (WHERE mr.emoji IS NOT NULL),
            '{}'::jsonb
          ) as reactions
         FROM messages m
         JOIN users u ON m.user_id = u.id
         LEFT JOIN message_reactions mr ON m.id = mr.message_id
         WHERE m.dm_id = $1
         AND m.parent_id IS NULL
         AND EXISTS (
           SELECT 1 FROM direct_messages dm
           WHERE dm.id = m.dm_id
           AND (dm.user1_id = $2 OR dm.user2_id = $2)
         )
         GROUP BY m.id, u.username
         ORDER BY m.created_at DESC
         LIMIT 50`,
        [dmId, userId]
      );
    } else {
      // Verify user is part of the channel and get messages
      messages = await pool.query(
        `WITH reaction_groups AS (
          SELECT 
            message_id,
            emoji,
            array_agg(user_id::text) as user_ids
          FROM message_reactions
          GROUP BY message_id, emoji
        )
        SELECT 
          m.*,
          u.username as sender_name,
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
        WHERE m.channel_id = $1 
        AND m.parent_id IS NULL
        AND EXISTS (
          SELECT 1 FROM channel_members cm
          WHERE cm.channel_id = m.channel_id
          AND cm.user_id = $2
        )
        GROUP BY m.id, u.username, m.created_at, m.content, m.user_id, m.channel_id, m.dm_id
        ORDER BY m.created_at DESC
        LIMIT 50`,
        [channelId, userId]
      );
    }

    const formattedMessages = messages.rows.map((msg: Message) => {

      // Parse reactions if they're a string
      let parsedReactions = msg.reactions;
      if (typeof msg.reactions === 'string') {
        try {
          parsedReactions = JSON.parse(msg.reactions);
        } catch (e) {
          console.error('Failed to parse reactions for message:', msg.id, e);
          parsedReactions = {};
        }
      }

      const formatted = {
        id: msg.id,
        content: msg.content,
        userId: msg.user_id,
        channelId: msg.channel_id,
        dmId: msg.dm_id,
        senderName: msg.sender_name,
        timestamp: msg.created_at,
        reactions: parsedReactions || {},  // Ensure we always have an object
        hasReplies: msg.has_replies,
        replyCount: msg.reply_count
      };

      return formatted;
    });

    res.json(formattedMessages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

export const getMainChatMessages = async (req: AuthRequest, res: Response) => {
  try {
    // Example query: fetch top-level messages (no parent)
    const { rows } = await pool.query(
      `SELECT * 
       FROM messages 
       WHERE channel_id = $1 
         AND parent_id IS NULL
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.query.channelId] // or however you pass the channelId
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching main chat messages:', error);
    res.status(500).json({ error: 'Failed to fetch main-chat messages' });
  }
};

export const getThreadMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 1. Fetch the parent message with reactions
    const parentResult = await pool.query(
      `WITH reaction_groups AS (
        SELECT 
          message_id,
          emoji,
          array_agg(user_id::text) as user_ids
        FROM message_reactions
        GROUP BY message_id, emoji
      )
      SELECT 
        m.*,
        u.username as sender_name,
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
      WHERE m.id = $1
      AND EXISTS (
        SELECT 1 FROM channel_members cm 
        WHERE cm.channel_id = m.channel_id 
        AND cm.user_id = $2
      )
      GROUP BY m.id, u.username`,
      [messageId, userId]
    );

    if (parentResult.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to view this thread' });
    }

    const parentRow = parentResult.rows[0];
    const parent = {
      id: parentRow.id,
      content: parentRow.content,
      userId: parentRow.user_id,
      channelId: parentRow.channel_id,
      senderName: parentRow.sender_name,
      timestamp: parentRow.created_at,
      reactions: parentRow.reactions || {},
      hasReplies: parentRow.has_replies,
      replyCount: parentRow.reply_count
    };

    // 2. Fetch replies with reactions
    const repliesResult = await pool.query(
      `WITH reaction_groups AS (
        SELECT 
          message_id,
          emoji,
          array_agg(user_id::text) as user_ids
        FROM message_reactions
        GROUP BY message_id, emoji
      )
      SELECT 
        m.*,
        u.username as sender_name,
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
      WHERE m.parent_id = $1
      GROUP BY m.id, u.username
      ORDER BY m.created_at ASC`,
      [messageId]
    );

    const replies = repliesResult.rows.map(row => ({
      id: row.id,
      content: row.content,
      userId: row.user_id,
      channelId: row.channel_id,
      senderName: row.sender_name,
      timestamp: row.created_at,
      reactions: row.reactions || {},
      parentId: row.parent_id
    }));

    res.json({ parent, replies });
  } catch (error) {
    console.error('Error fetching thread messages:', error);
    res.status(500).json({ error: 'Failed to fetch thread messages' });
  }
};

// export const deleteMessage = async (req: AuthRequest, res: Response) => {
//   const { messageId } = req.params;
//   const userId = req.user?.id;

//   const client = await pool.connect();
//   try {
//     await client.query('BEGIN');

//     // 1. Get the message info
//     const msgResult = await client.query(
//       'SELECT parent_id FROM messages WHERE id = $1',
//       [messageId]
//     );
//     if (msgResult.rows.length === 0) {
//       await client.query('ROLLBACK');
//       return res.status(404).json({ error: 'Message not found' });
//     }
//     const { parent_id } = msgResult.rows[0];

//     // 2. Actually delete the message
//     await client.query('DELETE FROM messages WHERE id = $1', [messageId]);

//     // 3. If it was a reply, decrement parent counters
//     if (parent_id) {
//       await client.query(
//         `UPDATE messages
//          SET reply_count = reply_count - 1
//          WHERE id = $1`,
//         [parent_id]
//       );

//       // Check if we should reset has_replies to false
//       const checkResult = await client.query(
//         `SELECT reply_count
//          FROM messages
//          WHERE id = $1`,
//         [parent_id]
//       );
//       if (checkResult.rows[0].reply_count <= 0) {
//         await client.query(
//           `UPDATE messages
//            SET has_replies = false
//            WHERE id = $1`,
//           [parent_id]
//         );
//       }
//     }

//     await client.query('COMMIT');
//     res.json({ success: true });
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('Error deleting message:', error);
//     res.status(500).json({ error: 'Failed to delete message' });
//   } finally {
//     client.release();
//   }
// }; 