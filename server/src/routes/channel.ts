import { Router, RequestHandler } from "express";
import { channelController } from "../controllers/channel";
import { getMessages } from "../controllers/message";
import { authenticateToken } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";

const router = Router();

// Apply authentication middleware to all channel routes
router.use(authenticateToken);

// Create a new channel
router.post(
  "/",
  validateRequest({
    body: {
      name: { type: "string", required: true },
      organization_id: { type: "string", required: true },
    },
  }),
  channelController.createChannel as RequestHandler,
);

// Get all channels
router.get("/", channelController.getChannels as RequestHandler);

// Get user's channels
router.get("/me", channelController.getUserChannels as RequestHandler);

// Get specific channel
router.get("/:id", channelController.getChannel as RequestHandler);

// Join a channel
router.post("/:id/join", channelController.joinChannel as RequestHandler);

// Message routes - only keep the GET route
router.get("/:channelId/messages", getMessages as RequestHandler);

export default router;
