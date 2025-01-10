import { WebSocketHandler } from '../websocket/handler';

declare global {
  var wss: WebSocketHandler | undefined;
}

export {};
