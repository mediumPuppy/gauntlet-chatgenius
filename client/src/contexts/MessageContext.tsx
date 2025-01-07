import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from './AuthContext';
import { API_URL } from '../services/config';
import { Message, TypingUser } from '../types/message';

interface MessageContextType {
  messages: Message[];
  sendMessage: (content: string) => void;
  sendTyping: () => void;
  typingUsers: TypingUser[];
  isConnected: boolean;
  showReconnecting: boolean;
  error: string | null;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

interface MessageProviderProps {
  children: React.ReactNode;
  channelId: string;
}

export function MessageProvider({ children, channelId }: MessageProviderProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const { token } = useAuth();

  const { isConnected, showReconnecting, error, sendMessage, sendTyping, ws } = useWebSocket(channelId);

  // Fetch message history when channel changes
  useEffect(() => {
    let isMounted = true;

    const fetchMessageHistory = async () => {
      try {
        const response = await fetch(`${API_URL}/messages?channelId=${channelId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch messages');
        
        const data = await response.json();
        console.log('Fetched messages:', data);
        
        if (isMounted) {
          setMessages(data);
          setTypingUsers([]);
        }
      } catch (err) {
        console.error('Error fetching message history:', err);
      }
    };

    fetchMessageHistory();
    
    return () => {
      isMounted = false;
    };
  }, [channelId, token]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      // Only process messages for current channel
      if (data.channelId !== channelId) return;

      switch (data.type) {
        case 'message': {
          const newMessage: Message = {
            id: crypto.randomUUID(),
            content: data.content,
            userId: data.senderId,
            channelId: data.channelId,
            senderName: data.senderName,
            timestamp: data.timestamp,
          };
          
          setMessages((prev) => {
            const exists = prev.some(msg => 
              msg.content === newMessage.content && 
              msg.userId === newMessage.userId &&
              msg.timestamp === newMessage.timestamp
            );
            return exists ? prev : [...prev, newMessage];
          });
          break;
        }

        case 'typing':
          console.log('Received typing event:', data);
          setTypingUsers((prev) => {
            const existing = prev.find((u) => u.userId === data.userId);
            if (existing) {
              return prev;
            }
            console.log('Adding typing user:', {
              userId: data.userId,
              username: data.username
            });
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

  return (
    <MessageContext.Provider value={{
      messages,
      sendMessage,
      sendTyping,
      typingUsers,
      isConnected,
      showReconnecting,
      error
    }}>
      {children}
    </MessageContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useMessages() {
  const context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
} 