import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import {
  WebSocketClient,
  WebSocketMessage,
  ChatMessage,
  TypingMessage,
  PresenceMessage,
  ReactionMessage,
} from "./types";
import { messageQueries } from "../models/message";
import { channelQueries } from "../models/channel";
import { userQueries } from "../models/user";
import pool from "../config/database";
import { vectorStoreService } from "../services/vectorStore";
import { OpenAI } from "openai";
import crypto from "crypto";
import { createOpenAIClient } from "../utils/openai";

// Update WebSocketMessage type to include bot response fields
interface BotResponseMessage extends WebSocketMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  channelId: string;
  isDM: boolean;
  parentId?: string;
  timestamp: number;
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const clients = new Map<string, Set<WebSocketClient>>();
const userSockets = new Map<string, Set<WebSocketClient>>();

export class WebSocketHandler {
  constructor(private wss: WebSocketServer) {
    this.setupHeartbeat();

    // Extra logging on server-level errors
    wss.on("error", (error) => {
      console.error("WebSocketServer-level error:", error);
    });
  }

  private setupHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws: WebSocketClient) => {
        if (ws.isAlive === false) {
          console.error("Terminating stale WebSocket client (no heartbeat).");
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private async authenticateConnection(
    ws: WebSocketClient,
    token: string,
  ): Promise<boolean> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      ws.userId = decoded.id;
      ws.isAlive = true;

      if (!userSockets.has(ws.userId)) {
        userSockets.set(ws.userId, new Set());
      }
      userSockets.get(ws.userId)?.add(ws);

      await userQueries.updatePresence(ws.userId, true);
      await this.broadcastPresenceUpdate(ws.userId, true);
      return true;
    } catch (error) {
      console.error("WebSocket authentication failed:", error);
      ws.send(JSON.stringify({ type: "error", error: "Invalid token" }));
      ws.close();
      return false;
    }
  }

  private async broadcastPresenceUpdate(userId: string, isOnline: boolean) {
    try {
      const user = await pool.query(
        "SELECT username, last_seen FROM users WHERE id = $1",
        [userId],
      );
      if (user.rows.length === 0) return;

      // Get all organizations the user is part of
      const orgs = await pool.query(
        "SELECT organization_id FROM organization_members WHERE user_id = $1",
        [userId],
      );

      // Get all unique members from all organizations
      const memberSet = new Set<string>();
      for (const org of orgs.rows) {
        const members = await pool.query(
          "SELECT user_id FROM organization_members WHERE organization_id = $1",
          [org.organization_id],
        );
        members.rows.forEach((member) => memberSet.add(member.user_id));
      }

      // Remove the user themselves from the recipient list
      memberSet.delete(userId);

      const presenceMessage: PresenceMessage = {
        type: "presence",
        userId,
        username: user.rows[0].username,
        isOnline,
        lastSeen: user.rows[0].last_seen,
      };

      // Broadcast to all unique members
      memberSet.forEach((memberId) => {
        const memberSockets = userSockets.get(memberId);
        if (memberSockets) {
          memberSockets.forEach((socket) => {
            if (socket.readyState === socket.OPEN) {
              socket.send(JSON.stringify(presenceMessage));
            }
          });
        }
      });
    } catch (error) {
      console.error("Error broadcasting presence update:", error);
    }
  }

  private async handleMessage(ws: WebSocketClient, data: WebSocketMessage) {
    if (data.type === "auth") {
      const authenticated = await this.authenticateConnection(ws, data.token!);
      if (!authenticated) {
        console.error("Authentication failed.");
        return;
      }

      if (data.channelId && typeof data.channelId === "string") {
        if (data.isDM) {
          await this.handleDMJoin(ws, data.channelId);
        } else {
          await this.handleChannelJoin(ws, data.channelId);
        }
      }
      return;
    }

    if (!ws.userId) {
      ws.send(JSON.stringify({ type: "error", error: "Not authenticated" }));
      return;
    }

    switch (data.type) {
      case "message":
        await this.handleChatMessage(ws, data as ChatMessage);
        break;

      case "typing":
        await this.handleTypingMessage(ws, data as TypingMessage);
        break;

      case "reaction":
        await this.handleReaction(ws, data as ReactionMessage);
        break;

      default:
        console.error("Unknown message type:", data.type);
    }
  }

  private async handleChatMessage(ws: WebSocketClient, data: ChatMessage) {
    try {
      const user = await pool.query(
        "SELECT username FROM users WHERE id = $1",
        [ws.userId],
      );
      if (user.rows.length === 0) {
        ws.send(JSON.stringify({ type: "error", error: "User not found" }));
        return;
      }

      const message = {
        id: data.id,
        content: data.content,
        senderId: ws.userId,
        senderName: user.rows[0].username,
        timestamp: Date.now(),
        channelId: data.channelId,
        isDM: data.isDM,
        parentId: data.parentId,
      };

      if (data.isDM) {
        // Verify user is part of the DM
        const dmCheck = await pool.query(
          `SELECT * FROM direct_messages 
           WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
          [data.channelId, ws.userId],
        );

        if (dmCheck.rows.length === 0) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Not authorized for this DM",
            }),
          );
          return;
        }

        // Save DM message
        await pool.query(
          "INSERT INTO messages (id, content, user_id, dm_id, parent_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW())",
          [data.id, data.content, ws.userId, data.channelId, data.parentId],
        );

        // If this is a reply, update the parent message's metadata
        if (data.parentId) {
          await pool.query(
            `UPDATE messages 
             SET has_replies = true, 
                 reply_count = COALESCE(reply_count, 0) + 1 
             WHERE id = $1`,
            [data.parentId]
          );
        }

        // Broadcast to DM participants
        await this.broadcastToDM(data.channelId, {
          type: "message",
          ...message,
        });
      } else {
        // Verify user is part of the channel and get organization_id
        const channelCheck = await pool.query(
          `SELECT cm.*, c.organization_id 
           FROM channel_members cm 
           JOIN channels c ON cm.channel_id = c.id 
           WHERE cm.channel_id = $1 AND cm.user_id = $2`,
          [data.channelId, ws.userId],
        );

        if (channelCheck.rows.length === 0) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Not authorized for this channel",
            }),
          );
          return;
        }

        const organizationId = channelCheck.rows[0].organization_id;

        // Check for @bot mention before saving message
        const isBotMention = data.content.trim().startsWith('@bot');

        // Save message and broadcast first
        await pool.query(
          "INSERT INTO messages (id, content, user_id, channel_id, parent_id, created_at) VALUES ($1, $2, $3, $4, $5::uuid, NOW())",
          [data.id, data.content, ws.userId, data.channelId, data.parentId || null],
        );

        // If this is a reply, update the parent message's metadata
        if (data.parentId) {
          await pool.query(
            `UPDATE messages 
             SET has_replies = true, 
                 reply_count = COALESCE(reply_count, 0) + 1 
             WHERE id = $1`,
            [data.parentId]
          );
        }

        // Broadcast to channel members immediately
        await this.broadcastToChannel(data.channelId, {
          type: "message",
          ...message,
        });

        // Handle bot mention if present
        if (isBotMention) {
          await this.handleBotMessage(ws, data, organizationId);
        }

        // Only update vector stores if we have a valid organizationId
        if (organizationId) {
          setImmediate(async () => {
            console.log(`[VectorStore] Processing updates for channel ${data.channelId} and org ${organizationId}`);
            
            try {
              // Update channel vector store first
              await vectorStoreService.addDocuments(
                { type: "channel", channelId: data.channelId },
                [{
                  content: data.content,
                  userId: ws.userId!,
                  username: user.rows[0].username,
                  timestamp: new Date(),
                  channelName: channelCheck.rows[0].name,
                  messageType: data.parentId ? 'reply' : 'message',
                  parentMessageId: data.parentId
                }]
              );
              console.log(`[VectorStore] Successfully updated channel store for ${data.channelId}`);

              // Then update organization vector store
              await vectorStoreService.addDocuments(
                { type: "organization", organizationId },
                [{
                  content: data.content,
                  userId: ws.userId!,
                  username: user.rows[0].username,
                  timestamp: new Date(),
                  channelName: channelCheck.rows[0].name,
                  messageType: data.parentId ? 'reply' : 'message',
                  parentMessageId: data.parentId
                }]
              );
              console.log(`[VectorStore] Successfully updated organization store for ${organizationId}`);
            } catch (error) {
              console.error("[VectorStore] Error updating vector stores:", error);
            }
          });
        } else {
          console.warn(`[VectorStore] No organization found for channel ${data.channelId}`);
        }
      }
    } catch (error) {
      console.error("Error in handleChatMessage:", error);
      ws.send(JSON.stringify({ type: "error", error: "Failed to process message" }));
    }
  }

  private async handleTypingMessage(ws: WebSocketClient, data: TypingMessage) {
    try {
      const user = await pool.query(
        "SELECT username FROM users WHERE id = $1",
        [ws.userId],
      );
      if (user.rows.length === 0) return;

      const typingMessage: TypingMessage = {
        type: "typing",
        channelId: data.channelId,
        userId: ws.userId!,
        username: user.rows[0].username,
        isDM: data.isDM,
      };

      if (data.isDM) {
        await this.broadcastToDM(data.channelId, typingMessage);
      } else {
        await this.broadcastToChannel(data.channelId, typingMessage);
      }
    } catch (error) {
      console.error("Error handling typing message:", error);
    }
  }

  private async broadcastToChannel(
    channelId: string,
    message: WebSocketMessage | BotResponseMessage,
  ) {
    const channelClients = clients.get(channelId) || new Set();
    const messageStr = JSON.stringify(message);

    channelClients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(messageStr);
      }
    });
  }

  private async broadcastToDM(dmId: string, message: WebSocketMessage) {
    try {
      // Get DM participants
      const participants = await pool.query(
        "SELECT user1_id, user2_id FROM direct_messages WHERE id = $1",
        [dmId],
      );

      if (participants.rows.length === 0) return;

      const { user1_id, user2_id } = participants.rows[0];
      const messageStr = JSON.stringify(message);

      // Get sender ID based on message type
      let senderId: string | undefined;
      if (message.type === "message") {
        senderId = (message as ChatMessage).senderId;
      } else if (message.type === "typing") {
        senderId = (message as TypingMessage).userId;
      }

      // Send to all connected clients of both participants except the sender
      this.wss.clients.forEach((client: WebSocketClient) => {
        if (
          client.readyState === client.OPEN &&
          client.userId &&
          (client.userId === user1_id || client.userId === user2_id) &&
          (!senderId || client.userId !== senderId)
        ) {
          client.send(messageStr);
        }
      });
    } catch (error) {
      console.error("Error broadcasting to DM:", error);
    }
  }

  public async handleReaction(ws: WebSocketClient | null, data: ReactionMessage) {
    try {
      // Get channel/DM info for the message
      const message = await pool.query(
        "SELECT channel_id, dm_id FROM messages WHERE id = $1",
        [data.messageId]
      );

      if (message.rows.length === 0) {
        console.error("Message not found for reaction:", data.messageId);
        return;
      }

      const { channel_id, dm_id } = message.rows[0];

      // Create the reaction message without parentId
      const reactionMessage: ReactionMessage = {
        type: "reaction",
        messageId: data.messageId,
        userId: ws?.userId || data.userId || "",
        emoji: data.emoji,
        action: data.action,
        channelId: channel_id || "",
      };

      // Broadcast to appropriate channel or DM
      if (dm_id) {
        await this.broadcastToDM(dm_id, reactionMessage);
      } else if (channel_id) {
        await this.broadcastToChannel(channel_id, reactionMessage);
      }
    } catch (error) {
      console.error("Error handling reaction:", error);
      ws?.send(JSON.stringify({ 
        type: "error", 
        error: "Failed to process reaction" 
      }));
    }
  }

  public handleConnection(ws: WebSocketClient) {
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("error", (err) => {
      console.error("WebSocket client error:", err);
    });

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message) as WebSocketMessage;
        await this.handleMessage(ws, data);
      } catch (error) {
        ws.send(
          JSON.stringify({ type: "error", error: "Invalid message format" }),
        );
      }
    });

    ws.on("close", async (code, reason) => {
      if (ws.userId) {
        // Remove socket from user socket set
        const userSocketSet = userSockets.get(ws.userId);
        if (userSocketSet) {
          userSocketSet.delete(ws);
          if (userSocketSet.size === 0) {
            userSockets.delete(ws.userId);
            // Only update presence if user has no other active connections
            await userQueries.updatePresence(ws.userId, false);
          }
        }
      }
    });
  }

  public async handleChannelJoin(ws: WebSocketClient, channelId: string) {
    try {
      if (!ws.userId) return;

      // Verify user is member of the channel
      const member = await pool.query(
        "SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2",
        [channelId, ws.userId],
      );

      if (member.rows.length === 0) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Not a member of this channel",
          }),
        );
        return;
      }

      // Add client to channel's client set
      if (!clients.has(channelId)) {
        clients.set(channelId, new Set());
      }
      clients.get(channelId)?.add(ws);
    } catch (error) {
      console.error("Error joining channel:", error);
      ws.send(
        JSON.stringify({ type: "error", error: "Failed to join channel" }),
      );
    }
  }

  public async handleDMJoin(ws: WebSocketClient, dmId: string) {
    try {
      if (!ws.userId) return;

      // Verify user is part of the DM
      const dmCheck = await pool.query(
        `SELECT * FROM direct_messages 
         WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
        [dmId, ws.userId],
      );

      if (dmCheck.rows.length === 0) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Not authorized for this DM",
          }),
        );
        return;
      }

      // Add client to DM's client set
      if (!clients.has(dmId)) {
        clients.set(dmId, new Set());
      }
      clients.get(dmId)?.add(ws);
    } catch (error) {
      console.error("Error joining DM:", error);
      ws.send(JSON.stringify({ type: "error", error: "Failed to join DM" }));
    }
  }

  // Public method for sending messages
  public async sendMessage(messageData: ChatMessage) {
    if (messageData.isDM) {
      await this.broadcastToDM(messageData.channelId, messageData);
    } else {
      await this.broadcastToChannel(messageData.channelId, messageData);
    }
  }

  private async handleBotMessage(ws: WebSocketClient, data: ChatMessage, organizationId: string) {
    try {
      // Get bot user first to ensure it exists
      const botUser = await pool.query(
        "SELECT id, username FROM users WHERE is_bot = true LIMIT 1"
      );

      if (botUser.rows.length === 0) {
        console.error("Bot user not found");
        ws.send(JSON.stringify({ 
          type: "error", 
          error: "Bot user not configured" 
        }));
        return;
      }

      // Ensure bot has AI enabled
      await pool.query(
        "UPDATE users SET ai_enabled = true WHERE id = $1",
        [botUser.rows[0].id]
      );

      // Remove @bot from the content
      const cleanContent = data.content.replace(/^@bot\s+/, '').trim();
      
      // Get channel context for vector store
      const channelResult = await pool.query(
        "SELECT name FROM channels WHERE id = $1",
        [data.channelId]
      );

      const user = await pool.query(
        "SELECT username FROM users WHERE id = $1",
        [ws.userId]
      );

      // Update vector stores first to include the user's question
      await vectorStoreService.addDocuments(
        { type: "channel", channelId: data.channelId },
        [{
          content: cleanContent,
          userId: ws.userId!,
          username: user.rows[0].username,
          timestamp: new Date(),
          channelName: channelResult.rows[0].name,
          messageType: data.parentId ? 'reply' : 'message',
          parentMessageId: data.parentId
        }]
      );

      await vectorStoreService.addDocuments(
        { type: "organization", organizationId },
        [{
          content: cleanContent,
          userId: ws.userId!,
          username: user.rows[0].username,
          timestamp: new Date(),
          channelName: channelResult.rows[0].name,
          messageType: data.parentId ? 'reply' : 'message',
          parentMessageId: data.parentId
        }]
      );

      // Process the message using existing AI response logic
      const aiResponse = await this.generateBotResponse(
        cleanContent,
        data.channelId,
        organizationId,
        botUser.rows[0].id,
        botUser.rows[0].username,
        data
      );

      // Save and broadcast the bot's response
      const responseId = crypto.randomUUID();
      await pool.query(
        "INSERT INTO messages (id, content, user_id, channel_id, parent_id, created_at, bot_message) VALUES ($1, $2, $3, $4, $5, NOW(), true)",
        [responseId, aiResponse, botUser.rows[0].id, data.channelId, data.id]
      );

      await this.broadcastToChannel(data.channelId, {
        type: "message",
        id: responseId,
        content: aiResponse,
        senderId: botUser.rows[0].id,
        senderName: botUser.rows[0].username,
        channelId: data.channelId,
        isDM: false,
        parentId: data.id,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error("Error handling bot message:", error);
      ws.send(JSON.stringify({ 
        type: "error", 
        error: "Failed to process bot message" 
      }));
    }
  }

  private async generateBotResponse(
    content: string,
    channelId: string,
    organizationId: string,
    botUserId: string,
    botUsername: string,
    triggeringMessage: ChatMessage
  ): Promise<string> {
    try {
      // Get relevant context from both channel and organization vector stores
      const [channelStore, organizationStore] = await Promise.all([
        vectorStoreService.getVectorStore({ type: "channel", channelId }),
        vectorStoreService.getVectorStore({
          type: "organization",
          organizationId
        })
      ]);

      // Search both stores
      const searchResults = await Promise.all([
        channelStore.similaritySearch(content, 50),
        organizationStore.similaritySearch(content, 50)
      ]);

      // Combine and deduplicate results
      const allResults = searchResults
        .flat()
        .filter((value, index, self) =>
          index === self.findIndex((t) => t.pageContent === value.pageContent)
        );

      // Format chat history
      const formattedHistory = allResults
        .map(result => {
          const timestamp = new Date(result.metadata.timestamp);
          const formattedDate = timestamp.toLocaleDateString();
          const formattedTime = timestamp.toLocaleTimeString();
          return `[${formattedDate} ${formattedTime}] ${result.metadata.username} in #${result.metadata.channelName}: ${result.pageContent}`;
        })
        .sort((a, b) => {
          const timeA = new Date(a.match(/\[(.*?)\]/)?.[1] || '').getTime();
          const timeB = new Date(b.match(/\[(.*?)\]/)?.[1] || '').getTime();
          return timeA - timeB;
        })
        .join('\n');

      const openAIClient = createOpenAIClient();
      const completion = await openAIClient.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a helpful AI assistant in this chat. When users mention you with @bot, provide direct, conversational responses in the channel.

Guidelines for responses:
- Keep responses concise and focused on the question asked
- Use the same context-aware features available in the search interface
- Match the conversation's tone and formality level
- Reference relevant channel history when appropriate
- Don't use AI-like preambles (e.g., "As an AI assistant...")
- If the question is unclear, ask for clarification
- Stay within the scope of the channel's context
- Maintain a helpful but professional tone

Remember:
- You're responding directly in the channel, visible to all members
- Use channel history for context just like in the search interface
- Keep responses proportional to the question length`
          },
          {
            role: "user",
            content: `Question: "${content}"

Available Chat History:
${formattedHistory}`
          }
        ],
        model: "gpt-4-0125-preview",
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.2,
        frequency_penalty: 0.4,
        top_p: 0.9,
      });

      return completion.choices[0].message.content || "I couldn't generate a response at this time.";
    } catch (error) {
      console.error("Error generating bot response:", error);
      throw error;
    }
  }
}
