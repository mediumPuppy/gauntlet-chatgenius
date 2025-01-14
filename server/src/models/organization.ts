import pool from "../config/database";

export interface Organization {
  id: string;
  name: string;
  created_by: string;
  created_at: Date;
}

export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: Date;
}

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  email: string;
  invited_by: string;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export const organizationQueries = {
  async createOrganization(
    name: string,
    userId: string,
  ): Promise<Organization> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Create organization
      const orgResult = await client.query(
        "INSERT INTO organizations (name, created_by) VALUES ($1, $2) RETURNING *",
        [name, userId],
      );

      // Add creator as owner
      await client.query(
        "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)",
        [orgResult.rows[0].id, userId, "owner"],
      );

      await client.query("COMMIT");
      return orgResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const result = await pool.query(
      `SELECT o.* 
       FROM organizations o
       INNER JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId],
    );
    return result.rows;
  },

  async createInvite(
    organizationId: string,
    email: string,
    invitedBy: string,
  ): Promise<OrganizationInvite> {
    const token = Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const result = await pool.query(
      `INSERT INTO organization_invites 
       (organization_id, email, invited_by, token, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [organizationId, email, invitedBy, token, expiresAt],
    );
    return result.rows[0];
  },

  async getInviteByToken(token: string): Promise<OrganizationInvite | null> {
    const result = await pool.query(
      "SELECT * FROM organization_invites WHERE token = $1 AND expires_at > NOW()",
      [token],
    );
    return result.rows[0] || null;
  },

  async addMember(
    organizationId: string,
    userId: string,
    role: "member" | "admin" = "member",
  ): Promise<void> {
    await pool.query(
      "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)",
      [organizationId, userId, role],
    );
  },

  async getMemberRole(
    organizationId: string,
    userId: string,
  ): Promise<string | null> {
    const result = await pool.query(
      "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
      [organizationId, userId],
    );
    return result.rows[0]?.role || null;
  },
};
