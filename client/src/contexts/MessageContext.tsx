import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useWebSocket, WS_MESSAGE_EVENT } from "../hooks/useWebSocket";
import { useAuth } from "./AuthContext";
import { API_URL } from "../services/config";
import { Message, TypingUser } from "../types/message";
import { v4 as uuidv4 } from "uuid";
import { triggerAIResponse } from "../services/ai";

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
  parentId?: string; // If this exists, the message is IN a thread
  hasReplies?: boolean; // If true, this message HAS a thread
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

export function MessageProvider({
  children,
  channelId,
  isDM = false,
}: MessageProviderProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const { token } = useAuth();
  const { user } = useAuth();
  const processedMessageIds = useRef(new Set<string>());
  const {
    isConnected,
    showReconnecting,
    error,
    sendMessage: wsSendMessage,
    sendTyping,
    ws,
    eventEmitter,
  } = useWebSocket(channelId, isDM);
  const lastMessageTimestampRef = useRef<{ [userId: string]: number }>({});

  // Wrap sendMessage to also update local state
  const sendMessage = useCallback(
    (content: string, parentId?: string) => {
      if (!user) return;

      // Generate a temporary ID for the message
      const tempId = uuidv4();

      // Create the message object with optional parentId
      const newMessage: Message = {
        id: tempId,
        content,
        userId: user.id,
        channelId: isDM ? undefined : channelId,
        dmId: isDM ? channelId : undefined,
        senderName: user.username,
        timestamp: Date.now(),
        parentId,
      };

      // Add to processed set to prevent duplication
      processedMessageIds.current.add(tempId);

      // Update local state immediately
      setMessages((prev) => [...prev, newMessage]);

      // Send via WebSocket
      wsSendMessage(content, tempId, parentId);

      // Check for mentions and trigger AI responses asynchronously
      const mentions = content.match(/@(\w+)/g);
      if (mentions) {
        mentions.forEach((mention) => {
          const username = mention.substring(1); // Remove @ symbol
          // Pass the last 10 messages for context
          const recentMessages = messages.slice(-10);
          triggerAIResponse(username, newMessage, recentMessages, token!);
        });
      }
    },
    [user, channelId, wsSendMessage, messages, token],
  );

  // Fetch message history when channel changes
  useEffect(() => {
    let isMounted = true;

    const fetchMessageHistory = async () => {
      try {
        const endpoint = isDM
          ? `/dm/${channelId}/messages`
          : `/messages?channelId=${channelId}`;
        const response = await fetch(`${API_URL}${endpoint}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error(
            "Failed to fetch messages:",
            response.status,
            response.statusText,
          );
          throw new Error("Failed to fetch messages");
        }

        const data = await response.json();

        if (isMounted) {
          // Transform the messages to ensure consistent property names
          const transformedMessages = data.map((msg: RawMessage) => ({
            id: msg.id,
            content: msg.content,
            userId: msg.userId || msg.user_id || msg.userid || msg.senderId,
            channelId: msg.channelId || msg.channel_id || channelId,
            senderName:
              msg.senderName ||
              msg.sender_name ||
              msg.sendername ||
              msg.username,
            timestamp:
              typeof msg.timestamp === "string"
                ? new Date(msg.timestamp).getTime()
                : msg.timestamp ||
                  new Date(msg.created_at || Date.now()).getTime(),
            parentId: msg.parent_id || msg.parentId, // Add threading fields
            hasReplies: msg.has_replies || msg.hasReplies || false,
            replyCount: msg.reply_count || msg.replyCount || 0,
            reactions: msg.reactions || {},
          }));

          // Add all message IDs to processed set
          transformedMessages.forEach((msg: Message) =>
            processedMessageIds.current.add(msg.id),
          );

          setMessages(transformedMessages);
          setTypingUsers([]);
        }
      } catch (err) {
        console.error("Error fetching message history:", err);
      }
    };

    if (channelId && token) {
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

      // For thread messages, we need to check both channelId and parentId
      // For DMs, we need to check both channelId/dmId
      const isRelevantMessage = isDM
        ? data.channelId === channelId || data.dmId === channelId
        : data.channelId === channelId;

      // Skip if message is not relevant to current context
      if (!isRelevantMessage) return;

      switch (data.type) {
        case "message": {
          // Generate a stable message ID based on content and timestamp
          const messageId = data.id || uuidv4();

          // Skip if we've already processed this message
          if (processedMessageIds.current.has(messageId)) {
            return;
          }

          // Rate limit messages from the same user
          const now = Date.now();
          const lastMessageTime =
            lastMessageTimestampRef.current[data.senderId] || 0;
          if (now - lastMessageTime < 100) {
            return;
          }
          lastMessageTimestampRef.current[data.senderId] = now;

          const newMessage: Message = {
            id: messageId,
            content: data.content,
            userId: data.userId || data.user_id || data.userid || data.senderId,
            channelId: isDM ? undefined : (data.channelId || data.channel_id || channelId),
            dmId: isDM ? (data.channelId || data.channel_id || channelId) : undefined,
            senderName:
              data.senderName ||
              data.sender_name ||
              data.sendername ||
              data.username,
            timestamp:
              typeof data.timestamp === "string"
                ? new Date(data.timestamp).getTime()
                : data.timestamp || Date.now(),
            parentId: data.parentId,
            hasReplies: data.hasReplies,
            replyCount: data.replyCount,
          };

          // Add to processed set
          processedMessageIds.current.add(messageId);

          // Limit the size of the processed set
          if (processedMessageIds.current.size > 1000) {
            const oldestEntries = Array.from(processedMessageIds.current).slice(
              0,
              500,
            );
            processedMessageIds.current = new Set(oldestEntries);
          }

          setMessages((prev) => {
            // First update the parent message if needed
            let updatedMessages = data.parentId
              ? prev.map((msg) =>
                  msg.id === data.parentId
                    ? {
                        ...msg,
                        hasReplies: true,
                        replyCount: (msg.replyCount || 0) + 1,
                      }
                    : msg,
                )
              : prev;

            // Then add the new message
            return [...updatedMessages, newMessage];
          });

          break;
        }

        case "typing": {
          const typingUserId = data.userId;
          if (!typingUserId) return;

          setTypingUsers((prev) => {
            // Skip if user is already in typing list
            if (prev.some((u) => u.userId === typingUserId)) {
              return prev;
            }
            return [
              ...prev,
              {
                userId: typingUserId,
                username: data.username,
              },
            ];
          });

          // Clear typing indicator after 3 seconds
          setTimeout(() => {
            setTypingUsers((prev) =>
              prev.filter((u) => u.userId !== typingUserId),
            );
          }, 3000);
          break;
        }

        case "reaction": {
          const { messageId, userId, emoji, action } = data;

          setMessages((prev) => {
            return prev.map((msg) => {
              // Check if this is the message that got the reaction
              // OR if this is a parent message that contains the reacted message in its thread
              if (
                msg.id === messageId ||
                (msg.hasReplies && data.parentId === msg.id)
              ) {
                // Create a new reactions object if it doesn't exist
                const currentReactions = { ...(msg.reactions || {}) };

                if (action === "added") {
                  // Create new array if emoji doesn't exist
                  const currentUsers = currentReactions[emoji] || [];
                  currentReactions[emoji] = [...currentUsers, userId];
                } else {
                  // Remove user from the emoji's users array
                  if (currentReactions[emoji]) {
                    currentReactions[emoji] = currentReactions[emoji].filter(
                      (id) => id !== userId,
                    );
                    if (currentReactions[emoji].length === 0) {
                      delete currentReactions[emoji];
                    }
                  }
                }

                return { ...msg, reactions: currentReactions };
              }
              return msg;
            });
          });
          break;
        }
      }
    };

    eventEmitter.addEventListener(
      WS_MESSAGE_EVENT,
      handleMessage as EventListener,
    );
    return () =>
      eventEmitter.removeEventListener(
        WS_MESSAGE_EVENT,
        handleMessage as EventListener,
      );
  }, [channelId, eventEmitter, ws, isDM]);

  return (
    <MessageContext.Provider
      value={{
        messages,
        sendMessage,
        sendTyping,
        typingUsers,
        isConnected,
        showReconnecting,
        error,
      }}
    >
      {children}
    </MessageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMessages() {
  const context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error("useMessages must be used within a MessageProvider");
  }
  return context;
}
