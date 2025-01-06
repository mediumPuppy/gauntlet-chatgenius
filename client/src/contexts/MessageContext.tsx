import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from './AuthContext';
import { useParams } from 'react-router-dom';

interface Message {
  id: string;
  content: string;
  userId: string;
  channelId?: string;
  dmId?: string;
  senderName: string;
  timestamp: number;
}

interface TypingUser {
  userId: string;
  username: string;
}

interface MessageContextType {
  messages: Message[];
  sendMessage: (content: string) => void;
  sendTyping: () => void;
  typingUsers: TypingUser[];
  isConnected: boolean;
  error: string | null;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

export function MessageProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const { user } = useAuth();
  const { channelId } = useParams();

  const { isConnected, error, sendMessage, sendTyping, ws } = useWebSocket(channelId || '');

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      // Only process messages for current channel
      if (data.channelId !== channelId) return;

      switch (data.type) {
        case 'message':
          setMessages((prev) => [...prev, {
            id: crypto.randomUUID(),
            content: data.content,
            userId: data.senderId,
            channelId: data.channelId,
            senderName: data.senderName,
            timestamp: data.timestamp,
          }]);
          break;

        case 'typing':
          setTypingUsers((prev) => {
            const existing = prev.find((u) => u.userId === data.userId);
            if (existing) {
              return prev;
            }
            return [...prev, {
              userId: data.userId,
              username: data.username
            }];
          });

          // Clear typing indicator after 3 seconds
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
          }, 3000);
          break;
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, channelId]);

  // Clear messages when changing channels
  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);
  }, [channelId]);

  return (
    <MessageContext.Provider value={{
      messages,
      sendMessage,
      sendTyping,
      typingUsers,
      isConnected,
      error
    }}>
      {children}
    </MessageContext.Provider>
  );
}

export function useMessages() {
  const context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
} 