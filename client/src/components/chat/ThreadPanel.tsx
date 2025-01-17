// client/src/components/chat/ThreadPanel.tsx
import { useEffect, useState } from "react";
import { Message as MessageType } from "../../types/message";
import { MessageInput } from "./MessageInput";
import { API_URL } from "../../services/config";
import { MessageProvider } from "../../contexts/MessageContext";
import { useAuth } from "../../contexts/AuthContext";
import { useMessages } from "../../contexts/MessageContext";
import { Message as MessageComponent } from "./MessageList";
import { motion, AnimatePresence } from "framer-motion";
import { useWebSocket } from "../../hooks/useWebSocket";

interface ThreadPanelProps {
  messageId: string;
  onClose: () => void;
}

export function ThreadPanel({ messageId, onClose }: ThreadPanelProps) {
  const [parent, setParent] = useState<MessageType | null>(null);
  const [replies, setReplies] = useState<MessageType[]>([]);
  const { token } = useAuth();
  const { messages } = useMessages();
  const { eventEmitter } = useWebSocket(parent?.channelId || "", !!parent?.dmId);
  // Track the context of where this thread lives
  const [threadContext, setThreadContext] = useState<{
    isDM: boolean;
    contextId: string;
  } | null>(null);

  // Initial fetch of thread data
  useEffect(() => {
    async function fetchThread() {
      try {
        const res = await fetch(`${API_URL}/messages/thread/${messageId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch thread: ${res.status}`);
        }

        const data = await res.json();
        setParent(data.parent);
        setReplies(data.replies);
        
        // Store the thread context
        setThreadContext({
          isDM: !!data.parent.dmId,
          contextId: data.parent.dmId || data.parent.channelId
        });
      } catch (error) {
        console.error("Error fetching thread:", error);
      }
    }
    if (messageId && token) {
      fetchThread();
    }
  }, [messageId, token]);

  // Update replies when new messages come in
  useEffect(() => {
    if (!threadContext) return;

    // Only process messages that match our thread's context
    const relevantMessages = messages.filter(msg => 
      threadContext.isDM 
        ? msg.dmId === threadContext.contextId
        : msg.channelId === threadContext.contextId
    );

    // Get all messages that belong to this thread
    const threadMessages = relevantMessages.filter(
      msg => msg.parentId === messageId
    );

    // Merge existing replies with new messages
    setReplies(prevReplies => {
      const existingIds = new Set(prevReplies.map(reply => reply.id));
      const newReplies = threadMessages.filter(
        msg => !existingIds.has(msg.id)
      );

      if (newReplies.length === 0) return prevReplies;

      return [...prevReplies, ...newReplies].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });

    // Update parent message if it exists in the relevant messages
    const updatedParent = relevantMessages.find(msg => msg.id === messageId);
    if (updatedParent && parent) {
      // Only update specific fields to avoid infinite loop
      const hasChanges =
        (messageId === updatedParent.id ? updatedParent.reactions !== parent.reactions : false) ||
        updatedParent.replyCount !== parent.replyCount ||
        updatedParent.hasReplies !== parent.hasReplies;

      if (hasChanges) {
        setParent(current => ({
          ...current!,
          reactions: updatedParent.reactions || {},
          replyCount: updatedParent.replyCount,
          hasReplies: updatedParent.hasReplies,
        }));
      }
    }
  }, [messages, messageId, threadContext, parent]);

  // Update the reaction handling effect
  useEffect(() => {
    const handleReaction = (event: CustomEvent) => {
      const data = event.detail;
      
      if (data.type !== 'reaction') return;
      
      const { messageId, userId, emoji, action } = data;

      // Update parent message reactions if it's the target
      if (messageId === parent?.id) {
        setParent(current => {
          if (!current) return current;
          
          const currentReactions = { ...(current.reactions || {}) };
          
          if (action === "added") {
            const currentUsers = currentReactions[emoji] || [];
            currentReactions[emoji] = [...currentUsers, userId];
          } else {
            if (currentReactions[emoji]) {
              currentReactions[emoji] = currentReactions[emoji].filter(
                (id) => id !== userId
              );
              if (currentReactions[emoji].length === 0) {
                delete currentReactions[emoji];
              }
            }
          }
          
          return { ...current, reactions: currentReactions };
        });
      }

      // Update reply reactions if the target is a reply
      setReplies(current => 
        current.map(reply => {
          if (reply.id === messageId) {
            const currentReactions = { ...(reply.reactions || {}) };
            
            if (action === "added") {
              const currentUsers = currentReactions[emoji] || [];
              currentReactions[emoji] = [...currentUsers, userId];
            } else {
              if (currentReactions[emoji]) {
                currentReactions[emoji] = currentReactions[emoji].filter(
                  (id) => id !== userId
                );
                if (currentReactions[emoji].length === 0) {
                  delete currentReactions[emoji];
                }
              }
            }
            
            return { ...reply, reactions: currentReactions };
          }
          return reply;
        })
      );
    };

    eventEmitter?.addEventListener('ws-message', handleReaction as EventListener);

    return () => {
      eventEmitter?.removeEventListener('ws-message', handleReaction as EventListener);
    };
  }, [eventEmitter, messageId, parent, replies]);

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key="thread-panel"
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ 
          type: "spring", 
          stiffness: 100,
          damping: 20,
          duration: 0.4
        }}
        className="w-96 border-l border-gray-200 h-full flex flex-col bg-white"
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-bold">Thread</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {parent && (
            <MessageComponent 
              message={parent} 
              onThreadClick={() => {}} 
              hideThreadControls={true}
            />
          )}

          <div className="space-y-4">
            {replies.map((reply) => (
              <MessageComponent
                key={reply.id}
                message={reply}
                onThreadClick={() => {}}
                hideThreadControls={true}
              />
            ))}
          </div>
        </div>

        {parent && (
          <MessageProvider 
            channelId={parent.channelId || parent.dmId || ""} 
            isDM={!!parent.dmId}
          >
            <div className="p-4 border-t border-gray-200">
              <MessageInput
                parentId={messageId}
                placeholder={`Reply to thread...`}
                isThread={true}
              />
            </div>
          </MessageProvider>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
