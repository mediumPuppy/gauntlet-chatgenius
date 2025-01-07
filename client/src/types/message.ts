export interface Message {
  id: string;
  content: string;
  userId: string;
  channelId?: string;
  dmId?: string;
  senderName: string;
  timestamp: number;
}

export interface TypingUser {
  userId: string;
  username: string;
}

export interface WebSocketMessage {
  type: 'message' | 'typing' | 'read' | 'error';
  channelId: string;
  content?: string;
  timestamp?: number;
  senderId?: string;
  senderName?: string;
  error?: string;
  userId?: string;
  username?: string;
} 