import { Router } from 'express';
import { userController } from '../controllers/user';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { RequestHandler } from 'express';
import { userQueries } from '../models/user';

const router = Router();

// Apply authentication middleware to all user routes
router.use(authenticateToken);

// Search users
router.get('/search',
  validateRequest({
    query: {
      q: { type: 'string', required: true },
      organization_id: { type: 'string', required: true }
    }
  }),
  userController.searchUsers as RequestHandler
);

// Get presence for organization members
router.get('/organization/:organizationId/presence', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const presence = await userQueries.getOrganizationMemberPresence(organizationId);
    res.json(presence);
  } catch (error) {
    console.error('Error getting organization member presence:', error);
    res.status(500).json({ error: 'Failed to get member presence' });
  }
});

// Get presence for a specific user
router.get('/:userId/presence', async (req, res) => {
  try {
    const { userId } = req.params;
    const presence = await userQueries.getUserPresence(userId);
    if (!presence) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(presence);
  } catch (error) {
    console.error('Error getting user presence:', error);
    res.status(500).json({ error: 'Failed to get user presence' });
  }
});

export default router; 