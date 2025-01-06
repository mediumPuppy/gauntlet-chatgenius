import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { WebSocketClient, WebSocketMessage, ChatMessage, TypingMessage } from './types';
import { messageQueries } from '../models/message';
import { channelQueries } from '../models/channel';
import { User } from '../models/user';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const clients = new Map<string, Set<WebSocketClient>>();

export class WebSocketHandler {
  constructor(private wss: WebSocketServer) {
    this.setupHeartbeat();
  }

  private setupHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws: WebSocketClient) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private async authenticateConnection(ws: WebSocketClient, token: string): Promise<boolean> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      ws.userId = decoded.id;
      ws.isAlive = true;
      return true;
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid token' }));
      ws.close();
      return false;
    }
  }

  private async handleMessage(ws: WebSocketClient, data: WebSocketMessage) {
    // Handle auth message first
    if (data.type === 'auth') {
      const token = data.token as string;
      const authenticated = await this.authenticateConnection(ws, token);
      if (!authenticated) return;

      // If there's a channel to join, join it
      if (data.channelId && typeof data.channelId === 'string') {
        await this.handleChannelJoin(ws, data.channelId);
      }
      return;
    }

    // For all other messages, require authentication and channelId
    if (!ws.userId) {
      ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));
      return;
    }

    if (!data.channelId || typeof data.channelId !== 'string') {
      ws.send(JSON.stringify({ type: 'error', error: 'Channel ID is required' }));
      return;
    }

    const channelId = data.channelId;

    switch (data.type) {
      case 'message':
        if (!data.content) {
          ws.send(JSON.stringify({ type: 'error', error: 'Message content is required' }));
          return;
        }
        const chatMessage: ChatMessage = {
          type: 'message',
          channelId,
          content: data.content,
          senderId: ws.userId,
          senderName: '', // Will be set by the database
        };
        await this.handleChatMessage(ws, chatMessage);
        break;
      case 'typing':
        await this.broadcastToChannel(channelId, { ...data, channelId });
        break;
      case 'read':
        await this.broadcastToChannel(channelId, { ...data, channelId });
        break;
    }
  }

  private async handleChatMessage(ws: WebSocketClient, data: ChatMessage) {
    try {
      // Verify user is member of channel
      const members = await channelQueries.getMembers(data.channelId);
      console.log('Channel members:', members, 'User ID:', ws.userId);
      if (!members.includes(ws.userId!)) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Not a member of this channel'
        }));
        return;
      }

      // Save message to database
      const message = await messageQueries.createMessage({
        channelId: data.channelId,
        userId: ws.userId!,
        content: data.content
      });

      console.log('Created message:', message);

      // Broadcast to channel members
      const broadcastMessage: ChatMessage = {
        type: 'message',
        channelId: data.channelId,
        content: message.content,
        senderId: message.user_id,
        senderName: message.username || 'Unknown User', // Provide fallback for username
        timestamp: message.created_at.getTime()
      };

      const channelClients = clients.get(data.channelId);
      console.log('Channel clients:', channelClients ? channelClients.size : 0);

      await this.broadcastToChannel(data.channelId, broadcastMessage);
    } catch (error) {
      console.error('Error handling chat message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to send message'
      }));
    }
  }

  private async broadcastToChannel(channelId: string, message: WebSocketMessage) {
    const channelClients = clients.get(channelId) || new Set();
    const messageStr = JSON.stringify(message);
    
    channelClients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(messageStr);
      }
    });
  }

  public handleConnection(ws: WebSocketClient) {
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message) as WebSocketMessage;
        await this.handleMessage(ws, data);
      } catch (error) {
        console.error('Error parsing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      // Remove client from all channels
      clients.forEach((channelClients) => {
        channelClients.delete(ws);
      });
    });
  }

  public async handleChannelJoin(ws: WebSocketClient, channelId: string) {
    try {
      // Verify user is member of channel first
      const members = await channelQueries.getMembers(channelId);
      console.log('Joining channel:', channelId, 'User ID:', ws.userId, 'Members:', members);
      
      if (!members.includes(ws.userId!)) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Not a member of this channel'
        }));
        return;
      }

      if (!clients.has(channelId)) {
        clients.set(channelId, new Set());
      }
      
      const channelClients = clients.get(channelId)!;
      channelClients.add(ws);
      console.log(`Client added to channel ${channelId}. Total clients: ${channelClients.size}`);

      // Confirm channel join to client
      ws.send(JSON.stringify({
        type: 'joined',
        channelId
      }));
    } catch (error) {
      console.error('Error joining channel:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to join channel'
      }));
    }
  }

  public async handleChannelLeave(ws: WebSocketClient, channelId: string) {
    const channelClients = clients.get(channelId);
    if (channelClients) {
      channelClients.delete(ws);
    }
  }
} 