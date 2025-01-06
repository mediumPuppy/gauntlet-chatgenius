import express, { RequestHandler } from 'express';
import { startDM, getUserDMs } from '../controllers/dm';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/start', authenticateToken, startDM as RequestHandler);
router.get('/list', authenticateToken, getUserDMs as RequestHandler);

export default router; 