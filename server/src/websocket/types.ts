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
  | 'auth';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  channelId?: string;
  content?: string;
  timestamp?: number;
  token?: string;
}

export interface ChatMessage extends WebSocketMessage {
  type: 'message';
  channelId: string;
  content: string;
  senderId: string;
  senderName: string;
}

export interface TypingMessage extends WebSocketMessage {
  type: 'typing';
  userId: string;
  username: string;
}

export interface ReadMessage extends WebSocketMessage {
  type: 'read';
  userId: string;
  messageId: string;
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  error: string;
} 