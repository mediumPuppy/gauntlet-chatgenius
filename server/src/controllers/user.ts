import { Request, Response } from 'express';
import { userQueries } from '../models/user';
import { AuthRequest } from '../middleware/auth';

export const userController = {
  async searchUsers(req: AuthRequest, res: Response) {
    try {
      const query = req.query.q as string;
      const organizationId = req.query.organization_id as string;
      const currentUserId = req.user!.id;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }

      // Search users excluding the current user
      const users = await userQueries.searchOrganizationUsers(query, organizationId, currentUserId);
      res.json(users);
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  }
}; 