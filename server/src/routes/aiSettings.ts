import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import pool from "../config/database";

const router = Router();

router.post("/ai-toggle", authenticateToken, async (req, res) => {
  try {
    // Get current AI status
    const result = await pool.query(
      "SELECT ai_enabled FROM users WHERE id = $1",
      [req.user!.id],
    );

    // Toggle the status
    const newStatus = !result.rows[0].ai_enabled;

    // Update the database
    await pool.query("UPDATE users SET ai_enabled = $1 WHERE id = $2", [
      newStatus,
      req.user!.id,
    ]);

    res.json({ aiEnabled: newStatus });
  } catch (error) {
    console.error("Error toggling AI setting:", error);
    res.status(500).json({ error: "Failed to toggle AI setting" });
  }
});

router.get("/ai-status", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT ai_enabled FROM users WHERE id = $1",
      [req.user!.id],
    );

    res.json({ aiEnabled: result.rows[0].ai_enabled });
  } catch (error) {
    console.error("Error getting AI status:", error);
    res.status(500).json({ error: "Failed to get AI status" });
  }
});

export default router;
