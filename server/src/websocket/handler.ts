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
    token: string
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
      console.error("Authentication error:", error);
      ws.send(JSON.stringify({ type: "error", error: "Invalid token" }));
      ws.close();
      return false;
    }
  }

  private async broadcastPresenceUpdate(userId: string, isOnline: boolean) {
    try {
      const user = await pool.query(
        "SELECT username, last_seen FROM users WHERE id = $1",
        [userId]
      );
      if (user.rows.length === 0) return;

      // Get all organizations the user is part of
      const orgs = await pool.query(
        "SELECT organization_id FROM organization_members WHERE user_id = $1",
        [userId]
      );

      // Get all unique members from all organizations
      const memberSet = new Set<string>();
      for (const org of orgs.rows) {
        const members = await pool.query(
          "SELECT user_id FROM organization_members WHERE organization_id = $1",
          [org.organization_id]
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
        await this.handleReaction(ws, data);
        break;

      default:
        console.error("Unknown message type:", data.type);
    }
  }

  private async handleChatMessage(ws: WebSocketClient, data: ChatMessage) {
    try {
      const user = await pool.query(
        "SELECT username FROM users WHERE id = $1",
        [ws.userId]
      );
      if (user.rows.length === 0) {
        ws.send(JSON.stringify({ type: "error", error: "User not found" }));
        return;
      }

      console.log("Handling chat message:", data);

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
          [data.channelId, ws.userId]
        );

        if (dmCheck.rows.length === 0) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Not authorized for this DM",
            })
          );
          return;
        }

        // Save DM message
        await pool.query(
          "INSERT INTO messages (id, content, user_id, dm_id, created_at) VALUES ($1, $2, $3, $4, NOW())",
          [data.id, data.content, ws.userId, data.channelId]
        );

        // Broadcast to DM participants
        await this.broadcastToDM(data.channelId, {
          type: "message",
          ...message,
        });
      } else {
        // Verify user is part of the channel
        const channelCheck = await pool.query(
          "SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2",
          [data.channelId, ws.userId]
        );

        if (channelCheck.rows.length === 0) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "Not authorized for this channel",
            })
          );
          return;
        }

        // Save channel message with parentId
        await pool.query(
          "INSERT INTO messages (id, content, user_id, channel_id, parent_id, created_at) VALUES ($1, $2, $3, $4, $5::uuid, NOW())",
          [
            data.id,
            data.content,
            ws.userId,
            data.channelId,
            data.parentId || null,
          ]
        );

        // Broadcast to channel members
        await this.broadcastToChannel(data.channelId, {
          type: "message",
          ...message,
        });
      }
    } catch (error) {
      console.error("Error handling chat message:", error);
      ws.send(
        JSON.stringify({ type: "error", error: "Failed to process message" })
      );
    }
  }

  private async handleTypingMessage(ws: WebSocketClient, data: TypingMessage) {
    try {
      const user = await pool.query(
        "SELECT username FROM users WHERE id = $1",
        [ws.userId]
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
    message: WebSocketMessage
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
        [dmId]
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

  public async handleReaction(ws: WebSocketClient | null, data: any) {
    try {
      const { messageId, emoji, action } = data;

      // Get the channel/DM ID and parent_id for this message
      const message = await pool.query(
        "SELECT channel_id, dm_id, parent_id FROM messages WHERE id = $1",
        [messageId]
      );

      if (message.rows.length === 0) {
        console.log("Message not found:", messageId);
        ws?.send(JSON.stringify({ type: "error", error: "Message not found" }));
        return;
      }

      const { channel_id, dm_id, parent_id } = message.rows[0];

      // Broadcast to the appropriate channel or DM
      const reactionMessage: ReactionMessage = {
        type: "reaction",
        messageId,
        userId: ws?.userId || "",
        emoji,
        action,
        parentId: parent_id,
        channelId: channel_id || "",
      };

      if (channel_id) {
        console.log("Broadcasting to channel:", channel_id);
        await this.broadcastToChannel(channel_id, reactionMessage);
      } else if (dm_id) {
        console.log("Broadcasting to DM:", dm_id);
        await this.broadcastToDM(dm_id, reactionMessage);
      }
    } catch (error) {
      console.error("Error handling reaction:", error);
      ws?.send(
        JSON.stringify({ type: "error", error: "Failed to process reaction" })
      );
    }
  }

  public handleConnection(ws: WebSocketClient) {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("error", (err) => {
      console.error("WebSocket client error event:", err);
    });

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message) as WebSocketMessage;
        await this.handleMessage(ws, data);
      } catch (error) {
        ws.send(
          JSON.stringify({ type: "error", error: "Invalid message format" })
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
        [channelId, ws.userId]
      );

      if (member.rows.length === 0) {
        ws.send(
          JSON.stringify({
            type: "error",
            error: "Not a member of this channel",
          })
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
        JSON.stringify({ type: "error", error: "Failed to join channel" })
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
        [dmId, ws.userId]
      );

      if (dmCheck.rows.length === 0) {
        ws.send(
          JSON.stringify({ type: "error", error: "Not authorized for this DM" })
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
}
