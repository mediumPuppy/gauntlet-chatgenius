import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WebSocketMessage } from '../types/message';

type ConnectionState = 'PREPARING' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

const wsEventEmitter = new EventTarget();
export const WS_MESSAGE_EVENT = 'ws-message';

// For Vite, remember to configure your .env with VITE_WS_URL
const DEFAULT_WS_URL = 'ws://localhost:3001/ws';
const WS_URL = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL;

export function useWebSocket(channelId: string, isDM = false) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000;
  const maxReconnectAttempts = 10;
  const { token } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>('PREPARING');
  const [showReconnecting, setShowReconnecting] = useState(false);
  const reconnectingTimeout = useRef<number>();
  const [error, setError] = useState<string | null>(null);
  const isConnecting = useRef(false);
  const reconnectTimer = useRef<number>();
  // const lastConnectionAttempt = useRef<number>(0);

  const clearTimeouts = useCallback(() => {
    if (reconnectingTimeout.current) {
      clearTimeout(reconnectingTimeout.current);
      reconnectingTimeout.current = undefined;
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = undefined;
    }
  }, []);

  const connect = useCallback(() => {
    if (!token) {
      console.error('No token found. Cannot connect to WebSocket yet.');
      setConnectionState('PREPARING');
      return;
    }

    if (isConnecting.current) {
      console.error('Connection is already in progress, forcing a close before reconnecting.');
      if (ws.current) {
        ws.current.close(1000, 'Forcing new connection');
        ws.current = null;
      }
      isConnecting.current = false;
    }

    // If a WS already exists, close it before creating a new one
    if (ws.current) {
      // This is a deliberate close, so reset reconnect attempts
      reconnectAttempts.current = 0;
      setShowReconnecting(false);

      ws.current.close(1000, 'Reconnecting');
      ws.current = null;
    }

    isConnecting.current = true;
    setConnectionState('CONNECTING');

    try {
      // No longer referencing "process.env"
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        setConnectionState('CONNECTED');
        isConnecting.current = false;

        // Reset reconnect attempts and hide bubble
        reconnectAttempts.current = 0;
        setShowReconnecting(false);

        // Send authentication
        ws.current?.send(JSON.stringify({
          type: 'auth',
          token,
          channelId,
          isDM,
        }));
      };

      ws.current.onerror = (event) => {
        console.error('WebSocket onerror fired:', event);
        setError('WebSocket encountered an error.');
      };

      ws.current.onclose = (event) => {
        isConnecting.current = false;
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

      ws.current.onmessage = (messageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data);
          wsEventEmitter.dispatchEvent(new CustomEvent(WS_MESSAGE_EVENT, { detail: data }));
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError('Failed to create WebSocket connection.');
    }
  }, [token, channelId, isDM, clearTimeouts]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeouts();
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect, clearTimeouts]);

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