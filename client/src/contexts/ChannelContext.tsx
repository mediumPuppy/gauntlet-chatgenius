import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

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
    try {
      const response = await fetch('http://localhost:3000/api/channels', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }

      const data = await response.json();
      setChannels(data);
      
      // Set first channel as current if none selected
      if (!currentChannel && data.length > 0) {
        setCurrentChannel(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch channels');
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