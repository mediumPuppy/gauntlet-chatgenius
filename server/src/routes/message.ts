import express, { RequestHandler } from "express";
import {
  getMessages,
  getThreadMessages,
} from "../controllers/message";
import { authenticateToken } from "../middleware/auth";
import { addReaction, removeReaction } from "../controllers/messageReactions";

const router = express.Router();

// Thread routes
router.get(
  "/thread/:messageId",
  authenticateToken,
  getThreadMessages as RequestHandler,
);

// Main message routes
router.get("/", authenticateToken, getMessages as RequestHandler);

router.post("/:messageId/reactions", authenticateToken, async (req, res) => {
  await addReaction(req, res);
});

router.delete("/:messageId/reactions", authenticateToken, async (req, res) => {
  await removeReaction(req, res);
});

export default router;
