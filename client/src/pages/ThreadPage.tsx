import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_URL } from "../services/config";
import { Message } from "../types/message";
import { MessageInput } from "../components/chat/MessageInput";
import { MessageProvider } from "../contexts/MessageContext";

interface ThreadResponse {
  parent: Message;
  replies: Message[];
}

export default function ThreadPage() {
  const { messageId } = useParams();
  const [parent, setParent] = useState<Message | null>(null);
  const [replies, setReplies] = useState<Message[]>([]);

  useEffect(() => {
    async function fetchThread() {
      try {
        const res = await fetch(`${API_URL}/thread/${messageId}`, {
          // add auth headers, etc
          // Add your headers or auth tokens as needed
        });
        const data: ThreadResponse = await res.json();

        // Set state with proper types
        setParent(data.parent);
        setReplies(data.replies);
      } catch (error) {
        console.error("Error fetching thread:", error);
      }
    }
    if (messageId) {
      fetchThread();
    }
  }, [messageId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-lg font-bold mb-3">Thread View</h2>

        {parent && (
          <>
            <div className="mb-2">
              <p className="font-semibold">Message:</p>
              <p>{parent.content}</p>
            </div>
            <hr className="my-4" />
          </>
        )}

        <div>
          <p className="font-semibold mb-2">Replies:</p>
          {replies.length === 0 && <p>No replies yet.</p>}
          {replies.map((r) => (
            <div key={r.id} className="mb-2 border border-gray-200 p-2 rounded">
              <p>{r.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Wrap MessageInput with MessageProvider for thread context */}
      {messageId && parent && (
        <MessageProvider channelId={parent.channelId!} isDM={false}>
          <div className="mt-auto">
            <MessageInput
              parentId={messageId}
              placeholder={`Reply to ${parent.senderName}'s message...`}
              isThread={true}
            />
          </div>
        </MessageProvider>
      )}
    </div>
  );
}
