import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface WebSocketMessage {
  type: 'message' | 'typing' | 'read' | 'error';
  channelId: string;
  content?: string;
  timestamp?: number;
  senderId?: string;
  senderName?: string;
  error?: string;
}

export function useWebSocket(channelId: string) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000; // Maximum delay of 30 seconds
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!token) return;

    // Close existing connection if any
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }

    const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:3001'}/ws`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      // Send authentication message with channelId
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ 
          type: 'auth', 
          token,
          channelId 
        }));
      }
    };

    ws.current.onclose = (event) => {
      setIsConnected(false);
      // Don't reconnect if closure was clean and intentional
      if (event.wasClean) {
        return;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
      reconnectAttempts.current++;
      
      console.log(`WebSocket disconnected. Attempting reconnect in ${delay}ms`);
      setTimeout(connect, delay);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error');
    };
  }, [token, channelId]);

  // Reconnect when channel changes or token changes
  useEffect(() => {
    connect();
    // Cleanup previous connection when channel changes
    return () => {
      if (ws.current) {
        ws.current.close(1000, 'Channel changed'); // Clean closure
        ws.current = null;
      }
    };
  }, [connect, channelId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ws.current) {
        ws.current.close(1000, 'Component unmounted'); // Clean closure
        ws.current = null;
      }
    };
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
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
  }, [channelId]);

  const sendTyping = useCallback(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    const message: WebSocketMessage = {
      type: 'typing',
      channelId,
      timestamp: Date.now(),
    };

    ws.current.send(JSON.stringify(message));
  }, [channelId]);

  return {
    isConnected,
    error,
    sendMessage,
    sendTyping,
    ws: ws.current,
  };
} 