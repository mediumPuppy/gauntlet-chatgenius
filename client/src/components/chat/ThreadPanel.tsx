// client/src/components/chat/ThreadPanel.tsx
import { useEffect, useState } from 'react';
import { Message } from '../../types/message';
import { MessageInput } from './MessageInput';
import { API_URL } from '../../services/config';
import { MessageProvider } from '../../contexts/MessageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMessages } from '../../contexts/MessageContext';

interface ThreadPanelProps {
  messageId: string;
  onClose: () => void;
}

export function ThreadPanel({ messageId, onClose }: ThreadPanelProps) {
  const [parent, setParent] = useState<Message | null>(null);
  const [replies, setReplies] = useState<Message[]>([]);
  const { token } = useAuth();
  const { messages } = useMessages();

  // Initial fetch of thread data
  useEffect(() => {
    async function fetchThread() {
      try {
        const res = await fetch(`${API_URL}/messages/thread/${messageId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch thread: ${res.status}`);
        }
        
        const data = await res.json();
        setParent(data.parent);
        setReplies(data.replies);
      } catch (error) {
        console.error('Error fetching thread:', error);
      }
    }
    if (messageId && token) {
      fetchThread();
    }
  }, [messageId, token]);

  // Update replies when new messages come in
  useEffect(() => {
    const newReplies = messages.filter(msg => msg.parentId === messageId);
    if (newReplies.length > replies.length) {
      setReplies(prev => [...prev, ...newReplies.slice(prev.length)]);
    }
  }, [messages, messageId, replies.length]);

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
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <div className="font-medium">{parent.senderName}</div>
            <p>{parent.content}</p>
          </div>
        )}
        
        <div className="space-y-4">
          {replies.map((reply) => (
            <div key={reply.id} className="p-2">
              <div className="font-medium">{reply.senderName}</div>
              <p>{reply.content}</p>
            </div>
          ))}
        </div>
      </div>

      {parent && (
        <MessageProvider channelId={parent.channelId || ''} isDM={false}>
          <div className="p-4 border-t border-gray-200">
            <MessageInput 
              parentId={messageId}
              placeholder={`Reply to thread...`}
              isThread={true}
            />
          </div>
        </MessageProvider>
      )}
    </div>
  );
}