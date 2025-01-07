import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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

  const fetchChannels = useCallback(async () => {
    if (!token) return;
    
    try {
      const data = await getChannels(token);
      setChannels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch channels');
      console.error('Failed to fetch channels:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!currentChannel && channels.length > 0) {
      setCurrentChannel(channels[0]);
      return;
    }
    
    if (currentChannel) {
      const updatedCurrentChannel = channels.find(c => c.id === currentChannel.id);
      if (updatedCurrentChannel) {
        setCurrentChannel(updatedCurrentChannel);
      }
    }
  }, [channels, currentChannel]);

  useEffect(() => {
    if (token) {
      fetchChannels();
    }
  }, [token, fetchChannels]);

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