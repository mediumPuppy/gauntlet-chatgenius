import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WebSocketMessage } from '../types/message';

type ConnectionState = 'PREPARING' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

export function useWebSocket(channelId: string) {
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
      setConnectionState('PREPARING');
      return;
    }

    if (isConnecting.current) {
      console.log('Connection already in progress');
      return;
    }

    // Close existing connection if any
    if (ws.current) {
      ws.current.close(1000, 'Reconnecting');
      ws.current = null;
    }

    isConnecting.current = true;
    setConnectionState('CONNECTING');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3001/ws`;
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      if (socket !== ws.current) return; // Connection was replaced
      setConnectionState('CONNECTED');
      setShowReconnecting(false);
      clearReconnectingTimeout();
      setError(null);
      reconnectAttempts.current = 0;
      isConnecting.current = false;

      // Send authentication message with channelId
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ 
          type: 'auth', 
          token,
          channelId 
        }));
      }
    };

    socket.onclose = (event) => {
      if (socket !== ws.current) return; // Connection was replaced
      isConnecting.current = false;
      setConnectionState('DISCONNECTED');

      // Don't reconnect if closure was clean and intentional
      if (event.wasClean) {
        setShowReconnecting(false);
        clearReconnectingTimeout();
        return;
      }
      
      // Start the 3-second timer for showing reconnecting state
      clearReconnectingTimeout();
      reconnectingTimeout.current = setTimeout(() => {
        setShowReconnecting(true);
      }, 3000);

      // Calculate delay with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
      reconnectAttempts.current++;
      
      console.log(`WebSocket disconnected. Attempting reconnect in ${delay}ms`);
      setTimeout(connect, delay);
    };

    socket.onerror = (error) => {
      if (socket !== ws.current) return; // Connection was replaced
      console.error('WebSocket error:', error);
      setError('WebSocket connection error');
      isConnecting.current = false;
    };
  }, [token, channelId]);

  // Only connect when we have a token and channelId
  useEffect(() => {
    if (token && channelId && connectionState === 'PREPARING') {
      connect();
    }
  }, [connect, token, channelId, connectionState]);

  // Cleanup on unmount or channel change
  useEffect(() => {
    return () => {
      clearReconnectingTimeout();
      if (ws.current) {
        ws.current.close(1000, 'Cleanup'); // Clean closure
        ws.current = null;
      }
      setConnectionState('PREPARING');
      setShowReconnecting(false);
      isConnecting.current = false;
    };
  }, [channelId]);

  const sendMessage = useCallback((content: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || connectionState !== 'CONNECTED') {
      setError('WebSocket is not connected');
      return;
    }

    const message: WebSocketMessage = {
      type: 'message',
      channelId,
      content,
      timestamp: Date.now(),
    };

    ws.current.send(JSON.stringify(message));
  }, [channelId, connectionState]);

  const sendTyping = useCallback(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || connectionState !== 'CONNECTED') return;

    const message: WebSocketMessage = {
      type: 'typing',
      channelId,
      timestamp: Date.now(),
    };

    ws.current.send(JSON.stringify(message));
  }, [channelId, connectionState]);

  return {
    isConnected: connectionState === 'CONNECTED',
    showReconnecting,
    connectionState,
    error,
    sendMessage,
    sendTyping,
    ws: ws.current,
  };
} 