import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useParams } from "react-router-dom";
import { MessageList } from "../components/chat/MessageList";
import { MessageInput } from "../components/chat/MessageInput";
import { ChannelList } from "../components/chat/ChannelList";
import { OrganizationSwitcher } from "../components/organization/OrganizationSwitcher";
import { useAuth } from "../contexts/AuthContext";
import { useChannels } from "../contexts/ChannelContext";
import { MessageProvider } from "../contexts/MessageContext";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { API_URL } from "../services/config";
import { usePresence } from "../contexts/PresenceContext";
import { UserAvatar } from "../components/common/UserAvatar";
import { GlobalMessageSearch } from "../components/global/GlobalMessageSearch";
import { ThreadPanel } from "../components/chat/ThreadPanel";
import { toggleAIEnabled, getAIEnabled } from "../services/aiSettings";
import { Tooltip } from "../components/common/Tooltip";

interface DMInfo {
  id: string;
  other_username: string;
  other_user_id: string;
}

const ChatPageContent: React.FC = memo(() => {
  const { logout } = useAuth();
  const { currentChannel } = useChannels();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { dmId } = useParams<{ dmId?: string }>();
  const [currentDM, setCurrentDM] = useState<DMInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { token } = useAuth();
  const { isUserOnline } = usePresence();
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [isTogglingAI, setIsTogglingAI] = useState(false);

  const fetchDMInfo = useCallback(
    async (id: string) => {
      if (!token) {
        console.error("No token available");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/dm/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("DM fetch failed:", response.status, errorText);
          throw new Error(`Failed to fetch DM info: ${errorText}`);
        }

        const dmInfo = await response.json();
        setCurrentDM(dmInfo);
      } catch (error) {
        console.error("Error fetching DM info:", error);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!dmId || isLoading) return;

    setIsLoading(true);
    fetchDMInfo(dmId).finally(() => setIsLoading(false));

    return () => {
      // Cleanup effect - clear DM info when unmounting or changing DMs
      setCurrentDM(null);
    };
  }, [dmId, fetchDMInfo]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleLogout = useCallback(() => {
    setShowLogoutConfirm(true);
  }, []);

  const handleCloseThread = () => setActiveThread(null);

  const renderHeader = useMemo(() => {
    if (currentDM) {
      return (
        <div className="flex items-center">
          <UserAvatar
            username={currentDM.other_username}
            isOnline={isUserOnline(currentDM.other_user_id)}
            size="sm"
          />
          <div className="ml-2">
            <div className="font-medium">{currentDM.other_username}</div>
            <div className="text-sm opacity-75">
              {isUserOnline(currentDM.other_user_id) ? "Online" : "Offline"}
            </div>
          </div>
        </div>
      );
    }
    if (currentChannel) {
      return (
        <div className="flex items-center">
          <span className="text-xl mr-2">#</span>
          <span>{currentChannel.name}</span>
        </div>
      );
    }
    return "Chat";
  }, [currentDM, currentChannel, isUserOnline]);

  const shouldShowWelcome = !dmId && !currentChannel;
  const shouldShowChat = Boolean(dmId) || Boolean(currentChannel);

  useEffect(() => {
    if (token) {
      getAIEnabled(token).then(setAiEnabled).catch(console.error);
    }
  }, [token]);

  const handleAIToggle = async () => {
    try {
      setIsTogglingAI(true);
      const newStatus = await toggleAIEnabled(token!);
      setAiEnabled(newStatus);
    } catch (error) {
      console.error("Failed to toggle AI:", error);
    } finally {
      setIsTogglingAI(false);
    }
  };

  return (
    <div className="flex h-screen relative">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-primary-600 flex items-center px-4 z-50">
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-white mr-4 hover:text-primary-200 transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <OrganizationSwitcher />
        <div className="flex-1 text-white font-medium ml-4">{renderHeader}</div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center mr-4">
            <button
              onClick={handleAIToggle}
              disabled={isTogglingAI}
              className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                aiEnabled ? "bg-primary-500" : "bg-gray-400"
              }`}
              role="switch"
              aria-checked={aiEnabled}
            >
              <span
                className={`${
                  aiEnabled ? "translate-x-6" : "translate-x-1"
                } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
              />
            </button>
            <Tooltip content="When enabled, AI will respond as you when mentioned or DMed">
              <button className="ml-2 text-white hover:text-teal-200 transition-colors">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </Tooltip>
          </div>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="text-white hover:text-teal-200 transition-colors mr-2"
            title="Search Messages"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>
          <button
            onClick={handleLogout}
            className="text-white hover:text-teal-200 transition-colors text-sm px-3 py-1 rounded border border-white/20 hover:border-teal-200"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <nav
        className={`
        w-60 bg-primary-700 fixed left-0 top-16 bottom-0 transform transition-transform duration-300 ease-in-out z-40
        lg:translate-x-0 lg:relative lg:top-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
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
      <main className="flex-1 mt-16 flex">
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? "" : "ml-1"}`}
        >
          <div className="h-full p-4 lg:p-0 lg:ml-1">
            {shouldShowWelcome && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <svg
                  className="w-16 h-16 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <h3 className="text-xl font-semibold mb-2">Welcome to Chat</h3>
                <p className="text-center">
                  Select a channel or direct message from the sidebar to start a
                  chatting
                </p>
              </div>
            )}
            {shouldShowChat && (
              <div className="flex flex-col h-full">
                <MessageList onThreadClick={setActiveThread} />
                <MessageInput />
              </div>
            )}
          </div>
        </div>

        {/* Thread Panel */}
        {activeThread && (
          <ThreadPanel messageId={activeThread} onClose={handleCloseThread} />
        )}
      </main>

      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={logout}
        action="logout"
      />

      {/* Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto relative">
            <button
              onClick={() => setIsSearchOpen(false)}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-900"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-4">Search Messages</h2>
            <GlobalMessageSearch onClose={() => setIsSearchOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
});

ChatPageContent.displayName = "ChatPageContent";

const ChatPage: React.FC = memo(() => {
  const { channelId, dmId } = useParams<{
    channelId?: string;
    dmId?: string;
  }>();

  // If no channel or DM is selected in the URL, show the base layout without messages
  if (!channelId && !dmId) {
    return <ChatPageContent />;
  }

  // If a channel or DM is selected, wrap the content with MessageProvider
  return (
    <MessageProvider channelId={channelId || dmId || ""} isDM={Boolean(dmId)}>
      <ChatPageContent />
    </MessageProvider>
  );
});

ChatPage.displayName = "ChatPage";

export default ChatPage;
