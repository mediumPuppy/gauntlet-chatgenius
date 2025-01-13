import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { WebSocketHandler } from '../websocket/handler';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from 'crypto';

// Create a factory function that takes the WebSocket handler
export const createAIResponseController = (wsHandler: WebSocketHandler) => {
  return {
    generateAIResponse: async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        const { mentionedUsername, triggeringMessage, recentMessages } = req.body;
        console.log('AI Response Triggered for:', mentionedUsername);
        console.log('Triggering Message:', triggeringMessage);
        console.log('Recent Messages:', recentMessages);

        // Check if mentioned user has AI enabled
        const userResult = await pool.query(
          'SELECT id, ai_enabled FROM users WHERE username = $1',
          [mentionedUsername]
        );
        console.log('User AI Status:', userResult.rows[0]?.ai_enabled);

        if (!userResult.rows.length || !userResult.rows[0].ai_enabled) {
          console.log('AI not enabled for user:', mentionedUsername);
          res.status(200).json({ message: 'AI not enabled for user' });
          return;
        }

        // Generate AI response asynchronously
        generateAndSendResponse(
          wsHandler,
          userResult.rows[0].id,
          mentionedUsername,
          triggeringMessage,
          recentMessages
        );

        console.log('AI response generation triggered successfully');
        res.status(200).json({ message: 'AI response generation triggered' });
      } catch (error) {
        console.error('Error in generateAIResponse:', error);
        res.status(500).json({ error: 'Failed to generate AI response' });
      }
    }
  };
};

async function generateAndSendResponse(
  wsHandler: WebSocketHandler,
  userId: string,
  username: string,
  triggeringMessage: any,
  recentMessages: any[]
) {
  try {
    console.log('Generating AI response for user:', username);
    // TODO: Implement Pinecone + LangSmith integration here
    const aiResponse = "AI response placeholder";
    const messageId = uuidv4() as UUID;
    
    // Save to database first
    await pool.query(
      "INSERT INTO messages (id, content, user_id, channel_id, dm_id, parent_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())",
      [
        messageId,
        aiResponse,
        userId,
        triggeringMessage.isDM ? null : triggeringMessage.channelId,
        triggeringMessage.isDM ? triggeringMessage.channelId : null,
        triggeringMessage.parentId || null,
      ]
    );

    // Then send via WebSocket
    await wsHandler.sendMessage({
      type: 'message',
      content: aiResponse,
      channelId: triggeringMessage.channelId,
      id: messageId,
      senderId: userId,
      senderName: username,
      isDM: !!triggeringMessage.dmId,
      parentId: triggeringMessage.parentId
    });
    
    console.log('AI response sent and saved successfully');
  } catch (error) {
    console.error('Error generating AI response:', error);
  }
} 