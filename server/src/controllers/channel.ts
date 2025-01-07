import { Request, Response, RequestHandler } from 'express';
import { channelQueries } from '../models/channel';

export const channelController = {
  createChannel: (async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, organization_id } = req.body;
      const userId = req.user?.id;

      if (!name || !userId || !organization_id) {
        res.status(400).json({ error: 'Name and organization_id are required' });
        return;
      }

      const channel = await channelQueries.createChannel(name, organization_id);
      await channelQueries.addMember(channel.id, userId);

      res.status(201).json(channel);
    } catch (error) {
      console.error('Error creating channel:', error);
      res.status(500).json({ error: 'Failed to create channel' });
    }
  }) as RequestHandler,

  getChannels: (async (req: Request, res: Response): Promise<void> => {
    try {
      const { organization_id } = req.query;
      
      if (!organization_id || typeof organization_id !== 'string') {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const channels = await channelQueries.listOrganizationChannels(organization_id);
      res.json(channels);
    } catch (error) {
      console.error('Error getting channels:', error);
      res.status(500).json({ error: 'Failed to get channels' });
    }
  }) as RequestHandler,

  getChannel: (async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const channel = await channelQueries.getChannel(id);
      
      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }

      const members = await channelQueries.getMembers(id);
      res.json({ ...channel, members });
    } catch (error) {
      console.error('Error getting channel:', error);
      res.status(500).json({ error: 'Failed to get channel' });
    }
  }) as RequestHandler,

  joinChannel: (async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const channel = await channelQueries.getChannel(id);
      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }

      await channelQueries.addMember(id, userId);
      res.json({ message: 'Successfully joined channel' });
    } catch (error) {
      console.error('Error joining channel:', error);
      res.status(500).json({ error: 'Failed to join channel' });
    }
  }) as RequestHandler,

  getUserChannels: (async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { organization_id } = req.query;

      if (!userId || !organization_id || typeof organization_id !== 'string') {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const channels = await channelQueries.getUserChannels(userId, organization_id);
      res.json(channels);
    } catch (error) {
      console.error('Error getting user channels:', error);
      res.status(500).json({ error: 'Failed to get user channels' });
    }
  }) as RequestHandler,

  createDM: (async (req: Request, res: Response): Promise<void> => {
    try {
      const { targetUserId } = req.body;
      const userId = req.user?.id;

      if (!userId || !targetUserId) {
        res.status(400).json({ error: 'Target user ID is required' });
        return;
      }

      const channel = await channelQueries.createDM([userId, targetUserId], req.body.organization_id);
      res.status(201).json(channel);
    } catch (error) {
      console.error('Error creating DM:', error);
      res.status(500).json({ error: 'Failed to create DM' });
    }
  }) as RequestHandler
}; 