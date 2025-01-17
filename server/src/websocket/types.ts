import WebSocket from "ws";
import { User } from "../models/user";
import { UUID } from "crypto";

export interface WebSocketClient extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

export type WebSocketMessageType =
  | "message"
  | "typing"
  | "read"
  | "error"
  | "auth"
  | "presence"
  | "reaction";

export interface WebSocketMessage {
  type: WebSocketMessageType;
  channelId?: string;
  content?: string;
  timestamp?: number;
  token?: string;
  isDM?: boolean;
}

export interface ChatMessage extends WebSocketMessage {
  id: UUID;
  type: "message";
  channelId: string;
  content: string;
  senderId: string;
  senderName: string;
  isDM: boolean;
  parentId?: string;
}

export interface TypingMessage extends WebSocketMessage {
  type: "typing";
  channelId: string;
  userId: string;
  username: string;
  isDM: boolean;
}

export interface ReadMessage extends WebSocketMessage {
  type: "read";
  channelId: string;
  userId: string;
  messageId: string;
  isDM: boolean;
}

export interface ErrorMessage extends WebSocketMessage {
  type: "error";
  error: string;
}

export interface PresenceMessage extends WebSocketMessage {
  type: "presence";
  userId: string;
  username: string;
  isOnline: boolean;
  lastSeen: string;
}

export interface ReactionMessage extends WebSocketMessage {
  type: "reaction";
  messageId: string;
  userId: string;
  emoji: string;
  action: "added" | "removed";
  parentId?: string;
  dmId?: string;
}
