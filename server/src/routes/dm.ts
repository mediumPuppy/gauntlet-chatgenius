import express from 'express';
import { startDM, getUserDMs } from '../controllers/dm';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/start', authenticateToken, startDM);
router.get('/list', authenticateToken, getUserDMs);

export default router; 