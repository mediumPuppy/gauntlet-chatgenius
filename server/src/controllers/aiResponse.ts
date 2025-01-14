import { Request, Response } from "express";
import pool from "../config/database";
import { AuthRequest } from "../middleware/auth";
import { WebSocketHandler } from "../websocket/handler";
import { v4 as uuidv4 } from "uuid";
import { UUID } from "crypto";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { ChatOpenAI } from "@langchain/openai";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { LangChainTracer } from "langchain/callbacks";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";

// Create a factory function that takes the WebSocket handler
export const createAIResponseController = (wsHandler: WebSocketHandler) => {
  return {
    generateAIResponse: async (
      req: AuthRequest,
      res: Response,
    ): Promise<void> => {
      try {
        const { mentionedUsername, triggeringMessage, recentMessages } =
          req.body;
        console.log("AI Response Triggered for:", mentionedUsername);
        console.log("Triggering Message:", triggeringMessage);
        console.log("Recent Messages:", recentMessages);

        // Check if mentioned user has AI enabled
        const userResult = await pool.query(
          "SELECT id, ai_enabled FROM users WHERE username = $1",
          [mentionedUsername],
        );
        console.log("User AI Status:", userResult.rows[0]?.ai_enabled);

        if (!userResult.rows.length || !userResult.rows[0].ai_enabled) {
          console.log("AI not enabled for user:", mentionedUsername);
          res.status(200).json({ message: "AI not enabled for user" });
          return;
        }

        // Generate AI response asynchronously
        generateAndSendResponse(
          wsHandler,
          userResult.rows[0].id,
          mentionedUsername,
          triggeringMessage,
          recentMessages,
        );

        console.log("AI response generation triggered successfully");
        res.status(200).json({ message: "AI response generation triggered" });
      } catch (error) {
        console.error("Error in generateAIResponse:", error);
        res.status(500).json({ error: "Failed to generate AI response" });
      }
    },
  };
};

async function generateAndSendResponse(
  wsHandler: WebSocketHandler,
  userId: string,
  username: string,
  triggeringMessage: any,
  recentMessages: any[],
) {
  try {
    console.log("Generating AI response for user:", username);

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    // Initialize the index
    const index = pinecone.Index(process.env.PINECONE_INDEX!);

    // Create embeddings using OpenAI
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Create vector store
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
    });

    // Format conversation history
    const formattedHistory = recentMessages.map((msg) =>
      msg.senderId === userId
        ? new AIMessage(msg.content)
        : new HumanMessage(msg.content),
    );

    // Create chat model with tracing
    const model = new ChatOpenAI({
      modelName: "gpt-4",
      temperature: 0.7,
    }).withConfig({
      callbacks: [new LangChainTracer()],
    });

    // Create prompt template
    const prompt = ChatPromptTemplate.fromTemplate(`
      You are ${username}, a member of this chat. You are responding to ${triggeringMessage.senderName}.

      Recent Chat History: {chat_history}
      Additional Context: {context}
      Current Message: {input}

      Guidelines:
      - Match the tone and formality level of the existing conversation
      - If there's limited context, keep responses neutral and simple
      - Don't assume familiarity unless shown in the chat history
      - Reference shared context only if clearly established
      - Address ${triggeringMessage.senderName} by name naturally, not in every message
      - Keep responses concise and proportional to the message length
      - If the context or intent is unclear, it's okay to ask for clarification
      - Don't force friendliness or personality if the conversation is purely professional

      Remember: Let the conversation flow guide your response style. If there's minimal history, match the tone of the conversation. Don't be too friendly or too professional. Don't bring up things the other person didn't bring up, unless they are relevant as provided to you through the context and other things.
    `);

    // Create the chain
    const chain = await createRetrievalChain({
      retriever: vectorStore.asRetriever(),
      combineDocsChain: await createStuffDocumentsChain({
        llm: model,
        prompt,
      }),
    });

    // Generate response
    const response = await chain.invoke({
      input: triggeringMessage.content,
      chat_history: formattedHistory,
    });

    const aiResponse = response.answer;
    const messageId = uuidv4() as UUID;

    // Save to database first
    await pool.query(
      "INSERT INTO messages (id, content, user_id, channel_id, dm_id, parent_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())",
      [
        messageId,
        aiResponse,
        userId,
        triggeringMessage.isDM ? null : triggeringMessage.channelId,
        triggeringMessage.isDM ? triggeringMessage.channelId : null,
        triggeringMessage.parentId || null,
      ],
    );

    // Then send via WebSocket
    await wsHandler.sendMessage({
      type: "message",
      content: aiResponse,
      channelId: triggeringMessage.channelId,
      id: messageId,
      senderId: userId,
      senderName: username,
      isDM: !!triggeringMessage.dmId,
      parentId: triggeringMessage.parentId,
    });

    console.log("AI response sent and saved successfully");
  } catch (error) {
    console.error("Error generating AI response:", error);
  }
}
