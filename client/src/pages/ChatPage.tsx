import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useParams } from "react-router-dom";
import { MessageList } from "../components/chat/MessageList";
import { MessageInput } from "../components/chat/MessageInput";
import { ChannelList } from "../components/chat/ChannelList";
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
import { PageTransition } from "../components/transitions/PageTransition";
import { AnimatePresence, motion } from "framer-motion";

interface DMInfo {
  id: string;
  other_username: string;
  other_user_id: string;
}

const ChatPageContent: React.FC = memo(() => {
  const { logout } = useAuth();
  const { currentChannel } = useChannels();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
    return "ChatGenius";
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

  useEffect(() => {
    // Close sidebar on mobile when route changes
    setIsSidebarOpen(false);
  }, [location.pathname]); // Add location from useLocation hook

  return (
    <PageTransition
      transitionKey={`chat-${location.pathname}`}
    >
      <div className="flex h-screen relative">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 h-16 bg-primary-600 flex items-center px-1 sm:px-2 md:px-4 z-50">
          {/* Menu Button - More compact on mobile */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-1.5 sm:p-2 -ml-0.5 sm:-ml-1 mr-1 sm:mr-2 text-white hover:text-primary-200 transition-colors rounded-full hover:bg-white/10 active:bg-white/20"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Channel/DM Header - Smaller text on mobile */}
          <div className="flex-1 min-w-0 text-white font-medium ml-2 sm:ml-3 md:ml-4 text-sm sm:text-base">
            <div className="truncate">{renderHeader}</div>
          </div>

          {/* Action Buttons - Tighter spacing on mobile */}
          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-4">
            {/* AI Toggle - More compact on mobile */}
            <div className="flex items-center">
              <button
                onClick={handleAIToggle}
                disabled={isTogglingAI}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  aiEnabled ? "bg-primary-500" : "bg-gray-400"
                }`}
                role="switch"
                aria-checked={aiEnabled}
              >
                <span
                  className={`${
                    aiEnabled ? "translate-x-5" : "translate-x-0"
                  } pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                >
                  <span
                    className={`${
                      aiEnabled ? "opacity-0 duration-100 ease-out" : "opacity-100 duration-200 ease-in"
                    } absolute inset-0 flex h-full w-full items-center justify-center transition-opacity`}
                    aria-hidden="true"
                  >
                    <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 12 12">
                      <path
                        d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span
                    className={`${
                      aiEnabled ? "opacity-100 duration-200 ease-in" : "opacity-0 duration-100 ease-out"
                    } absolute inset-0 flex h-full w-full items-center justify-center transition-opacity`}
                    aria-hidden="true"
                  >
                    <svg className="h-3 w-3 text-primary-600" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                    </svg>
                  </span>
                </span>
              </button>
              <Tooltip content="When enabled, AI will respond as you when mentioned or DMed">
                <button className="ml-2 p-2 text-white hover:text-teal-200 transition-colors rounded-full hover:bg-white/10">
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

            {/* Search Button - Enhanced touch target */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 text-white hover:text-teal-200 transition-colors rounded-full hover:bg-white/10"
              aria-label="Search Messages"
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

            {/* Logout Button - More compact on mobile */}
            <button
              onClick={handleLogout}
              className="hidden md:block text-white hover:text-teal-200 transition-colors text-sm px-3 py-1 rounded border border-white/20 hover:border-teal-200"
            >
              Logout
            </button>
            <button
              onClick={handleLogout}
              className="md:hidden p-2 text-white hover:text-teal-200 transition-colors rounded-full hover:bg-white/10"
              aria-label="Logout"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* Main Layout */}
        <div className="flex w-full mt-16">
          {/* Sidebar */}
          <nav
            className={`
            w-60 bg-primary-700 fixed lg:static h-[calc(100vh-4rem)] overflow-y-auto
            transform transition-transform duration-300 ease-in-out z-40
            ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
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
          <main className="flex-1 flex">
            <div className="flex-1 flex flex-col w-full">
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
                    <h3 className="text-xl font-semibold mb-2">Welcome to ChatGenius</h3>
                    <p className="text-center">
                      Select a channel or direct message from the sidebar to start chatting
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

            {/* Thread Panel with Overlay */}
            <AnimatePresence mode="wait">
              {activeThread && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
                    onClick={handleCloseThread}
                  />
                  <div className={`
                    fixed right-0 top-16 bottom-0 w-full sm:w-96 bg-white z-50
                    lg:relative lg:top-0 lg:w-96 lg:z-0
                    shadow-lg overflow-y-auto
                  `}>
                    <ThreadPanel 
                      messageId={activeThread} 
                      onClose={handleCloseThread}
                    />
                  </div>
                </>
              )}
            </AnimatePresence>
          </main>
        </div>

        <ConfirmModal
          isOpen={showLogoutConfirm}
          onClose={() => setShowLogoutConfirm(false)}
          onConfirm={logout}
          action="logout"
        />

        {/* Search Modal with Animation */}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
              onClick={(e) => e.target === e.currentTarget && setIsSearchOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto relative"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="absolute top-4 right-4 text-gray-600 hover:text-gray-900"
                >
                  ✕
                </button>
                <h2 className="text-2xl font-bold mb-4">Search Messages</h2>
                <GlobalMessageSearch onClose={() => setIsSearchOpen(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
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
