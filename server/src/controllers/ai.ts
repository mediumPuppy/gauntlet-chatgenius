import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { vectorStoreService } from "../services/vectorStore";
import { LangChainTracer } from "langchain/callbacks";
import pool from "../config/database";
import { OpenAI } from "openai";
import { wrapOpenAI } from "langsmith/wrappers";

const openai = new OpenAI();

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
      vectorStores.map(store => store.similaritySearch(content, 50))
    );

    // Combine and deduplicate results from all stores
    const allResults = searchResults
      .flat()
      .filter((value, index, self) =>
        index === self.findIndex((t) => t.pageContent === value.pageContent)
      );

    console.log(`[AI Query] Found ${allResults.length} relevant messages for analysis`);

    // Format chat history with timestamps and usernames
    const formattedHistory = allResults
      .map(result => {
        const timestamp = new Date(result.metadata.timestamp);
        const formattedDate = timestamp.toLocaleDateString();
        const formattedTime = timestamp.toLocaleTimeString();
        
        // Include message type and thread context
        const messageContext = result.metadata.messageType === 'reply' 
          ? ' (in reply to another message)' 
          : '';
        
        return `[${formattedDate} ${formattedTime}] ${result.metadata.username} in #${result.metadata.channelName}${messageContext}: ${result.pageContent}`;
      })
      .sort((a, b) => {
        const timeA = new Date(a.match(/\[(.*?)\]/)?.[1] || '').getTime();
        const timeB = new Date(b.match(/\[(.*?)\]/)?.[1] || '').getTime();
        return timeA - timeB;
      })
      .join('\n');

    const openAIClient = wrapOpenAI(new OpenAI());
    const completion = await openAIClient.chat.completions.create({
      messages: [
        {
          role: "system" as const,
          content: `Please provide direct, conversational responses that get straight to the point. 
                    When answering questions:
                    - Skip any AI-like preambles (e.g., 'Based on the information provided...')
                    - Focus on the specific question asked
                    - Use natural, human-like language
                    - When referencing chat history, mention who said what and where
                    - Keep responses concise unless depth is needed
                    - Avoid robotic or formulaic language patterns`
        },
        {
          role: "user" as const,
          content: `Question: "${content}"

Available Chat History:
${formattedHistory}`
        }
      ],
      model: "gpt-4-0125-preview",
      temperature: 0.7,
      max_tokens: 500,
      presence_penalty: 0.2,  // Slightly increased
      frequency_penalty: 0.4,  // Slightly increased
      top_p: 0.9,
    });

    const answer = completion.choices[0].message.content;

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
