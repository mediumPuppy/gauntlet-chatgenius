import { Request, Response } from 'express';
import { userQueries } from '../models/user';

export const userController = {
  async searchUsers(req: Request, res: Response) {
    try {
      const query = req.query.q as string;
      const currentUserId = req.user!.id;

      // Search users excluding the current user
      const users = await userQueries.searchUsers(query, currentUserId);
      res.json(users);
    } catch (error) {
      console.error('Error searching users:', error);
      res.status(500).json({ message: 'Failed to search users' });
    }
  }
}; 