import express, { RequestHandler } from 'express';
import { createMessage, getMessages, getThreadMessages } from '../controllers/message';
import { authenticateToken } from '../middleware/auth';
import { addReaction, removeReaction } from '../controllers/messageReactions';

const router = express.Router();

// Thread routes
router.get('/thread/:messageId', authenticateToken, getThreadMessages as RequestHandler);

// Main message routes
router.get('/', authenticateToken, getMessages as RequestHandler);
router.post('/', authenticateToken, createMessage as RequestHandler);

router.post('/:messageId/reactions', authenticateToken, addReaction);
router.delete('/:messageId/reactions', authenticateToken, removeReaction);
export default router; 