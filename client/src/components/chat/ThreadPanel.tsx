// client/src/components/chat/ThreadPanel.tsx
import { useEffect, useState } from 'react';
import { Message as MessageType } from '../../types/message';
import { MessageInput } from './MessageInput';
import { API_URL } from '../../services/config';
import { MessageProvider } from '../../contexts/MessageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMessages } from '../../contexts/MessageContext';
import { Message as MessageComponent } from './MessageList';

interface ThreadPanelProps {
  messageId: string;
  onClose: () => void;
}

export function ThreadPanel({ messageId, onClose }: ThreadPanelProps) {
  const { token } = useAuth();
  const { messages } = useMessages();
  
  // Get parent message and replies from the messages array
  const parent = messages.find(msg => msg.id === messageId);
  const replies = messages.filter(msg => msg.parentId === messageId)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Initial fetch only if parent isn't in messages
  useEffect(() => {
    async function fetchThread() {
      if (!parent) {
        try {
          const res = await fetch(`${API_URL}/messages/thread/${messageId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error(`Failed to fetch thread: ${res.status}`);
          const data = await res.json();
          // The parent and replies will be added to messages via WebSocket
        } catch (error) {
          console.error('Error fetching thread:', error);
        }
      }
    }
    if (messageId && token) {
      fetchThread();
    }
  }, [messageId, token, parent]);

  return (
    <div className="w-96 border-l border-gray-200 h-full flex flex-col bg-white">
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
          />
        )}
        
        <div className="space-y-4">
          {replies.map((reply) => (
            <MessageComponent
              key={reply.id}
              message={reply}
              onThreadClick={() => {}}
            />
          ))}
        </div>
      </div>

      {parent && (
        <div className="p-4 border-t border-gray-200">
          <MessageInput 
            parentId={messageId}
            placeholder="Reply to thread..."
            isThread={true}
          />
        </div>
      )}
    </div>
  );
}