import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket, WS_MESSAGE_EVENT } from '../hooks/useWebSocket';
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

interface RawMessage {
  id: string;
  content: string;
  userId?: string;
  user_id?: string;
  userid?: string;
  senderId?: string;
  channelId?: string;
  channel_id?: string;
  senderName?: string;
  sender_name?: string;
  sendername?: string;
  username?: string;
  timestamp?: string | number;
  created_at?: string;
}

export function MessageProvider({ children, channelId, isDM = false }: MessageProviderProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const { token } = useAuth();
  const { user } = useAuth();
  const processedMessageIds = useRef(new Set<string>());
  const { isConnected, showReconnecting, error, sendMessage: wsSendMessage, sendTyping, ws, eventEmitter } = useWebSocket(channelId, isDM);
  const lastMessageTimestampRef = useRef<{ [userId: string]: number }>({});

  // Wrap sendMessage to also update local state
  const sendMessage = useCallback((content: string) => {
    if (!user) return;

    // Generate a temporary ID for the message
    const tempId = `${user.id}-${Date.now()}-${content}`;
    
    // Create the message object
    const newMessage: Message = {
      id: tempId,
      content,
      userId: user.id,
      channelId,
      senderName: user.username,
      timestamp: Date.now(),
    };

    // Add to processed set to prevent duplication if we somehow receive it back
    processedMessageIds.current.add(tempId);
    
    // Update local state immediately
    setMessages(prev => [...prev, newMessage]);
    
    // Send via WebSocket
    wsSendMessage(content);
  }, [user, channelId, wsSendMessage]);

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
        
        if (isMounted) {
          // Transform the messages to ensure consistent property names
          const transformedMessages = data.map((msg: RawMessage) => ({
            id: msg.id,
            content: msg.content,
            userId: msg.userId || msg.user_id || msg.userid || msg.senderId,
            channelId: msg.channelId || msg.channel_id || channelId,
            senderName: msg.senderName || msg.sender_name || msg.sendername || msg.username,
            timestamp: typeof msg.timestamp === 'string' 
              ? new Date(msg.timestamp).getTime() 
              : (msg.timestamp || new Date(msg.created_at || Date.now()).getTime()),
          }));

          // Add all message IDs to processed set
          transformedMessages.forEach((msg: Message) => processedMessageIds.current.add(msg.id));
          
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

    const handleMessage = (event: CustomEvent) => {
      const data = event.detail;
      console.log('Received WebSocket message:', data);

      // Only process messages for current channel/DM
      if (data.channelId !== channelId) return;

      switch (data.type) {
        case 'message': {
          // Generate a stable message ID based on content and timestamp
          const messageId = data.id || `${data.senderId}-${data.timestamp}-${data.content}`;
          
          // Skip if we've already processed this message
          if (processedMessageIds.current.has(messageId)) {
            console.log('Skipping duplicate message:', messageId);
            return;
          }

          // Rate limit messages from the same user
          const now = Date.now();
          const lastMessageTime = lastMessageTimestampRef.current[data.senderId] || 0;
          if (now - lastMessageTime < 100) { // Ignore messages from same user within 100ms
            console.log('Rate limiting message from user:', data.senderId);
            return;
          }
          lastMessageTimestampRef.current[data.senderId] = now;
          
          console.log('Processing new message:', data);
          const newMessage: Message = {
            id: messageId,
            content: data.content,
            userId: data.userId || data.user_id || data.userid || data.senderId,
            channelId: data.channelId || data.channel_id || channelId,
            senderName: data.senderName || data.sender_name || data.sendername || data.username,
            timestamp: typeof data.timestamp === 'string' 
              ? new Date(data.timestamp).getTime() 
              : (data.timestamp || Date.now()),
          };
          
          // Add to processed set
          processedMessageIds.current.add(messageId);
         
          // Limit the size of the processed set
          if (processedMessageIds.current.size > 1000) {
            const oldestEntries = Array.from(processedMessageIds.current).slice(0, 500);
            processedMessageIds.current = new Set(oldestEntries);
          }

          setMessages(prev => [...prev, newMessage]);
          break;
        }

        case 'typing': {
          const typingUserId = data.userId;
          if (!typingUserId) return;

          setTypingUsers(prev => {
            // Skip if user is already in typing list
            if (prev.some(u => u.userId === typingUserId)) {
              return prev;
            }
            return [...prev, {
              userId: typingUserId,
              username: data.username
            }];
          });

          // Clear typing indicator after 3 seconds
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u.userId !== typingUserId));
          }, 3000);
          break;
        }
      }
    };

    eventEmitter.addEventListener(WS_MESSAGE_EVENT, handleMessage as EventListener);
    return () => eventEmitter.removeEventListener(WS_MESSAGE_EVENT, handleMessage as EventListener);
  }, [channelId, eventEmitter, ws]);

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