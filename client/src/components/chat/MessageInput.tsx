import React, { useState, useRef, useCallback } from 'react';
import { useMessages } from '../../contexts/MessageContext';
import { useChannels } from '../../contexts/ChannelContext';
import { useParams } from 'react-router-dom';

export function MessageInput() {
  const [newMessage, setNewMessage] = useState('');
  const { sendMessage, sendTyping } = useMessages();
  const { currentChannel } = useChannels();
  const { dmId } = useParams<{ dmId?: string }>();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastTypingRef = useRef<number>(0);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const messageText = newMessage.trim();
    if ((!currentChannel && !dmId) || !messageText) return;

    sendMessage(messageText);
    setNewMessage('');
  };

  const handleTyping = useCallback(() => {
    const now = Date.now();
    // Only send typing event if it's been more than 2 seconds since the last one
    // AND we have a valid channel/DM
    if ((!currentChannel && !dmId) || now - lastTypingRef.current < 2000) {
      return;
    }

    lastTypingRef.current = now;
    sendTyping();

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = undefined;
      lastTypingRef.current = 0; // Reset last typing time when typing stops
    }, 3000);
  }, [sendTyping, currentChannel, dmId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault(); // Prevent newline
      handleSendMessage();
    }
  };

  const getPlaceholder = () => {
    if (dmId) {
      return 'Type your message...';
    }
    if (currentChannel) {
      return `Message #${currentChannel.name}`;
    }
    return 'Select a conversation to start messaging';
  };

  const isDisabled = !currentChannel && !dmId;

  return (
    <div className="h-auto min-h-[5rem] max-h-[12rem] border-t p-4">
      <form onSubmit={handleSendMessage} className="h-full">
        <div className="bg-gray-50 rounded-lg flex h-full">
          <textarea
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
              // Auto-adjust height
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={isDisabled}
            className="flex-1 bg-transparent p-3 resize-none focus:outline-none disabled:cursor-not-allowed"
            rows={1}
          />
          <button
            type="submit"
            disabled={isDisabled || !newMessage.trim()}
            className="px-4 py-2 text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}