import { Router, RequestHandler } from "express";
import { searchMessages } from "../controllers/search";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// GET /api/search/messages?q=someSearchTerm
router.get("/messages", authenticateToken, searchMessages as RequestHandler);

export default router;
