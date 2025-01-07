import { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages } from '../../contexts/MessageContext';
import { useAuth } from '../../contexts/AuthContext';

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageList() {
  const { messages, typingUsers, isConnected } = useMessages();
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const prevMessageLengthRef = useRef(messages.length);

  const isNearBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    
    const threshold = 100; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  const handleScroll = () => {
    setShouldAutoScroll(isNearBottom());
  };

  const scrollToBottom = useCallback((force = false) => {
    const container = scrollContainerRef.current;
    if (container && (force || shouldAutoScroll)) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [shouldAutoScroll]);

  useEffect(() => {
    // Force scroll to bottom if we sent a new message (messages length increased)
    const forceScroll = messages.length > prevMessageLengthRef.current;
    prevMessageLengthRef.current = messages.length;
    
    scrollToBottom(forceScroll);
  }, [messages, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom(true);
  }, [scrollToBottom]);

  // Sort messages by timestamp in ascending order (oldest to newest)
  const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4"
    >
      <div className="flex flex-col min-h-full justify-end">
        <div className="space-y-4">
          {sortedMessages.map(message => (
            <div key={message.id} className="flex items-start">
              <div className="w-10 h-10 rounded-full bg-gray-300 flex-shrink-0 flex items-center justify-center text-gray-600">
                {message.senderName[0].toUpperCase()}
              </div>
              <div className="ml-3">
                <div className="flex items-baseline">
                  <span className="font-medium">{message.senderName}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    {formatDate(message.timestamp)}
                  </span>
                </div>
                <p className="text-gray-800">{message.content}</p>
              </div>
            </div>
          ))}
          {typingUsers.length > 0 && (
            <div className="text-sm text-gray-500 italic">
              {typingUsers
                .filter(u => u.userId !== user?.id)
                .map(u => u.username)
                .join(', ')}{' '}
              {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
        </div>
      </div>
      {!isConnected && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg">
          Reconnecting...
        </div>
      )}
    </div>
  );
} 