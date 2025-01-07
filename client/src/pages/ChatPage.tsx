import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { ChannelList } from '../components/chat/ChannelList';
import { OrganizationSwitcher } from '../components/organization/OrganizationSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { useChannels } from '../contexts/ChannelContext';
import { MessageProvider } from '../contexts/MessageContext';

const ChatPageContent: React.FC = () => {
  const { user, logout } = useAuth();
  const { currentChannel } = useChannels();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-primary-600 flex items-center px-4 z-50">
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-white mr-4 hover:text-primary-200 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <OrganizationSwitcher />
        <div className="flex-1" />
        <div className="flex items-center space-x-4">
          <button
            onClick={logout}
            className="text-white hover:text-teal-200 transition-colors text-sm px-3 py-1 rounded border border-white/20 hover:border-teal-200"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <nav className={`
        w-60 bg-primary-700 fixed left-0 top-16 bottom-0 transform transition-transform duration-300 ease-in-out z-40
        lg:translate-x-0 lg:relative lg:top-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <ChannelList onChannelSelect={() => setIsSidebarOpen(false)} />
      </nav>

      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={`
        flex-1 mt-16 flex flex-col transition-all duration-300 ease-in-out
        ${isSidebarOpen ? '' : 'ml-1'}
      `}>
        <div className="h-full p-4 lg:p-0 lg:ml-1">
          {!currentChannel ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <h3 className="text-xl font-semibold mb-2">Welcome to Chat</h3>
              <p className="text-center">Select a channel from the sidebar to start chatting</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <MessageList />
              <MessageInput />
            </div>
          )}
        </div>
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