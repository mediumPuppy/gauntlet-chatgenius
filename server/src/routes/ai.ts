import express from 'express';
import { createAIResponseController } from '../controllers/aiResponse';
import { authenticateToken } from '../middleware/auth';
import { WebSocketHandler } from '../websocket/handler';

export const createAIRouter = (wsHandler: WebSocketHandler) => {
  const router = express.Router();
  const aiController = createAIResponseController(wsHandler);

  router.post('/generate-response', authenticateToken, aiController.generateAIResponse);

  return router;
};