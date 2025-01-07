import React, { useState } from 'react';
import { useMessages } from '../../contexts/MessageContext';
import { useChannels } from '../../contexts/ChannelContext';

export function MessageInput() {
  const [newMessage, setNewMessage] = useState('');
  const { sendMessage, sendTyping } = useMessages();
  const { currentChannel } = useChannels();
  let typingTimeout: ReturnType<typeof setTimeout>;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChannel || !newMessage.trim()) return;

    sendMessage(newMessage.trim());
    setNewMessage('');
  };

  const handleTyping = () => {
    clearTimeout(typingTimeout);
    sendTyping();
    typingTimeout = setTimeout(() => {
      // Typing stopped
    }, 3000);
  };

  return (
    <div className="h-24 border-t p-4">
      <form onSubmit={handleSendMessage} className="h-full">
        <div className="bg-gray-50 rounded-lg flex items-stretch h-full">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            placeholder={currentChannel ? `Message ${currentChannel.is_dm ? '' : '#'}${currentChannel.name}` : 'Select a conversation to start messaging'}
            disabled={!currentChannel}
            className="flex-1 bg-transparent outline-none px-3"
          />
          <button
            type="submit"
            disabled={!currentChannel || !newMessage.trim()}
            className="group w-12 md:w-16 bg-primary-300 hover:bg-primary-200 disabled:opacity-50 disabled:hover:bg-primary-300 transition-all duration-200 rounded-r-lg flex items-center justify-center"
          >
            <svg
              className="w-6 h-6 text-primary-800 transform transition-all duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-110"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 12h14m0 0l-6-6m6 6l-6 6"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}