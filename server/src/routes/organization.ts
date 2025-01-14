import express, { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import pool from "../config/db";
import { v4 as uuidv4 } from "uuid";
import { vectorStoreService } from "../services/vectorStore";

const router = express.Router();

// Get organizations for current user
router.get(
  "/user",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const organizations = await pool.query(
        `SELECT o.* 
       FROM organizations o
       JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1`,
        [userId],
      );

      res.json(organizations.rows);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  },
);

// Create new organization
router.post(
  "/",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();
    try {
      const { name } = req.body;
      const userId = req.user?.id;

      if (!name) {
        res.status(400).json({ error: "Organization name is required" });
        return;
      }

      await client.query("BEGIN");

      // Create organization
      const orgResult = await client.query(
        `INSERT INTO organizations (name, created_by, created_at)
         VALUES ($1, $2, NOW())
         RETURNING *`,
        [name, userId],
      );

      // Add creator as member with 'owner' role
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [orgResult.rows[0].id, userId],
      );

      // Initialize vector store with consistent config format
      const config = {
        type: "organization" as const,
        organizationId: orgResult.rows[0].id,
      };

      try {
        const exists = await vectorStoreService.namespaceExists(config);
        if (!exists) {
          await vectorStoreService.createStore(config);
          console.log(`[VectorStore] Successfully created vector store for organization ${orgResult.rows[0].id}`);
        }
      } catch (vectorError) {
        console.error("Error initializing organization vector store:", vectorError);
        // Don't fail organization creation if vector store initialization fails
      }

      await client.query("COMMIT");
      res.status(201).json(orgResult.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error creating organization:", error);
      res.status(500).json({ error: "Failed to create organization" });
    } finally {
      client.release();
    }
  },
);

// Get organization role for current user
router.get(
  "/:organizationId/role",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.id;

      const roleResult = await pool.query(
        `SELECT role
       FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, userId],
      );

      if (roleResult.rows.length === 0) {
        res
          .status(404)
          .json({ error: "User is not a member of this organization" });
        return;
      }

      res.json({ role: roleResult.rows[0].role });
    } catch (error) {
      console.error("Error fetching user role:", error);
      res.status(500).json({ error: "Failed to fetch user role" });
    }
  },
);

// Join organization with invite code
router.post(
  "/join",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { inviteCode } = req.body;
      const userId = req.user?.id;

      if (!inviteCode) {
        res.status(400).json({ error: "Invite code is required" });
        return;
      }

      // First verify the user exists
      const userExists = await pool.query("SELECT 1 FROM users WHERE id = $1", [
        userId,
      ]);

      if (userExists.rows.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Rest of your existing code for verifying invite code and adding member
      const inviteResult = await pool.query(
        `SELECT organization_id, expires_at
       FROM organization_invites
       WHERE code = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
        [inviteCode],
      );

      if (inviteResult.rows.length === 0) {
        res.status(404).json({ error: "Invalid or expired invite code" });
        return;
      }

      const organizationId = inviteResult.rows[0].organization_id;

      // Check if user is already a member
      const membershipCheck = await pool.query(
        `SELECT 1 FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, userId],
      );

      if (membershipCheck.rows.length > 0) {
        res
          .status(400)
          .json({ error: "You are already a member of this organization" });
        return;
      }

      // Add user to organization with 'member' role
      await pool.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'member')`,
        [organizationId, userId],
      );

      res.status(200).json({ message: "Successfully joined organization" });
    } catch (error) {
      console.error("Error joining organization:", error);
      res.status(500).json({ error: "Failed to join organization" });
    }
  },
);

// Generate invite code
router.post(
  "/:organizationId/invite-code",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.id;
      const { email } = req.body; // Optional email

      // Check if user has permission (is owner or admin)
      const roleCheck = await pool.query(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, userId],
      );

      if (
        roleCheck.rows.length === 0 ||
        !["owner", "admin"].includes(roleCheck.rows[0].role)
      ) {
        res.status(403).json({ error: "Insufficient permissions" });
        return;
      }

      // Generate a new invite code
      const code = uuidv4().split("-")[0]; // Use first part of UUID for shorter code
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      try {
        const result = await pool.query(
          `INSERT INTO organization_invites (organization_id, invited_by, code, email, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING code, expires_at, created_at`,
          [organizationId, userId, code, email || null, expiresAt],
        );

        res.status(201).json(result.rows[0]);
      } catch (dbError) {
        console.error("Database error:", dbError);
        throw dbError;
      }
    } catch (error) {
      console.error("Error generating invite code:", error);
      if (error instanceof Error) {
        res
          .status(500)
          .json({ error: `Failed to generate invite code: ${error.message}` });
      } else {
        res.status(500).json({ error: "Failed to generate invite code" });
      }
    }
  },
);

// Get active invite codes
router.get(
  "/:organizationId/invite-codes",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.id;

      // Check if user has permission (is owner or admin)
      const roleCheck = await pool.query(
        "SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2",
        [organizationId, userId],
      );

      if (
        roleCheck.rows.length === 0 ||
        !["owner", "admin"].includes(roleCheck.rows[0].role)
      ) {
        res.status(403).json({ error: "Insufficient permissions" });
        return;
      }

      try {
        const result = await pool.query(
          `SELECT code, email, expires_at, created_at
         FROM organization_invites
         WHERE organization_id = $1
         AND (expires_at > NOW() OR expires_at IS NULL)
         ORDER BY created_at DESC`,
          [organizationId],
        );

        res.json(result.rows);
      } catch (dbError) {
        console.error("Database error:", dbError);
        throw dbError;
      }
    } catch (error) {
      console.error("Error fetching invite codes:", error);
      if (error instanceof Error) {
        res
          .status(500)
          .json({ error: `Failed to fetch invite codes: ${error.message}` });
      } else {
        res.status(500).json({ error: "Failed to fetch invite codes" });
      }
    }
  },
);

export default router;
