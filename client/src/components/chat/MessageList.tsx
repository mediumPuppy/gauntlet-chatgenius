import { useEffect, useRef, useState, useCallback, memo, useMemo } from "react";
import { useMessages } from "../../contexts/MessageContext";
import { useAuth } from "../../contexts/AuthContext";
import { Message as MessageType } from "../../types/message";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { addReaction } from "../../services/reactions";
// import { useNavigate } from 'react-router-dom';

// Memoized Message component
const Message = memo(
  ({
    message,
    onThreadClick,
    isHighlighted,
  }: {
    message: MessageType;
    onThreadClick: (threadId: string) => void;
    isHighlighted?: boolean;
  }) => {
    // const navigate = useNavigate();
    const { token, user } = useAuth();
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showAbove, setShowAbove] = useState(false);
    const messageRef = useRef<HTMLDivElement>(null);
    const plusButtonRef = useRef<HTMLButtonElement>(null);

    // Update the reactions useMemo with better logging
    const reactions = useMemo(() => {
      if (!message.reactions) return {};
      return message.reactions;
    }, [message.reactions]);

    const handleEmojiSelect = async (emoji: any) => {
      try {
        console.log("Selected emoji full object:", emoji);
        console.log("Selected emoji native:", emoji.native);
        await addReaction(token!, message.id, emoji.native);
        setShowEmojiPicker(false);
      } catch (error) {
        console.error("Failed to add reaction:", error);
      }
    };

    const handleReactionClick = async (emoji: string) => {
      try {
        console.log("Clicking reaction:", emoji);
        await addReaction(token!, message.id, emoji);
      } catch (error) {
        console.error("Failed to toggle reaction:", error);
      }
    };

    const renderContent = (content: string) => {
      // Handle existing image markdown
      const imageMatch = content.match(/!\[(.*?)\]\((.*?)\)/);
      if (imageMatch) {
        return (
          <div className="mt-1">
            <img
              src={imageMatch[2]}
              alt={imageMatch[1]}
              className="max-w-[300px] max-h-[300px] rounded-lg object-contain cursor-pointer hover:opacity-90"
              onClick={() => window.open(imageMatch[2], "_blank")}
              loading="lazy"
            />
          </div>
        );
      }

      // Handle existing file links
      const linkMatch = content.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        return (
          <div className="mt-1">
            <a
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 underline"
            >
              <span>{linkMatch[1]}</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        );
      }

      // Handle mentions and preserve line breaks
      const parts = content.split(/(@\w+)/g);
      return (
        <p className="text-gray-800 emoji whitespace-pre-wrap">
          {parts.map((part, i) => {
            if (part.startsWith("@")) {
              return (
                <span key={i} className="bg-yellow-100 rounded px-1">
                  {part}
                </span>
              );
            }
            return part;
          })}
        </p>
      );
    };

    // Add function to determine picker position
    const updatePickerPosition = useCallback(() => {
      if (!messageRef.current) return;

      const messageRect = messageRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const messageMiddle = messageRect.top + messageRect.height / 2;

      // If message is in the bottom half of viewport, show picker above
      setShowAbove(messageMiddle > viewportHeight / 2);
    }, []);

    // Update position when emoji picker is opened
    useEffect(() => {
      if (showEmojiPicker) {
        updatePickerPosition();
      }
    }, [showEmojiPicker, updatePickerPosition]);

    const handleClickOutside = (event: MouseEvent) => {
      if (plusButtonRef.current?.contains(event.target as Node)) {
        return;
      }
      setShowEmojiPicker(false);
    };

    useEffect(() => {
      if (isHighlighted && messageRef.current) {
        messageRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, [isHighlighted]);

    return (
      <div
        ref={messageRef}
        className={`group relative flex flex-col p-4 transition-colors duration-300
        ${isHighlighted ? "bg-yellow-50" : "hover:bg-gray-50"}`}
      >
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline space-x-2">
            <span className="font-medium text-gray-900">
              {message.senderName}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {message.hasReplies ? (
            <button
              onClick={() => onThreadClick(message.id)}
              className="hidden group-hover:inline-block text-sm text-primary-600 hover:underline"
            >
              Thread ({message.replyCount})
            </button>
          ) : (
            <button
              onClick={() => onThreadClick(message.id)}
              className="hidden group-hover:inline-block text-sm text-primary-600 hover:underline"
            >
              Reply
            </button>
          )}
        </div>
        {renderContent(message.content)}

        {/* Add reactions bar */}
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(reactions).map(([emoji, users]) => {
            // Ensure users is always an array
            const userArray = Array.isArray(users) ? users : [];
            return (
              <button
                key={emoji}
                onClick={() => handleReactionClick(emoji)}
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs
                ${userArray.includes(user?.id || "") ? "bg-primary-100" : "bg-gray-100"}
                hover:bg-primary-200 transition-colors`}
              >
                <span className="emoji">{emoji}</span>
                <span className="ml-1">{userArray.length}</span>
              </button>
            );
          })}

          <button
            ref={plusButtonRef}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <span>+</span>
          </button>
        </div>

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div
            className={`absolute z-10 ${showAbove ? "bottom-full mb-2" : "top-full mt-2"}`}
          >
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              onClickOutside={handleClickOutside}
            />
          </div>
        )}
      </div>
    );
  },
);

Message.displayName = "Message";

// Memoized typing indicator component
const TypingIndicator = memo(
  ({
    typingUsers,
    currentUserId,
  }: {
    typingUsers: any[];
    currentUserId?: string;
  }) => {
    const formatTypingUsers = useCallback(
      (users: typeof typingUsers) => {
        if (users.length === 0) return "";

        // Filter out current user
        const otherUsers = users.filter((u) => u.userId !== currentUserId);
        if (otherUsers.length === 0) return "";

        const names = otherUsers.map((u) => u.username);
        const joinedNames = names.join(", ");

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

        return `${displayNames.join(", ")} and others`;
      },
      [currentUserId],
    );

    if (
      !typingUsers.length ||
      !typingUsers.some((u) => u.userId !== currentUserId)
    ) {
      return null;
    }

    return (
      <div className="text-sm text-gray-500 italic">
        <span className="font-bold">{formatTypingUsers(typingUsers)}</span>{" "}
        {typingUsers.filter((u) => u.userId !== currentUserId).length === 1
          ? "is"
          : "are"}{" "}
        typing...
      </div>
    );
  },
);

TypingIndicator.displayName = "TypingIndicator";

export function MessageList({
  onThreadClick,
}: {
  onThreadClick: (id: string) => void;
}) {
  const { messages, typingUsers, showReconnecting } = useMessages();
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const prevMessageLengthRef = useRef(messages.length);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [disableAutoScroll, setDisableAutoScroll] = useState(false);

  // Memoize sorted messages
  const sortedMessages = useMemo(
    () =>
      [...messages]
        .filter((msg) => !msg.parentId) // Only show messages that aren't replies
        .sort((a, b) => a.timestamp - b.timestamp),
    [messages],
  );

  const isNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;

    const threshold = 100; // pixels from bottom
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  }, []);

  const handleScroll = useCallback(() => {
    setShouldAutoScroll(isNearBottom());
  }, [isNearBottom]);

  const scrollToBottom = useCallback(
    (force = false) => {
      const container = scrollContainerRef.current;
      if (container && !disableAutoScroll && (force || shouldAutoScroll)) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      }
    },
    [shouldAutoScroll, disableAutoScroll],
  );

  useEffect(() => {
    const forceScroll = messages.length > prevMessageLengthRef.current;
    prevMessageLengthRef.current = messages.length;
    scrollToBottom(forceScroll);
  }, [messages.length, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom(true);
  }, [scrollToBottom]);

  useEffect(() => {
    // Check for highlighted message in sessionStorage
    const stored = sessionStorage.getItem("highlightMessage");
    if (stored) {
      const { id, fromSearch } = JSON.parse(stored);
      setHighlightedId(id);
      setDisableAutoScroll(true); // Disable auto-scroll when highlighting

      // Clear highlight after delay but keep auto-scroll disabled if from search
      setTimeout(() => {
        setHighlightedId(null);
        // Only re-enable auto-scroll if not from search
        if (!fromSearch) {
          setDisableAutoScroll(false);
        }
        sessionStorage.removeItem("highlightMessage");
      }, 3000);
    }
  }, [messages]);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 lg:p-0 lg:ml-0"
    >
      <div className="flex flex-col min-h-full justify-end">
        <div className="space-y-4">
          {sortedMessages.map((message) => (
            <Message
              key={message.id}
              message={message}
              onThreadClick={onThreadClick}
              isHighlighted={message.id === highlightedId}
            />
          ))}
          <div className="h-6">
            <TypingIndicator
              typingUsers={typingUsers}
              currentUserId={user?.id}
            />
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

export { Message };
