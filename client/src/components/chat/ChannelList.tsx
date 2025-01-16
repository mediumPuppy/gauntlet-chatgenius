import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useOrganization } from "../../contexts/OrganizationContext";
import { useChannels } from "../../contexts/ChannelContext";
import { getDMs } from "../../services/user";
import StartDMDialog from "./StartDMDialog";
import ChannelDialog from "./ChannelDialog";
import { usePresence } from "../../contexts/PresenceContext";
import { UserAvatar } from "../common/UserAvatar";
import { OrganizationDialog } from "../organization/OrganizationDialog";
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from "framer-motion";

interface Channel {
  id: string;
  name: string;
  is_dm: boolean;
  created_at: string;
}

interface DM {
  id: string;
  other_username: string;
  other_user_id: string;
  created_at: string;
}

interface ChannelListProps {
  onChannelSelect?: () => void;
}

export function ChannelList({ onChannelSelect }: ChannelListProps) {
  const { token } = useAuth();
  const { currentOrganization } = useOrganization();
  const { channelId, dmId } = useParams();
  const {
    setCurrentChannel,
    isLoading: channelsLoading,
    channels: contextChannels,
  } = useChannels();
  const [localChannels, setLocalChannels] = useState<Channel[]>([]);
  const [dms, setDMs] = useState<DM[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDMDialogOpen, setIsDMDialogOpen] = useState(false);
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const prevOrgIdRef = useRef<string | null>(null);
  const { isUserOnline } = usePresence();
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const { userRole } = useOrganization();
  const isAdmin = userRole === "owner" || userRole === "admin";
  const [showChannels, setShowChannels] = useState(true);
  const [showDirectMessages, setShowDirectMessages] = useState(true);

  // Keep showing old channels until new ones load
  useEffect(() => {
    if (!channelsLoading) {
      setLocalChannels(contextChannels);
    }
  }, [contextChannels, channelsLoading]);

  // Update current channel when channelId changes
  useEffect(() => {
    if (channelId && localChannels.length > 0) {
      const selectedChannel = localChannels.find((c) => c.id === channelId);
      if (selectedChannel) {
        setCurrentChannel(selectedChannel);
      }
    } else if (!channelId) {
      setCurrentChannel(null);
    }
  }, [channelId, localChannels, setCurrentChannel]);

  const fetchData = useCallback(async () => {
    if (!token || !currentOrganization) {
      setDMs([]);
      setLoading(false);
      return;
    }

    if (currentOrganization.id !== prevOrgIdRef.current) {
      setLoading(true);
      prevOrgIdRef.current = currentOrganization.id;
    }

    try {
      const dmsData = await getDMs(token);
      setDMs(dmsData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, [token, currentOrganization]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <>
      <div className="flex flex-col h-full relative">
        {/* Organization Header */}
        <div className="px-3 py-3 border-b border-primary-600/50">
          <div 
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-primary-600/50 transition-colors cursor-pointer group"
          >
            <div className="flex items-center min-w-0">
              <div className="w-6 h-6 rounded bg-primary-500 mr-3 flex items-center justify-center text-white text-sm">
                {currentOrganization?.name.charAt(0)}
              </div>
              <h1 className="font-medium text-white truncate">
                {currentOrganization?.name}
              </h1>
            </div>
            <svg 
              className={`w-5 h-5 text-primary-300 group-hover:text-white transition-all ${showOrgDropdown ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
          
          {showOrgDropdown && (
            <div className="absolute left-0 right-0 mt-2 mx-3 py-1 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
              <button
                onClick={() => {
                  setShowOrgDialog(true);
                  setShowOrgDropdown(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Switch Organization
              </button>

              {isAdmin && (
                <Link
                  to="/organization/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowOrgDropdown(false)}
                >
                  Organization Settings
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Loading Overlay with Animation */}
        <AnimatePresence>
          {(loading || channelsLoading) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-primary-700 pointer-events-none z-10"
            >
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.1 }}
                className="p-4"
              >
                <div className="h-6 bg-white/10 rounded w-24 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-8 bg-white/10 rounded"></div>
                  <div className="h-8 bg-white/10 rounded"></div>
                  <div className="h-8 bg-white/10 rounded"></div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content with Animation */}
        <motion.div
          animate={{
            opacity: loading || channelsLoading ? 0.3 : 1
          }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto"
        >
          {/* Regular Channels */}
          <div className="mb-8 mt-6">
            <div className="px-4 mb-2 flex justify-between items-center">
              <div 
                className="flex items-center cursor-pointer group"
                onClick={() => setShowChannels(!showChannels)}
              >
                <h2 className="text-sm font-semibold text-primary-200 uppercase tracking-wider group-hover:text-white">
                  Channels
                </h2>
                <button className="ml-2 text-primary-200 group-hover:text-white">
                  <svg
                    className={`w-3 h-3 transition-transform ${showChannels ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setIsChannelDialogOpen(true)}
                className="w-6 h-6 rounded hover:bg-primary-600/50 text-primary-200 hover:text-white flex items-center justify-center transition-colors"
                title="Add Channel"
              >
                <span className="text-xl leading-none">+</span>
              </button>
            </div>
            <AnimatePresence initial={false}>
              {showChannels && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden" }}
                >
                  <ul className="space-y-0.5">
                    {localChannels.map((channel) => (
                      <li key={channel.id}>
                        <Link
                          to={`/chat/channel/${channel.id}`}
                          onClick={onChannelSelect}
                          className={`px-4 py-2 flex items-center text-sm transition-colors ${
                            channelId === channel.id
                              ? "bg-primary-600 text-white"
                              : "text-primary-100 hover:bg-primary-600/50 hover:text-white"
                          }`}
                        >
                          <span className="text-primary-300 mr-2">#</span>
                          <span className="truncate">{channel.name}</span>
                        </Link>
                      </li>
                    ))}
                    {localChannels.length === 0 && (
                      <li className="px-4 py-2 text-primary-400 text-sm">
                        No channels yet
                      </li>
                    )}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Direct Messages */}
          <div className="mb-6">
            <div className="px-4 mb-2 flex justify-between items-center">
              <div 
                className="flex items-center cursor-pointer group"
                onClick={() => setShowDirectMessages(!showDirectMessages)}
              >
                <h2 className="text-sm font-semibold text-primary-200 uppercase tracking-wider group-hover:text-white">
                  Direct Messages
                </h2>
                <button className="ml-2 text-primary-200 group-hover:text-white">
                  <svg
                    className={`w-3 h-3 transition-transform ${showDirectMessages ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => setIsDMDialogOpen(true)}
                className="w-6 h-6 rounded hover:bg-primary-600/50 text-primary-200 hover:text-white flex items-center justify-center transition-colors"
                title="Start DM"
              >
                <span className="text-xl leading-none">+</span>
              </button>
            </div>
            <AnimatePresence initial={false}>
              {showDirectMessages && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden" }}
                >
                  <ul className="space-y-0.5">
                    {dms.map((dm) => (
                      <li key={dm.id}>
                        <Link
                          to={`/chat/dm/${dm.id}`}
                          onClick={onChannelSelect}
                          className={`px-4 py-2 flex items-center text-sm transition-colors ${
                            dmId === dm.id
                              ? "bg-primary-600 text-white"
                              : "text-primary-100 hover:bg-primary-600/50 hover:text-white"
                          }`}
                        >
                          <UserAvatar
                            username={dm.other_username}
                            isOnline={isUserOnline(dm.other_user_id)}
                            size="sm"
                          />
                          <span className="ml-2 truncate">{dm.other_username}</span>
                        </Link>
                      </li>
                    ))}
                    {dms.length === 0 && (
                      <li className="px-4 py-2 text-primary-400 text-sm">
                        No direct messages yet
                      </li>
                    )}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <StartDMDialog
            isOpen={isDMDialogOpen}
            onClose={() => setIsDMDialogOpen(false)}
          />

          <ChannelDialog
            isOpen={isChannelDialogOpen}
            onClose={() => setIsChannelDialogOpen(false)}
          />
        </motion.div>
      </div>

      {showOrgDialog && createPortal(
        <OrganizationDialog 
          open={showOrgDialog} 
          onClose={() => setShowOrgDialog(false)} 
        />,
        document.body
      )}
    </>
  );
}
