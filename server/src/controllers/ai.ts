import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { vectorStoreService } from "../services/vectorStore";
import pool from "../config/database";

export async function handleBotQuery(req: AuthRequest, res: Response) {
  const { content, channelId } = req.body;
  const userId = req.user?.id;

  console.log(
    `[AI Query] User ${userId} in channel ${channelId}: "${content}"`,
  );

  if (!userId || !content || !channelId) {
    console.warn("[AI Query] Missing fields:", { userId, content, channelId });
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    // Get channel and workspace info
    const channelResult = await pool.query(
      "SELECT organization_id FROM channels WHERE id = $1",
      [channelId],
    );

    if (channelResult.rows.length === 0) {
      console.warn(`[AI Query] Channel not found: ${channelId}`);
      res.status(404).json({ error: "Channel not found" });
      return;
    }

    const workspaceId = channelResult.rows[0].organization_id;
    console.log(`[AI Query] Processing in workspace ${workspaceId}`);

    // Query both channel and workspace vector stores
    const [channelStore, workspaceStore] = await Promise.all([
      vectorStoreService.getVectorStore({ type: "channel", channelId }),
      vectorStoreService.getVectorStore({ type: "workspace", workspaceId }),
    ]);

    // Search both stores
    const [channelResults, workspaceResults] = await Promise.all([
      channelStore.similaritySearch(content, 3),
      workspaceStore.similaritySearch(content, 3),
    ]);

    console.log(
      `[AI Query] Found ${channelResults.length} channel results and ${workspaceResults.length} workspace results`,
    );

    // Combine and deduplicate results
    const allResults = [...channelResults, ...workspaceResults].filter(
      (value, index, self) =>
        index === self.findIndex((t) => t.pageContent === value.pageContent),
    );

    console.log(`[AI Query] Returning ${allResults.length} unique results`);

    res.json({
      results: allResults,
      query: content,
    });
  } catch (error) {
    console.error("[AI Query] Error processing query:", error);
    res.status(500).json({ error: "Failed to process query" });
  }
}
