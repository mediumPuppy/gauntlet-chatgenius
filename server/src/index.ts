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

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const wsPort = Number(process.env.WS_PORT) || 3001;

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
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : ['*']) // Fallback to allow all if not set
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from the React build
app.use(express.static(path.join(__dirname, '../../client/dist')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/users', userRoutes);
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

// Handle all other routes by serving the React app
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Start HTTP server
const server = app.listen(port, () => {
  console.log(`HTTP Server is running on port ${port}`);
});

// Initialize WebSocket server with proper CORS
const wss = new WebSocketServer({ 
  port: wsPort,
  verifyClient: (info, cb) => {
    const origin = info.origin;
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [process.env.CORS_ORIGIN]
      : ['http://localhost:5173', 'http://127.0.0.1:5173'];
    
    if (!allowedOrigins.includes(origin)) {
      cb(false, 403, 'Forbidden');
      return;
    }
    cb(true);
  }
});

const wsHandler = new WebSocketHandler(wss);

wss.on('connection', (ws: WebSocketClient) => {
  wsHandler.handleConnection(ws);
});

wss.on('listening', () => {
  console.log(`WebSocket Server is running on port ${wsPort}`);
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