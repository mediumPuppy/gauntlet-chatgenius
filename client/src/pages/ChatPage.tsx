import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { ChannelList } from '../components/chat/ChannelList';
import { OrganizationSwitcher } from '../components/organization/OrganizationSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { useChannels } from '../contexts/ChannelContext';
import { MessageProvider } from '../contexts/MessageContext';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { API_URL } from '../services/config';

interface DMInfo {
  id: string;
  other_username: string;
  other_user_id: string;
}

const ChatPageContent: React.FC = () => {
  const { logout } = useAuth();
  const { currentChannel } = useChannels();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { dmId } = useParams<{ dmId?: string }>();
  const [currentDM, setCurrentDM] = useState<DMInfo | null>(null);
  const { token } = useAuth();

  console.log('ChatPageContent render:', { dmId, currentDM, currentChannel });

  useEffect(() => {
    const fetchDMInfo = async () => {
      if (!dmId || !token) {
        console.log('Missing dmId or token:', { dmId, hasToken: !!token });
        return;
      }

      try {
        console.log('Fetching DM info for:', dmId);
        const response = await fetch(`${API_URL}/dm/${dmId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('DM fetch failed:', response.status, errorText);
          throw new Error(`Failed to fetch DM info: ${errorText}`);
        }

        const dmInfo = await response.json();
        console.log('Fetched DM info:', dmInfo);
        setCurrentDM(dmInfo);
      } catch (error) {
        console.error('Error fetching DM info:', error);
      }
    };

    if (dmId) {
      console.log('DM ID changed, fetching info:', dmId);
      fetchDMInfo();
    } else {
      console.log('No DM ID, clearing currentDM');
      setCurrentDM(null);
    }
  }, [dmId, token]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const getHeaderTitle = () => {
    if (currentDM) {
      return `Chat with ${currentDM.other_username}`;
    }
    if (currentChannel) {
      return `#${currentChannel.name}`;
    }
    return 'Chat';
  };

  const shouldShowWelcome = !dmId && !currentChannel;
  const shouldShowChat = Boolean(dmId) || Boolean(currentChannel);

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
        <div className="flex-1 text-white font-medium ml-4">{getHeaderTitle()}</div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleLogout}
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
          {shouldShowWelcome && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="text-xl font-semibold mb-2">Welcome to Chat</h3>
              <p className="text-center">Select a channel or direct message from the sidebar to start chatting</p>
            </div>
          )}
          {shouldShowChat && (
            <div className="flex flex-col h-full">
              <MessageList />
              <MessageInput />
            </div>
          )}
        </div>
      </main>

      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={logout}
        action="logout"
      />
    </div>
  );
};

const ChatPage: React.FC = () => {
  const { channelId, dmId } = useParams<{ channelId?: string; dmId?: string }>();

  console.log('ChatPage params:', { channelId, dmId });

  // If no channel or DM is selected in the URL, show the base layout without messages
  if (!channelId && !dmId) {
    return <ChatPageContent />;
  }

  // If a channel or DM is selected, wrap the content with MessageProvider
  return (
    <MessageProvider channelId={channelId || dmId || ''} isDM={Boolean(dmId)}>
      <ChatPageContent />
    </MessageProvider>
  );
};

export default ChatPage;