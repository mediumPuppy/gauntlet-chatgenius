import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import pool from "../config/database";
import { LangChainTracer } from "langchain/callbacks";
import { Client } from "langsmith";

interface VectorStoreConfig {
  type: "organization" | "channel";
  organizationId?: string;
  channelId?: string;
}

interface MessageDocument {
  content: string;
  userId: string;
  username: string;
  timestamp: Date;
  channelName: string;
  messageType: 'message' | 'reply';
  parentMessageId?: string;
}

export class VectorStoreService {
  private pinecone: Pinecone;
  private embeddings: OpenAIEmbeddings;
  private index: any; // We'll type this properly

  constructor() {
    if (!process.env.PINECONE_API_KEY) {
      console.error("[VectorStore] Missing PINECONE_API_KEY");
      throw new Error("Missing Pinecone API key");
    }

    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // Create index if it doesn't exist
    const indexName = process.env.PINECONE_INDEX || "default";
    this.index = this.pinecone.index(indexName);

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // The tracing will happen automatically when the env vars are set
  }

  private async getStoreNamespace({
    type,
    organizationId,
    channelId,
  }: VectorStoreConfig): Promise<string> {
    const prefix = process.env.PINECONE_NAMESPACE_PREFIX || "";
    return `${prefix}_${type}_${organizationId || channelId}`;
  }

  async createStore(config: VectorStoreConfig): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Create database entry
      const result = await client.query(
        `INSERT INTO vector_stores (type, organization_id, channel_id, name)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          config.type,
          config.organizationId,
          config.channelId,
          await this.getStoreNamespace(config),
        ],
      );
      
      const namespace = await this.getStoreNamespace(config);
      console.log(`[VectorStore] Attempting to create Pinecone namespace: ${namespace}`);

      // Initialize Pinecone namespace
      try {
        const vectorStore = await PineconeStore.fromExistingIndex(
          this.embeddings,
          {
            pineconeIndex: this.index,
            namespace: namespace,
          },
        );
        console.log(`[VectorStore] Successfully initialized Pinecone namespace: ${namespace}`);
      } catch (error) {
        console.error(`[VectorStore] Failed to initialize Pinecone namespace: ${namespace}`, error);
        throw error;
      }

      await client.query("COMMIT");
      console.log(`[VectorStore] Successfully committed vector store creation for ${config.type} ${config.organizationId || config.channelId}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`[VectorStore] Error creating vector store:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async addDocuments(
    config: VectorStoreConfig,
    documents: MessageDocument[],
  ): Promise<void> {
    const namespace = await this.getStoreNamespace(config);

    try {
      // Verify index connection
      const indexStats = await this.index.describeIndexStats();

      const vectorStore = await PineconeStore.fromExistingIndex(
        this.embeddings,
        {
          pineconeIndex: this.index,
          namespace: namespace,
        },
      );

      // Update vectors in batches
      const batchSize = parseInt(process.env.VECTOR_STORE_BATCH_SIZE || "10");
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await vectorStore.addDocuments(
          batch.map((doc) => ({
            pageContent: doc.content,
            metadata: {
              userId: doc.userId,
              username: doc.username,
              timestamp: doc.timestamp.toISOString(),
              channelName: doc.channelName,
              messageType: doc.messageType,
              parentMessageId: doc.parentMessageId,
            },
          })),
        );
      }
    } catch (error) {
      console.error(
        `[VectorStore] Failed to add documents to namespace: ${namespace}`,
        error,
      );
      throw error;
    }
  }

  async getVectorStore(config: VectorStoreConfig): Promise<PineconeStore> {
    return await PineconeStore.fromExistingIndex(
      this.embeddings,
      {
        pineconeIndex: this.index,
        namespace: await this.getStoreNamespace(config),
      },
    );
  }

  async namespaceExists(config: VectorStoreConfig): Promise<boolean> {
    try {
      const namespace = await this.getStoreNamespace(config);
      const stats = await this.index.describeIndexStats({
        filter: { namespace: namespace },
      });

      // Check if namespace exists and has vectors
      return stats.namespaces[namespace]?.vectorCount > 0;
    } catch (error) {
      console.error(`[VectorStore] Error checking namespace: ${error}`);
      return false;
    }
  }
}

export const vectorStoreService = new VectorStoreService();
