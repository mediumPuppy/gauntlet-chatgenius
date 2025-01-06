import { Router } from 'express';
import { userController } from '../controllers/user';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Apply authentication middleware to all user routes
router.use(authenticateToken);

// Search users
router.get('/search',
  validateRequest({
    query: {
      q: { type: 'string', required: true }
    }
  }),
  userController.searchUsers
);

export default router; 