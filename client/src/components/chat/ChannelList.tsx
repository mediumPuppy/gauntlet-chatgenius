import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getChannels } from '../../services/channel';
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

export function ChannelList() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDMs] = useState<DM[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDMDialogOpen, setIsDMDialogOpen] = useState(false);
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
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
    return <div className="p-4 text-primary-300">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
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
          {channels.map(channel => (
            <li key={channel.id}>
              <Link
                to={`/chat/${channel.id}`}
                className={`px-4 py-1.5 flex items-center text-base ${
                  channelId === channel.id ? 'bg-primary-600 text-white' : 'text-primary-100 hover:bg-primary-600'
                }`}
              >
                <span className="text-primary-300 mr-2">#</span>
                <span>{channel.name}</span>
              </Link>
            </li>
          ))}
          {channels.length === 0 && (
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
  );
}