import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import { useChannels } from '../../contexts/ChannelContext';
import { getDMs } from '../../services/user';
import StartDMDialog from './StartDMDialog';
import ChannelDialog from './ChannelDialog';

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
  const { channelId } = useParams();
  const { setCurrentChannel, isLoading: channelsLoading, channels: contextChannels } = useChannels();
  const [localChannels, setLocalChannels] = useState<Channel[]>([]);
  const [dms, setDMs] = useState<DM[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDMDialogOpen, setIsDMDialogOpen] = useState(false);
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const prevOrgIdRef = useRef<string | null>(null);

  // Keep showing old channels until new ones load
  useEffect(() => {
    if (!channelsLoading) {
      setLocalChannels(contextChannels);
    }
  }, [contextChannels, channelsLoading]);

  // Update current channel when channelId changes
  useEffect(() => {
    if (channelId && localChannels.length > 0) {
      const selectedChannel = localChannels.find(c => c.id === channelId);
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
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [token, currentOrganization]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Loading Overlay */}
      <div 
        className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
        style={{ opacity: loading || channelsLoading ? 0.7 : 0 }}
      >
        <div className="animate-pulse p-4">
          <div className="h-6 bg-primary-600/20 rounded w-24 mb-4"></div>
          <div className="space-y-3">
            <div className="h-8 bg-primary-600/20 rounded"></div>
            <div className="h-8 bg-primary-600/20 rounded"></div>
            <div className="h-8 bg-primary-600/20 rounded"></div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="transition-opacity duration-300" style={{ opacity: loading || channelsLoading ? 0.3 : 1 }}>
        {/* Regular Channels */}
        <div className="mb-6">
          <div className="px-4 mb-2 flex justify-between items-center">
            <h2 className="text-base font-semibold text-primary-200 uppercase tracking-wider">Channels</h2>
            <button
              onClick={() => setIsChannelDialogOpen(true)}
              className="w-6 h-6 rounded hover:bg-primary-600 text-primary-200 hover:text-white flex items-center justify-center"
              title="Channel Options"
            >
              <span className="text-xl leading-none">+</span>
            </button>
          </div>
          <ul className="space-y-1">
            {localChannels.map(channel => (
              <li key={channel.id}>
                <Link
                  to={`/chat/${channel.id}`}
                  onClick={onChannelSelect}
                  className={`px-4 py-1.5 flex items-center text-base ${
                    channelId === channel.id ? 'bg-primary-600 text-white' : 'text-primary-100 hover:bg-primary-600'
                  }`}
                >
                  <span className="text-primary-300 mr-2">#</span>
                  <span>{channel.name}</span>
                </Link>
              </li>
            ))}
            {localChannels.length === 0 && (
              <li className="px-4 py-1 text-primary-300 text-sm">No channels yet</li>
            )}
          </ul>
        </div>

        {/* Direct Messages */}
        <div className="mb-4">
          <div className="px-4 mb-2 flex justify-between items-center">
            <h2 className="text-base font-semibold text-primary-200 uppercase tracking-wider">Direct Messages</h2>
            <button
              onClick={() => setIsDMDialogOpen(true)}
              className="w-6 h-6 rounded hover:bg-primary-600 text-primary-200 hover:text-white flex items-center justify-center"
              title="Start DM"
            >
              <span className="text-xl leading-none">+</span>
            </button>
          </div>
          <ul className="space-y-1">
            {dms.map(dm => (
              <li key={dm.id}>
                <Link
                  to={`/chat/dm/${dm.id}`}
                  onClick={onChannelSelect}
                  className={`px-4 py-1.5 flex items-center text-base ${
                    channelId === dm.id ? 'bg-primary-600 text-white' : 'text-primary-100 hover:bg-primary-600'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full bg-primary-300 mr-2" />
                  <span>{dm.other_username}</span>
                </Link>
              </li>
            ))}
            {dms.length === 0 && (
              <li className="px-4 py-1 text-primary-300 text-sm">No direct messages yet</li>
            )}
          </ul>
        </div>

        <StartDMDialog
          isOpen={isDMDialogOpen}
          onClose={() => setIsDMDialogOpen(false)}
        />

        <ChannelDialog
          isOpen={isChannelDialogOpen}
          onClose={() => setIsChannelDialogOpen(false)}
        />
      </div>
    </div>
  );
}