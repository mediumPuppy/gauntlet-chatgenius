import express, { Request, Response } from 'express';
import { Server as WebSocketServer } from 'ws';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import initializeDatabase from './config/init-db';
import authRoutes from './routes/auth';
import channelRoutes from './routes/channel';
import userRoutes from './routes/user';
import messageRoutes from './routes/message';
import dmRoutes from './routes/dm';
import organizationRoutes from './routes/organization';
import uploadRoutes from './routes/upload';
import pool from './config/database';
import { WebSocketHandler } from './websocket/handler';
import { WebSocketClient } from './websocket/types';
import searchRoutes from './routes/search';
import path from 'path';
import { createAIRouter } from './routes/ai';
import aiSettingsRoutes from './routes/aiSettings';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize database
initializeDatabase()
  .then(() => {
    console.log('Database initialization completed');
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

// CORS configuration
const corsOptions: CorsOptions = {
  origin: '*',  // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'Upgrade', 'Connection'],
  exposedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Upgrade', 'Connection'],
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 3600,
  preflightContinue: false
};

// Apply CORS before ANY route handlers
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json());

// Serve static files from the React build
app.use(express.static(path.join(__dirname, '../../client/dist')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/users', userRoutes, aiSettingsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);

// API-specific routes
app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'ChatGenius API is running' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Add error handling middleware at the end (before the * route)
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Global error handler:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Handle all other routes by serving the React app
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Start HTTP server
const server = app.listen(port, () => {
  console.log(`HTTP Server is running on port ${port}`);
});

// Initialize WebSocket server with proper CORS
console.log('Initializing WebSocket server with config:', {
  port,
  path: '/ws',
  server: !!server
});

const wss = new WebSocketServer({ 
  server,
  path: '/ws',
  verifyClient: (info, cb) => {
    console.log('WebSocket verifyClient called:', {
      url: info.req.url,
      headers: info.req.headers,
      origin: info.origin
    });
    cb(true);
  }
});

// Add this to check WebSocket server state
console.log('WebSocket server state:', {
  clients: wss.clients.size,
  address: server.address(),
  listening: server.listening
});

const wsHandler = new WebSocketHandler(wss);
console.log('WebSocket handler created:', !!wsHandler);
global.wss = wsHandler;
console.log('Global WSS set:', !!global.wss);

app.use('/api/ai', createAIRouter(wsHandler));

wss.on('connection', (ws: WebSocketClient) => {
  console.log('WebSocket connection received');
  wsHandler.handleConnection(ws);
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

wss.on('listening', () => {
  console.log('WebSocket Server is listening on port', port);
});

process.on('SIGTERM', () => {
  server.close(() => {
    wss.close(() => {
      pool.end(() => {
        process.exit(0);
      });
    });
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 