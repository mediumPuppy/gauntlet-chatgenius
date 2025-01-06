import express, { RequestHandler } from 'express';
import { createMessage, getMessages } from '../controllers/message';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get messages for a channel or DM
router.get('/', authenticateToken, getMessages as RequestHandler);

// Create a new message
router.post('/', authenticateToken, createMessage as RequestHandler);

export default router; 