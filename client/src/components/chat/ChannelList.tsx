import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getChannels } from '../../services/channel';
import { getDMs } from '../../services/user';
import { StartDMDialog } from './StartDMDialog';

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

export function ChannelList() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDMs] = useState<DM[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDMDialogOpen, setIsDMDialogOpen] = useState(false);
  const { token } = useAuth();
  const { channelId } = useParams();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [channelsData, dmsData] = await Promise.all([
          getChannels(token!),
          getDMs(token!)
        ]);
        setChannels(channelsData);
        setDMs(dmsData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  if (loading) {
    return <div className="p-4 text-gray-500">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Regular Channels */}
      <div className="mb-6">
        <div className="px-4 mb-2 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Channels</h2>
          <button
            onClick={() => {/* TODO: Add create channel dialog */}}
            className="w-5 h-5 rounded hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center"
            title="Create Channel"
          >
            <span className="text-xl leading-none">+</span>
          </button>
        </div>
        <ul className="space-y-1">
          {channels.map(channel => (
            <li key={channel.id}>
              <Link
                to={`/chat/${channel.id}`}
                className={`px-4 py-1.5 flex items-center ${
                  channelId === channel.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="text-gray-400 mr-2">#</span>
                <span>{channel.name}</span>
              </Link>
            </li>
          ))}
          {channels.length === 0 && (
            <li className="px-4 py-1 text-gray-500 text-sm">No channels yet</li>
          )}
        </ul>
      </div>

      {/* Direct Messages */}
      <div className="mb-4">
        <div className="px-4 mb-2 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Direct Messages</h2>
          <button
            onClick={() => setIsDMDialogOpen(true)}
            className="w-5 h-5 rounded hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center"
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
                className={`px-4 py-1.5 flex items-center ${
                  channelId === dm.id ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                <span>{dm.other_username}</span>
              </Link>
            </li>
          ))}
          {dms.length === 0 && (
            <li className="px-4 py-1 text-gray-500 text-sm">No direct messages yet</li>
          )}
        </ul>
      </div>

      <StartDMDialog
        isOpen={isDMDialogOpen}
        onClose={() => setIsDMDialogOpen(false)}
      />
    </div>
  );
} 