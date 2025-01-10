import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';
import { useWebSocket, WS_MESSAGE_EVENT } from '../hooks/useWebSocket';
import { getOrganizationMemberPresence } from '../services/user';

interface PresenceState {
  [userId: string]: {
    isOnline: boolean;
    lastSeen: string;
  };
}

interface PresenceContextType {
  presence: PresenceState;
  isUserOnline: (userId: string) => boolean;
  getUserLastSeen: (userId: string) => string | null;
}

const PresenceContext = createContext<PresenceContextType | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [presence, setPresence] = useState<PresenceState>({});
  const { token } = useAuth();
  const { currentOrganization } = useOrganization();
  const { eventEmitter } = useWebSocket('', false);  // No channel needed for presence
  const lastUpdateRef = useRef<{ [userId: string]: number }>({});

  // Load initial presence state
  useEffect(() => {
    if (!token || !currentOrganization) return;

    const loadPresence = async () => {
      try {
        const presenceData = await getOrganizationMemberPresence(token, currentOrganization.id);
        const presenceState: PresenceState = {};
        presenceData.forEach((data: any) => {
          presenceState[data.user_id] = {
            isOnline: data.is_online,
            lastSeen: data.last_seen
          };
        });
        setPresence(presenceState);
      } catch (error) {
        console.error('Failed to load presence data:', error);
      }
    };

    loadPresence();
  }, [token, currentOrganization]);

  // Handle presence updates with debouncing
  const handlePresenceUpdate = useCallback((data: any) => {
    const now = Date.now();
    const lastUpdate = lastUpdateRef.current[data.userId] || 0;
    
    // Ignore updates that are too close together (within 1 second)
    if (now - lastUpdate < 1000) {
      return;
    }

    lastUpdateRef.current[data.userId] = now;

    setPresence(prev => {
      const currentState = prev[data.userId];
      
      // Only update if the state has actually changed
      if (!currentState || 
          currentState.isOnline !== data.isOnline || 
          currentState.lastSeen !== data.lastSeen) {
        return {
          ...prev,
          [data.userId]: {
            isOnline: data.isOnline,
            lastSeen: data.lastSeen
          }
        };
      }
      return prev;
    });
  }, []);

  // Listen for presence updates
  useEffect(() => {
    const handleEvent = (event: CustomEvent) => {
      const data = event.detail;
      if (data.type === 'presence') {
        handlePresenceUpdate(data);
      }
    };

    eventEmitter.addEventListener(WS_MESSAGE_EVENT, handleEvent as EventListener);
    return () => eventEmitter.removeEventListener(WS_MESSAGE_EVENT, handleEvent as EventListener);
  }, [eventEmitter, handlePresenceUpdate]);

  const isUserOnline = useCallback((userId: string) => {
    return presence[userId]?.isOnline ?? false;
  }, [presence]);

  const getUserLastSeen = useCallback((userId: string) => {
    return presence[userId]?.lastSeen ?? null;
  }, [presence]);

  return (
    <PresenceContext.Provider value={{ presence, isUserOnline, getUserLastSeen }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
} 