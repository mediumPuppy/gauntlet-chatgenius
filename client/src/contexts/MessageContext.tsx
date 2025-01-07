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
  isDM?: boolean;
}

export function MessageProvider({ children, channelId, isDM = false }: MessageProviderProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const { token } = useAuth();

  const { isConnected, showReconnecting, error, sendMessage, sendTyping, ws } = useWebSocket(channelId, isDM);

  // Fetch message history when channel changes
  useEffect(() => {
    let isMounted = true;

    const fetchMessageHistory = async () => {
      try {
        const endpoint = isDM ? `/dm/${channelId}/messages` : `/messages?channelId=${channelId}`;
        console.log('Fetching messages from:', endpoint);
        const response = await fetch(`${API_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          console.error('Failed to fetch messages:', response.status, response.statusText);
          throw new Error('Failed to fetch messages');
        }
        
        const data = await response.json();
        console.log('Raw message data:', data);
        
        if (isMounted) {
          // Transform the messages to ensure consistent property names
          const transformedMessages = data.map((msg: any) => {
            console.log('Processing message:', msg);
            const transformed = {
              id: msg.id,
              content: msg.content,
              userId: msg.userId || msg.user_id || msg.userid || msg.senderId,
              channelId: msg.channelId || msg.channel_id || channelId,
              senderName: msg.senderName || msg.sender_name || msg.sendername || msg.username,
              timestamp: typeof msg.timestamp === 'string' 
                ? new Date(msg.timestamp).getTime() 
                : (msg.timestamp || new Date(msg.created_at).getTime()),
            };
            console.log('Transformed message:', transformed);
            return transformed;
          });
          console.log('All transformed messages:', transformedMessages);
          setMessages(transformedMessages);
          setTypingUsers([]);
        }
      } catch (err) {
        console.error('Error fetching message history:', err);
      }
    };

    if (channelId && token) {
      console.log('Fetching messages for:', isDM ? 'DM' : 'Channel', channelId);
      fetchMessageHistory();
    }
    
    return () => {
      isMounted = false;
    };
  }, [channelId, token, isDM]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      console.log('Received WebSocket message:', data);

      // Only process messages for current channel/DM
      if (data.channelId !== channelId) return;

      switch (data.type) {
        case 'message': {
          console.log('Processing new message:', data);
          const newMessage: Message = {
            id: data.id || crypto.randomUUID(),
            content: data.content,
            userId: data.userId || data.user_id || data.userid || data.senderId,
            channelId: data.channelId || data.channel_id || channelId,
            senderName: data.senderName || data.sender_name || data.sendername || data.username,
            timestamp: typeof data.timestamp === 'string' 
              ? new Date(data.timestamp).getTime() 
              : (data.timestamp || Date.now()),
          };
          console.log('Transformed new message:', newMessage);
          
          setMessages((prev) => {
            const exists = prev.some(msg => 
              msg.id === newMessage.id || (
                msg.content === newMessage.content && 
                msg.userId === newMessage.userId &&
                msg.timestamp === newMessage.timestamp
              )
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