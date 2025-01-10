import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../services/config';
import type { Message as MessageType } from '../types/message';
import { Message } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { MessageProvider } from '../contexts/MessageContext';
import { useAuth } from '../contexts/AuthContext';
import { useMessages } from '../contexts/MessageContext';

interface ThreadResponse {
  parent: MessageType;
  replies: MessageType[];
}

export default function ThreadPage() {
  const { messageId } = useParams();
  const { token } = useAuth();
  const [parent, setParent] = useState<MessageType | null>(null);
  const { messages } = useMessages();

  useEffect(() => {
    async function fetchThread() {
      if (!token || !messageId) return;
      
      try {
        const res = await fetch(`${API_URL}/thread/${messageId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data: ThreadResponse = await res.json();
        setParent(data.parent);
      } catch (error) {
        console.error('Error fetching thread:', error);
      }
    }

    fetchThread();
  }, [messageId, token]);

  const replies = useMemo(() => {
    return messages.filter(msg => msg.parentId === messageId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [messages, messageId]);

  if (!parent || !messageId) return null;

  return (
    <MessageProvider channelId={parent.channelId!} isDM={false} parentId={messageId}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 border-b pb-4">
            <Message 
              message={parent} 
              onThreadClick={() => {}} 
              isHighlighted={false}
            />
          </div>

          <div className="space-y-4">
            {replies.map((reply) => (
              <Message 
                key={reply.id}
                message={reply}
                onThreadClick={() => {}}
                isHighlighted={false}
              />
            ))}
          </div>
        </div>

        <div className="p-4 border-t">
          <MessageInput 
            parentId={messageId}
            placeholder={`Reply to ${parent.senderName}'s message...`}
            isThread={true}
          />
        </div>
      </div>
    </MessageProvider>
  );
}