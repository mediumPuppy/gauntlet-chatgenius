import React from 'react';
import { useMessages } from '../../contexts/MessageContext';
import { useAuth } from '../../contexts/AuthContext';

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageList() {
  const { messages, typingUsers, isConnected } = useMessages();
  const { user } = useAuth();

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-4">
        {messages.map(message => (
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
      {!isConnected && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg">
          Reconnecting...
        </div>
      )}
    </div>
  );
} 