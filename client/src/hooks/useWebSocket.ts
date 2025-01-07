import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WebSocketMessage } from '../types/message';

type ConnectionState = 'PREPARING' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

export function useWebSocket(channelId: string, isDM: boolean = false) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000; // Maximum delay of 30 seconds
  const { token } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>('PREPARING');
  const [showReconnecting, setShowReconnecting] = useState(false);
  const reconnectingTimeout = useRef<number>();
  const [error, setError] = useState<string | null>(null);
  const isConnecting = useRef(false);

  // Clear the reconnecting timeout
  const clearReconnectingTimeout = () => {
    if (reconnectingTimeout.current) {
      clearTimeout(reconnectingTimeout.current);
      reconnectingTimeout.current = undefined;
    }
  };

  const connect = useCallback(() => {
    if (!token) {
      console.log('No token available, waiting...');
      setConnectionState('PREPARING');
      return;
    }

    if (isConnecting.current) {
      console.log('Connection already in progress');
      return;
    }

    // Close existing connection if any
    if (ws.current) {
      console.log('Closing existing connection');
      ws.current.close(1000, 'Reconnecting');
      ws.current = null;
    }

    isConnecting.current = true;
    setConnectionState('CONNECTING');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3001/ws`;
    console.log('Connecting to WebSocket:', wsUrl, { channelId, isDM });
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected, authenticating...');
      isConnecting.current = false;
      setConnectionState('CONNECTED');
      setShowReconnecting(false);
      clearReconnectingTimeout();
      reconnectAttempts.current = 0;
      setError(null);

      // Send authentication message
      const authMessage: WebSocketMessage = {
        type: 'auth',
        token,
        channelId,
        isDM
      };
      console.log('Sending auth message:', { ...authMessage, token: '***' });
      socket.send(JSON.stringify(authMessage));
    };

    socket.onclose = (event) => {
      console.log('WebSocket closed:', event);
      isConnecting.current = false;
      setConnectionState('DISCONNECTED');
      ws.current = null;

      if (event.code !== 1000) { // 1000 is normal closure
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
        reconnectAttempts.current++;

        console.log(`Reconnecting in ${delay}ms...`);
        setTimeout(connect, delay);

        // Show reconnecting message after 2 seconds
        reconnectingTimeout.current = window.setTimeout(() => {
          setShowReconnecting(true);
        }, 2000);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error occurred');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received WebSocket message:', data);
        
        // Handle error messages
        if (data.type === 'error') {
          console.error('WebSocket error message:', data.error);
          setError(data.error);
          return;
        }

        // Forward all messages to any listeners
        const messageEvent = new MessageEvent('message', {
          data: event.data // Keep original data to maintain all properties
        });
        socket.dispatchEvent(messageEvent);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
  }, [token, channelId, isDM]);

  // Reconnect when channelId or isDM changes
  useEffect(() => {
    console.log('Channel or DM status changed, reconnecting...', { channelId, isDM });
    connect();
    return () => {
      if (ws.current) {
        console.log('Cleaning up WebSocket connection');
        ws.current.close(1000, 'Channel/DM changed');
        ws.current = null;
      }
      clearReconnectingTimeout();
    };
  }, [connect, channelId, isDM]);

  const sendMessage = useCallback((content: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected, attempting to reconnect...');
      connect();
      setError('Not connected to chat');
      return;
    }

    const message: WebSocketMessage = {
      type: 'message',
      content,
      channelId,
      isDM
    };
    console.log('Sending message:', message);
    ws.current.send(JSON.stringify(message));
  }, [channelId, isDM, connect]);

  const sendTyping = useCallback(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      return; // Silently fail for typing events
    }

    const message: WebSocketMessage = {
      type: 'typing',
      channelId,
      isDM
    };
    ws.current.send(JSON.stringify(message));
  }, [channelId, isDM]);

  return {
    isConnected: connectionState === 'CONNECTED',
    showReconnecting,
    error,
    sendMessage,
    sendTyping,
    ws: ws.current
  };
}