import WebSocket from 'ws';
import { User } from '../models/user';

export interface WebSocketClient extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

export type WebSocketMessageType = 
  | 'message'
  | 'typing'
  | 'read'
  | 'error'
  | 'auth'
  | 'presence';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  channelId?: string;
  content?: string;
  timestamp?: number;
  token?: string;
  isDM?: boolean;
}

export interface ChatMessage extends WebSocketMessage {
  type: 'message';
  channelId: string;
  content: string;
  senderId: string;
  senderName: string;
  isDM: boolean;
}

export interface TypingMessage extends WebSocketMessage {
  type: 'typing';
  channelId: string;
  userId: string;
  username: string;
  isDM: boolean;
}

export interface ReadMessage extends WebSocketMessage {
  type: 'read';
  channelId: string;
  userId: string;
  messageId: string;
  isDM: boolean;
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  error: string;
}

export interface PresenceMessage extends WebSocketMessage {
  type: 'presence';
  userId: string;
  username: string;
  isOnline: boolean;
  lastSeen: string;
}