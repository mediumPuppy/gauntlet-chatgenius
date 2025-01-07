import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { WebSocketMessage } from '../types/message';

type ConnectionState = 'PREPARING' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

// Create a custom event target for WebSocket messages
const wsEventEmitter = new EventTarget();
export const WS_MESSAGE_EVENT = 'ws-message';

export function useWebSocket(channelId: string, isDM: boolean = false) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000; // Maximum delay of 30 seconds
  const maxReconnectAttempts = 10; // Maximum number of reconnect attempts
  const { token } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>('PREPARING');
  const [showReconnecting, setShowReconnecting] = useState(false);
  const reconnectingTimeout = useRef<number>();
  const [error, setError] = useState<string | null>(null);
  const isConnecting = useRef(false);
  const reconnectTimer = useRef<number>();
  const lastConnectionAttempt = useRef<number>(0);

  // Clear all timeouts
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
      console.log('No token available, waiting...');
      setConnectionState('PREPARING');
      return;
    }

    const now = Date.now();
    // Prevent connection attempts within 1 second of each other
    if (now - lastConnectionAttempt.current < 1000) {
      console.log('Connection attempt too soon, skipping...');
      return;
    }
    lastConnectionAttempt.current = now;

    if (isConnecting.current) {
      console.log('Connection already in progress');
      return;
    }

    // If we're already connected and the socket is healthy, don't reconnect
    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    // Clear existing connection if any
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
    
    try {
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        console.log('WebSocket connected, authenticating...');
        isConnecting.current = false;
        setConnectionState('CONNECTED');
        setShowReconnecting(false);
        clearTimeouts();
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
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
            reconnectAttempts.current++;

            console.log(`Reconnecting in ${delay}ms... (Attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
            reconnectTimer.current = window.setTimeout(connect, delay);

            // Show reconnecting message after 2 seconds
            reconnectingTimeout.current = window.setTimeout(() => {
              setShowReconnecting(true);
            }, 2000);
          } else {
            console.error('Max reconnection attempts reached');
            setError('Unable to establish connection after multiple attempts');
          }
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Only set error if we're not already trying to reconnect
        if (!isConnecting.current && reconnectAttempts.current === 0) {
          setError('Connection error occurred');
        }
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

          // Instead of re-dispatching, create a custom event with the parsed data
          const customEvent = new CustomEvent(WS_MESSAGE_EVENT, {
            detail: data,
            // Make event non-bubbling and non-cancelable
            bubbles: false,
            cancelable: false
          });
          wsEventEmitter.dispatchEvent(customEvent);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
    } catch (err) {
      console.error('Error creating WebSocket connection:', err);
      isConnecting.current = false;
      setError('Failed to create connection');
    }
  }, [token, channelId, isDM, clearTimeouts]);

  // Cleanup function
  const cleanup = useCallback(() => {
    clearTimeouts();
    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log('Cleaning up WebSocket connection');
      ws.current.close(1000, 'Cleanup');
      ws.current = null;
    }
  }, [clearTimeouts]);

  // Only reconnect when channelId or isDM changes and we're not already connected
  useEffect(() => {
    const shouldConnect = !ws.current || ws.current.readyState !== WebSocket.OPEN;
    if (shouldConnect) {
      console.log('Channel or DM status changed, connecting...', { channelId, isDM });
      connect();
    }
    return cleanup;
  }, [connect, cleanup, channelId, isDM]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

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
    ws: ws.current,
    eventEmitter: wsEventEmitter  // Export the event emitter
  };
}