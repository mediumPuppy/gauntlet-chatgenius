import express, { RequestHandler } from 'express';
import { createMessage, getMessages, getThreadMessages } from '../controllers/message';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Thread routes
router.get('/thread/:messageId', authenticateToken, getThreadMessages as RequestHandler);

// Main message routes
router.get('/', authenticateToken, getMessages as RequestHandler);
router.post('/', authenticateToken, createMessage as RequestHandler);

export default router; 