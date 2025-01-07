import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getChannels } from '../services/channel';

interface Channel {
  id: string;
  name: string;
  is_dm: boolean;
  created_at: string;
}

interface ChannelContextType {
  channels: Channel[];
  currentChannel: Channel | null;
  setCurrentChannel: (channel: Channel) => void;
  isLoading: boolean;
  error: string | null;
  refreshChannels: () => Promise<void>;
}

const ChannelContext = createContext<ChannelContextType | null>(null);

export function ChannelProvider({ children }: { children: ReactNode }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchChannels = async () => {
    if (!token) return;
    
    try {
      const data = await getChannels(token);
      setChannels(data);
      
      // Set first channel as current if none selected
      if (!currentChannel && data.length > 0) {
        setCurrentChannel(data[0]);
      }
      
      // Update current channel data if it exists in the new channel list
      if (currentChannel) {
        const updatedCurrentChannel = data.find(c => c.id === currentChannel.id);
        if (updatedCurrentChannel) {
          setCurrentChannel(updatedCurrentChannel);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch channels');
      console.error('Failed to fetch channels:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch channels on mount and when token changes
  useEffect(() => {
    if (token) {
      fetchChannels();
    }
  }, [token]);

  const refreshChannels = async () => {
    setIsLoading(true);
    await fetchChannels();
  };

  return (
    <ChannelContext.Provider 
      value={{ 
        channels, 
        currentChannel, 
        setCurrentChannel, 
        isLoading, 
        error,
        refreshChannels 
      }}
    >
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannels() {
  const context = useContext(ChannelContext);
  if (!context) {
    throw new Error('useChannels must be used within a ChannelProvider');
  }
  return context;
} 