import express, { Request, Response } from 'express';
import { Server as WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import initializeDatabase from './config/init-db';
import authRoutes from './routes/auth';
import channelRoutes from './routes/channel';
import userRoutes from './routes/user';
import messageRoutes from './routes/message';
import dmRoutes from './routes/dm';
import organizationRoutes from './routes/organization';
import { WebSocketHandler } from './websocket/handler';
import { WebSocketClient } from './websocket/types';

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
const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // Vite's default port
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dm', dmRoutes);
app.use('/api/organizations', organizationRoutes);

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'ChatGenius API is running' });
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
    const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
    if (!allowedOrigins.includes(origin)) {
      cb(false, 403, 'Forbidden');
      return;
    }
    cb(true);
  }
});

const wsHandler = new WebSocketHandler(wss);

wss.on('connection', (ws: WebSocketClient) => {
  console.log('New WebSocket connection');
  wsHandler.handleConnection(ws);
});

wss.on('listening', () => {
  console.log(`WebSocket Server is running on port ${wsPort}`);
}); 