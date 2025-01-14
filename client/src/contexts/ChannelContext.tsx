import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { useOrganization } from "./OrganizationContext";
import { getChannels } from "../services/channel";

interface Channel {
  id: string;
  name: string;
  is_dm: boolean;
  created_at: string;
}

interface ChannelContextType {
  channels: Channel[];
  currentChannel: Channel | null;
  setCurrentChannel: (channel: Channel | null) => void;
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
  const { currentOrganization } = useOrganization();
  const prevOrgIdRef = useRef<string | null>(null);

  // Reset state when organization changes, but keep old data until new data arrives
  useEffect(() => {
    if (currentOrganization?.id !== prevOrgIdRef.current) {
      // Immediately clear state when org changes
      setChannels([]);
      setCurrentChannel(null);
      setIsLoading(true);
      prevOrgIdRef.current = currentOrganization?.id || null;
    }
  }, [currentOrganization?.id]);

  const fetchChannels = useCallback(async () => {
    if (!token || !currentOrganization) {
      setChannels([]);
      setCurrentChannel(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await getChannels(token, currentOrganization.id);
      // Only update if we're still on the same organization
      if (currentOrganization.id === prevOrgIdRef.current) {
        setChannels(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch channels");
      console.error("Failed to fetch channels:", err);
    } finally {
      if (currentOrganization.id === prevOrgIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [token, currentOrganization]);

  useEffect(() => {
    if (token && currentOrganization) {
      fetchChannels();
    }
  }, [token, currentOrganization, fetchChannels]);

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
        refreshChannels,
      }}
    >
      {children}
    </ChannelContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useChannels() {
  const context = useContext(ChannelContext);
  if (!context) {
    throw new Error("useChannels must be used within a ChannelProvider");
  }
  return context;
}
