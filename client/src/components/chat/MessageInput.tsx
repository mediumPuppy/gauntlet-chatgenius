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
      <form onSubmit={handleSendMessage}>
        <div className="bg-gray-100 rounded-lg p-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            placeholder={currentChannel ? `Message ${currentChannel.is_dm ? '' : '#'}${currentChannel.name}` : 'Select a conversation to start messaging'}
            disabled={!currentChannel}
            className="w-full bg-transparent outline-none"
          />
        </div>
      </form>
    </div>
  );
} 