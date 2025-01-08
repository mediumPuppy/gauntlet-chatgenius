import { useEffect, useRef, useState, useCallback, memo, useMemo } from 'react';
import { useMessages } from '../../contexts/MessageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useChannels } from '../../contexts/ChannelContext';
import { useParams } from 'react-router-dom';
import { Message as MessageType } from '../../types/message';

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Memoized Message component
const Message = memo(({ message }: { message: MessageType }) => {
  if (!message.senderName) {
    console.error('Message missing senderName:', message);
    return null;
  }

  return (
    <div className="flex items-start">
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
  );
});

Message.displayName = 'Message';

// Memoized typing indicator component
const TypingIndicator = memo(({ typingUsers, currentUserId }: { typingUsers: any[], currentUserId?: string }) => {
  const formatTypingUsers = useCallback((users: typeof typingUsers) => {
    if (users.length === 0) return '';
    
    // Filter out current user
    const otherUsers = users.filter(u => u.userId !== currentUserId);
    if (otherUsers.length === 0) return '';

    const names = otherUsers.map(u => u.username);
    const joinedNames = names.join(', ');
    
    if (joinedNames.length <= 20) {
      return joinedNames;
    }
    
    const displayNames = [];
    let totalLength = 0;
    for (const name of names) {
      if (totalLength + name.length + 2 > 20) {
        break;
      }
      displayNames.push(name);
      totalLength += name.length + 2;
    }
    
    return `${displayNames.join(', ')} and others`;
  }, [currentUserId]);

  if (!typingUsers.length || !typingUsers.some(u => u.userId !== currentUserId)) {
    return null;
  }

  return (
    <div className="text-sm text-gray-500 italic">
      <span className="font-bold">
        {formatTypingUsers(typingUsers)}
      </span>{' '}
      {typingUsers.filter(u => u.userId !== currentUserId).length === 1 ? 'is' : 'are'} typing...
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';

export function MessageList() {
  const { messages, typingUsers, showReconnecting } = useMessages();
  const { user } = useAuth();
  // const { currentChannel } = useChannels();
  // const { dmId } = useParams<{ dmId?: string }>();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const prevMessageLengthRef = useRef(messages.length);

  // Memoize sorted messages
  const sortedMessages = useMemo(() => 
    [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  const isNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    
    const threshold = 100; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  const handleScroll = useCallback(() => {
    setShouldAutoScroll(isNearBottom());
  }, [isNearBottom]);

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
    const forceScroll = messages.length > prevMessageLengthRef.current;
    prevMessageLengthRef.current = messages.length;
    scrollToBottom(forceScroll);
  }, [messages.length, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom(true);
  }, [scrollToBottom]);

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 lg:p-0 lg:ml-0"
    >
      <div className="flex flex-col min-h-full justify-end">
        <div className="space-y-4">
          {sortedMessages.map(message => (
            <Message key={message.id} message={message} />
          ))}
          <div className="h-6">
            <TypingIndicator typingUsers={typingUsers} currentUserId={user?.id} />
          </div>
        </div>
      </div>
      {showReconnecting && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg">
          Reconnecting...
        </div>
      )}
    </div>
  );
} 