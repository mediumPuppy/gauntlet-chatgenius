import React from 'react';
import { useParams } from 'react-router-dom';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { ChannelList } from '../components/chat/ChannelList';
import { OrganizationSwitcher } from '../components/organization/OrganizationSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { useChannels } from '../contexts/ChannelContext';
import { MessageProvider } from '../contexts/MessageContext';

const ChatPageContent: React.FC = () => {
  const { user } = useAuth();
  const { currentChannel } = useChannels();

  return (
    <div className="flex h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-primary-700 flex items-center px-4 z-50">
        <OrganizationSwitcher />
        <div className="flex-1" />
        <span className="text-white">
          {user?.username}
        </span>
      </header>

      {/* Sidebar */}
      <nav className="w-60 bg-gray-50 fixed left-0 top-16 bottom-0">
        <ChannelList />
      </nav>

      {/* Main Content */}
      <main className="flex-1 ml-60 mt-16 p-6 flex flex-col">
        {!currentChannel ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 transition-opacity duration-300">
            <h3 className="text-xl font-semibold mb-2">Welcome to Chat</h3>
            <p className="text-center">Select a channel from the sidebar to start chatting</p>
          </div>
        ) : (
          <div className="flex flex-col h-full transition-opacity duration-300">
            <MessageList />
            <MessageInput />
          </div>
        )}
      </main>
    </div>
  );
};

const ChatPage: React.FC = () => {
  const { channelId } = useParams();

  // If no channel is selected in the URL, show the base layout without messages
  if (!channelId) {
    return <ChatPageContent />;
  }

  // If a channel is selected, wrap the content with MessageProvider
  return (
    <MessageProvider channelId={channelId}>
      <ChatPageContent />
    </MessageProvider>
  );
};

export default ChatPage; 