import pool from '../config/database';

export interface Channel {
  id: string;
  name: string;
  is_dm: boolean;
  organization_id: string;
  created_at: Date;
}

export interface ChannelMember {
  channel_id: string;
  user_id: string;
}

export const channelQueries = {
  async createChannel(name: string, organizationId: string, isDm: boolean = false): Promise<Channel> {
    const result = await pool.query(
      'INSERT INTO channels (name, organization_id, is_dm) VALUES ($1, $2, $3) RETURNING *',
      [name, organizationId, isDm]
    );
    return result.rows[0];
  },

  async getChannel(id: string): Promise<Channel | null> {
    const result = await pool.query('SELECT * FROM channels WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async listOrganizationChannels(organizationId: string): Promise<Channel[]> {
    const result = await pool.query(
      'SELECT * FROM channels WHERE organization_id = $1 AND is_dm = false ORDER BY created_at DESC',
      [organizationId]
    );
    return result.rows;
  },

  async addMember(channelId: string, userId: string): Promise<void> {
    // First verify user is member of the organization
    const result = await pool.query(
      `SELECT 1 FROM channels c
       INNER JOIN organization_members om ON c.organization_id = om.organization_id
       WHERE c.id = $1 AND om.user_id = $2`,
      [channelId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User is not a member of this organization');
    }

    await pool.query(
      'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
      [channelId, userId]
    );
  },

  async getMembers(channelId: string): Promise<string[]> {
    const result = await pool.query(
      'SELECT user_id FROM channel_members WHERE channel_id = $1',
      [channelId]
    );
    return result.rows.map(row => row.user_id);
  },

  async createDM(userIds: [string, string], organizationId: string): Promise<Channel> {
    // Start a transaction to ensure atomicity
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Verify both users are in the organization
      const memberCheck = await client.query(
        'SELECT user_id FROM organization_members WHERE organization_id = $1 AND user_id = ANY($2)',
        [organizationId, userIds]
      );
      
      if (memberCheck.rows.length !== 2) {
        throw new Error('Both users must be members of the organization');
      }
      
      // Create DM channel
      const channelResult = await client.query(
        'INSERT INTO channels (name, organization_id, is_dm) VALUES ($1, $2, true) RETURNING *',
        [`dm-${userIds[0]}-${userIds[1]}`, organizationId]
      );
      
      // Add both users to the channel
      await client.query(
        'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2), ($1, $3)',
        [channelResult.rows[0].id, userIds[0], userIds[1]]
      );
      
      await client.query('COMMIT');
      return channelResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async getUserChannels(userId: string, organizationId: string): Promise<Channel[]> {
    const result = await pool.query(
      `SELECT c.* FROM channels c
       INNER JOIN channel_members cm ON c.id = cm.channel_id
       WHERE cm.user_id = $1 AND c.organization_id = $2
       ORDER BY c.created_at DESC`,
      [userId, organizationId]
    );
    return result.rows;
  }
}; 