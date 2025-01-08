import express, { RequestHandler } from 'express';
import { startDM, getUserDMs, getDMById, getDMMessages } from '../controllers/dm';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/start', authenticateToken, startDM as RequestHandler);
router.get('/list', authenticateToken, getUserDMs as RequestHandler);
router.get('/:id', authenticateToken, getDMById as RequestHandler);
router.get('/:id/messages', authenticateToken, getDMMessages as RequestHandler);

export default router;