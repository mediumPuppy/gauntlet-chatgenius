import { useEffect, useRef, useState, useCallback } from 'react';
import { useMessages } from '../../contexts/MessageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useChannels } from '../../contexts/ChannelContext';

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageList() {
  const { messages, typingUsers, isConnected } = useMessages();
  const { user } = useAuth();
  const { currentChannel } = useChannels();
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

  const formatTypingUsers = (users: typeof typingUsers) => {
    if (users.length === 0) return '';
    
    // Filter out current user
    const otherUsers = users.filter(u => u.userId !== user?.id);
    if (otherUsers.length === 0) return '';

    const names = otherUsers.map(u => u.username);
    const joinedNames = names.join(', ');
    
    if (joinedNames.length <= 20) {
      return joinedNames;
    }
    
    // Find the maximum number of names that fit within 20 chars
    const displayNames = [];
    let totalLength = 0;
    for (const name of names) {
      if (totalLength + name.length + 2 > 20) { // +2 for ", "
        break;
      }
      displayNames.push(name);
      totalLength += name.length + 2;
    }
    
    return `${displayNames.join(', ')} and others`;
  };

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4"
    >
      {!currentChannel ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-xl font-semibold mb-2">Welcome to Chat</h3>
          <p className="text-center">Select a channel from the sidebar to start chatting</p>
        </div>
      ) : (
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
            <div className="h-6">
              {typingUsers.length > 0 && typingUsers.some(u => u.userId !== user?.id) && (
                <div className="text-sm text-gray-500 italic">
                  <span className="font-bold">
                    {formatTypingUsers(typingUsers)}
                  </span>{' '}
                  {typingUsers.filter(u => u.userId !== user?.id).length === 1 ? 'is' : 'are'} typing...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {!isConnected && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg">
          Reconnecting...
        </div>
      )}
    </div>
  );
} 