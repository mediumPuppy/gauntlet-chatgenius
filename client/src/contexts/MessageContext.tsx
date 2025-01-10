import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket, WS_MESSAGE_EVENT } from '../hooks/useWebSocket';
import { useAuth } from './AuthContext';
import { API_URL } from '../services/config';
import { Message, TypingUser } from '../types/message';

interface MessageContextType {
  messages: Message[];
  sendMessage: (content: string, parentId?: string) => void;
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
  parentId?: string;
  hasReplies?: boolean;
  replyCount?: number;
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
  parent_id?: string;
  parentId?: string;
  has_replies?: boolean;
  hasReplies?: boolean;
  reply_count?: number;
  replyCount?: number;
  reactions?: Record<string, string[]>;
}

export function MessageProvider({ children, channelId, isDM = false, parentId }: MessageProviderProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const { token, user } = useAuth();
  const processedMessageIds = useRef(new Set<string>());
  const { isConnected, showReconnecting, error, sendMessage: wsSendMessage, 
    sendTyping: wsSendTyping, eventEmitter } = useWebSocket(channelId, isDM, parentId);

  const handleMessage = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    const data = customEvent.detail;
    console.log('MessageContext received event:', data);

    switch (data.type) {
      case 'message':
        if (processedMessageIds.current.has(data.id)) return;
        processedMessageIds.current.add(data.id);

        setMessages(prev => {
          // Always add new messages that belong to this thread
          if (parentId && (data.parentId === parentId || data.id === parentId)) {
            return [...prev, data];
          }
          
          // For main view, handle thread updates
          if (!parentId) {
            if (data.parentId) {
              return prev.map(msg => {
                if (msg.id === data.parentId) {
                  return {
                    ...msg,
                    hasReplies: true,
                    replyCount: (msg.replyCount || 0) + 1
                  };
                }
                return msg;
              });
            }
            return [...prev, data];
          }
          
          return prev;
        });
        break;

      case 'reaction':
        const { messageId, userId, emoji, action, parentId: incomingParentId } = data;
        console.log('Processing reaction:', { messageId, userId, emoji, action, incomingParentId });
        setMessages(prev => {
          console.log('Current messages:', prev.length);
          return prev.map(msg => {
            // Case 1: Direct match with the message
            if (msg.id === messageId) {
              const currentReactions = { ...(msg.reactions || {}) };
              if (action === 'added') {
                if (!currentReactions[emoji]) {
                  currentReactions[emoji] = [];
                }
                if (!currentReactions[emoji].includes(userId)) {
                  currentReactions[emoji] = [...currentReactions[emoji], userId];
                }
              } else {
                currentReactions[emoji] = (currentReactions[emoji] || [])
                  .filter(id => id !== userId);
                if (currentReactions[emoji]?.length === 0) {
                  delete currentReactions[emoji];
                }
              }
              return { ...msg, reactions: currentReactions };
            }
            
            // Case 2: If we're in thread view and this is the parent message
            if (parentId && msg.id === parentId && messageId === parentId) {
              const currentReactions = { ...(msg.reactions || {}) };
              if (action === 'added') {
                if (!currentReactions[emoji]) {
                  currentReactions[emoji] = [];
                }
                if (!currentReactions[emoji].includes(userId)) {
                  currentReactions[emoji] = [...currentReactions[emoji], userId];
                }
              } else {
                currentReactions[emoji] = (currentReactions[emoji] || [])
                  .filter(id => id !== userId);
                if (currentReactions[emoji]?.length === 0) {
                  delete currentReactions[emoji];
                }
              }
              return { ...msg, reactions: currentReactions };
            }
            
            return msg;
          });
        });
        break;
    }
  }, [parentId]);

  // Handle WebSocket events
  useEffect(() => {
    eventEmitter.addEventListener('ws-message', handleMessage as EventListener);
    return () => {
      eventEmitter.removeEventListener('ws-message', handleMessage as EventListener);
    };
  }, [eventEmitter, handleMessage]);

  // Wrap sendMessage to also update local state
  const sendMessage = useCallback((content: string, parentId?: string) => {
    if (!user) return;

    const tempId = `${user.id}-${Date.now()}-${content}`;
    const newMessage: Message = {
      id: tempId,
      content,
      userId: user.id,
      channelId,
      senderName: user.username,
      timestamp: Date.now(),
      parentId
    };

    processedMessageIds.current.add(tempId);
    setMessages(prev => [...prev, newMessage]);
    wsSendMessage(content, parentId);
  }, [user, channelId, wsSendMessage]);

  // Fetch message history when channel changes
  useEffect(() => {
    let isMounted = true;

    const fetchMessageHistory = async () => {
      if (!token) return;

      try {
        const endpoint = isDM ? `/dm/${channelId}/messages` : `/messages?channelId=${channelId}`;
        const response = await fetch(`${API_URL}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch messages');
        
        const data = await response.json();
        
        if (isMounted) {
          const transformedMessages = data.map((msg: RawMessage) => ({
            id: msg.id,
            content: msg.content,
            userId: msg.userId || msg.user_id || msg.userid || msg.senderId,
            channelId: msg.channelId || msg.channel_id || channelId,
            senderName: msg.senderName || msg.sender_name || msg.sendername || msg.username,
            timestamp: typeof msg.timestamp === 'string' 
              ? new Date(msg.timestamp).getTime() 
              : (msg.timestamp || new Date(msg.created_at || Date.now()).getTime()),
            parentId: msg.parent_id || msg.parentId,
            hasReplies: msg.has_replies || msg.hasReplies || false,
            replyCount: msg.reply_count || msg.replyCount || 0,
            reactions: typeof msg.reactions === 'string' 
              ? JSON.parse(msg.reactions) 
              : (msg.reactions || {})
          }));

          transformedMessages.forEach((msg: Message) => {
            processedMessageIds.current.add(msg.id);
          });
          
          setMessages(transformedMessages);
          setTypingUsers([]);
        }
      } catch (err) {
        console.error('Error fetching message history:', err);
      }
    };

    fetchMessageHistory();
    
    return () => {
      isMounted = false;
      processedMessageIds.current.clear();
    };
  }, [channelId, token, isDM]);

  const sendTyping = useCallback(() => {
    wsSendTyping();
  }, [wsSendTyping]);

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

export function useMessages() {
  const context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
} 