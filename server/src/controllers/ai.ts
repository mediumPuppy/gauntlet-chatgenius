import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { vectorStoreService } from "../services/vectorStore";
import pool from "../config/database";

export async function handleBotQuery(req: AuthRequest, res: Response) {
  const { content, channelId, workspaceId } = req.body;
  const userId = req.user?.id;

  if (!userId || !content || (!channelId && !workspaceId)) {
    console.warn("[AI Query] Missing fields:", { userId, content, channelId, workspaceId });
    res.status(400).json({ error: "Missing required fields - need either channelId or workspaceId" });
    return;
  }

  try {
    let organizationId = workspaceId;

    // If channelId is provided, get the organization ID from the channel
    if (channelId) {
      const channelResult = await pool.query(
        "SELECT organization_id FROM channels WHERE id = $1",
        [channelId]
      );

      if (channelResult.rows.length === 0) {
        console.warn(`[AI Query] Channel not found: ${channelId}`);
        res.status(404).json({ error: "Channel not found" });
        return;
      }

      organizationId = channelResult.rows[0].organization_id;
    }

    console.log(`[AI Query] Processing in organization ${organizationId}`);

    // Determine which stores to query based on input
    let vectorStores = [];
    
    if (channelId) {
      // Query both channel and organization stores
      const [channelStore, organizationStore] = await Promise.all([
        vectorStoreService.getVectorStore({ type: "channel", channelId }),
        vectorStoreService.getVectorStore({
          type: "organization",
          organizationId
        })
      ]);
      vectorStores = [channelStore, organizationStore];
    } else {
      // Query only organization store
      const organizationStore = await vectorStoreService.getVectorStore({
        type: "organization",
        organizationId
      });
      vectorStores = [organizationStore];
    }

    // Search all relevant stores
    const searchResults = await Promise.all(
      vectorStores.map(store => store.similaritySearch(content, 3))
    );

    // Combine and deduplicate results from all stores
    const allResults = searchResults
      .flat()
      .filter((value, index, self) =>
        index === self.findIndex((t) => t.pageContent === value.pageContent)
      );

    console.log(`[AI Query] Returning ${allResults.length} unique results`);

    // Format the response
    const answer = allResults.map(result => result.pageContent).join('\n\n');

    res.json({
      answer,
      results: allResults,
      query: content,
      scope: channelId ? 'channel' : 'workspace'
    });

  } catch (error) {
    console.error("[AI Query] Error processing query:", error);
    res.status(500).json({ error: "Failed to process query" });
  }
}
