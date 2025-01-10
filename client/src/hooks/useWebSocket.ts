import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WebSocketMessage } from '../types/message';

type ConnectionState = 'PREPARING' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

// Create a singleton instance to track global connection state
const globalWsState = {
  instance: null as WebSocket | null,
  connecting: false,
  connectedChannels: new Set<string>(),
};

// For Vite, remember to configure your .env with VITE_WS_URL
const DEFAULT_WS_URL = 'ws://localhost:3001/ws';
const WS_URL = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL;

export const WS_MESSAGE_EVENT = 'ws-message';
const wsEventEmitter = new EventTarget();

export function useWebSocket(channelId: string, isDM = false, parentId?: string) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<number>();
  const maxReconnectAttempts = 5;
  const maxReconnectDelay = 10000; // 10 seconds
  const { token } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>('PREPARING');
  const [showReconnecting, setShowReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelKey = `${isDM ? 'dm' : 'channel'}-${channelId}`;

  const connect = useCallback(() => {
    if (!token) {
      console.error('No token found. Cannot connect to WebSocket yet.');
      setConnectionState('PREPARING');
      return;
    }

    // If already connected to this channel, use existing connection
    if (globalWsState.connectedChannels.has(channelKey)) {
      ws.current = globalWsState.instance;
      setConnectionState('CONNECTED');
      return;
    }

    // If already connecting, wait
    if (globalWsState.connecting) {
      console.log('Connection already in progress, waiting...');
      return;
    }

    // If there's an existing connection, use it
    if (globalWsState.instance?.readyState === WebSocket.OPEN) {
      ws.current = globalWsState.instance;
      globalWsState.connectedChannels.add(channelKey);
      
      // Send channel join message
      console.log('Joining channel:', channelId);
      ws.current.send(JSON.stringify({
        type: 'join',
        channelId,
        isDM,
        token
      }));
      
      setConnectionState('CONNECTED');
      return;
    }

    globalWsState.connecting = true;
    setConnectionState('CONNECTING');

    try {
      const newWs = new WebSocket(WS_URL);
      globalWsState.instance = newWs;
      ws.current = newWs;

      newWs.onopen = () => {
        globalWsState.connecting = false;
        setConnectionState('CONNECTED');
        globalWsState.connectedChannels.add(channelKey);

        // Send authentication
        newWs.send(JSON.stringify({
          type: 'auth',
          token,
          channelId,
          isDM,
          isThread: !!parentId,
          parentId,
        }));
      };

      newWs.onerror = (event) => {
        console.error('WebSocket onerror fired:', event);
        setError('WebSocket encountered an error.');
      };

      newWs.onclose = (event) => {
        globalWsState.connecting = false;
        setConnectionState('DISCONNECTED');

        // Attempt to reconnect if not a normal close
        if (event.code !== 1000) {
          if (reconnectAttempts.current < maxReconnectAttempts) {
            setShowReconnecting(true);

            const delay = Math.min(1000 * (2 ** reconnectAttempts.current), maxReconnectDelay);
            reconnectTimer.current = window.setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.error('Max reconnect attempts reached. WebSocket will not reconnect.');
          }
        }
      };

      newWs.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data);
          console.log('WebSocket received:', data);
          wsEventEmitter.dispatchEvent(new CustomEvent(WS_MESSAGE_EVENT, { detail: data }));
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
    } catch (err) {
      globalWsState.connecting = false;
      console.error('Failed to create WebSocket connection:', err);
      setError('Failed to create WebSocket connection.');
    }
  }, [token, channelId, isDM, channelKey]);

  useEffect(() => {
    connect();
    
    return () => {
      globalWsState.connectedChannels.delete(channelKey);
      // Only close the connection if no more channels are connected
      if (globalWsState.connectedChannels.size === 0) {
        globalWsState.instance?.close();
        globalWsState.instance = null;
      }
    };
  }, [connect, channelKey]);

  const sendMessage = useCallback(
    (content: string, parentId?: string) => {
      if (connectionState !== 'CONNECTED' || !ws.current) {
        console.warn('WebSocket is not connected. Message will not be sent.', content);
        return;
      }
      console.log('Sending message with parentId:', parentId);
      const payload: WebSocketMessage = {
        type: 'message',
        content,
        channelId,
        isDM,
        parentId,
        timestamp: Date.now()
      };
      console.log('WebSocket payload:', payload);
      ws.current.send(JSON.stringify(payload));
    },
    [connectionState, channelId, isDM]
  );

  const sendTyping = useCallback(() => {
    if (connectionState !== 'CONNECTED' || !ws.current) {
      console.warn('WebSocket is not connected. Typing notification will not be sent.');
      return;
    }
    const payload: WebSocketMessage = {
      type: 'typing',
      channelId,
      isDM,
    };
    ws.current.send(JSON.stringify(payload));
  }, [connectionState, channelId, isDM]);

  return {
    isConnected: connectionState === 'CONNECTED',
    showReconnecting,
    error,
    sendMessage,
    sendTyping,
    ws: ws.current,
    eventEmitter: wsEventEmitter
  };
}