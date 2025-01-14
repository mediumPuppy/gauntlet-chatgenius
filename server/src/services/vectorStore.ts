import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import pool from "../config/database";

interface VectorStoreConfig {
  type: "workspace" | "channel";
  workspaceId?: string;
  channelId?: string;
}

export class VectorStoreService {
  private pinecone: Pinecone;
  private embeddings: OpenAIEmbeddings;
  private index: any; // We'll type this properly

  constructor() {
    console.log("[VectorStore] Initializing Pinecone connection");

    if (!process.env.PINECONE_API_KEY) {
      console.error("[VectorStore] Missing PINECONE_API_KEY");
      throw new Error("Missing Pinecone API key");
    }

    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // Create index if it doesn't exist
    const indexName = process.env.PINECONE_INDEX || "default";

    try {
      // Try to get the index first
      this.index = this.pinecone.Index(indexName);
      console.log(`[VectorStore] Connected to existing index: ${indexName}`);
    } catch (error) {
      console.log(`[VectorStore] Index ${indexName} not found, creating...`);
      // Create the index if it doesn't exist
      this.pinecone.createIndex({
        name: indexName,
        dimension: 1536,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: "us-east-1",
          },
        },
      });
      this.index = this.pinecone.Index(indexName);
      console.log(`[VectorStore] Created and connected to index: ${indexName}`);
    }

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  private async getStoreNamespace({
    type,
    workspaceId,
    channelId,
  }: VectorStoreConfig): Promise<string> {
    const prefix = process.env.PINECONE_NAMESPACE_PREFIX || "";
    return `${prefix}_${type}_${workspaceId || channelId}`;
  }

  async createStore(config: VectorStoreConfig): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Create database entry
      const result = await client.query(
        `INSERT INTO vector_stores (type, workspace_id, channel_id, name)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          config.type,
          config.workspaceId,
          config.channelId,
          await this.getStoreNamespace(config),
        ],
      );

      // Initialize Pinecone namespace
      const vectorStore = await PineconeStore.fromExistingIndex(
        this.embeddings,
        {
          pineconeIndex: this.index,
          namespace: await this.getStoreNamespace(config),
        },
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async addDocuments(
    config: VectorStoreConfig,
    documents: string[],
  ): Promise<void> {
    const namespace = await this.getStoreNamespace(config);
    console.log(
      `[VectorStore] Adding ${documents.length} documents to namespace: ${namespace}`,
    );

    try {
      // Verify index connection
      const indexStats = await this.index.describeIndexStats();
      console.log(
        `[VectorStore] Connected to index. Current stats:`,
        indexStats,
      );

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
        console.log(
          `[VectorStore] Processing batch ${i / batchSize + 1}, size: ${batch.length}`,
        );
        await vectorStore.addDocuments(
          batch.map((content) => ({
            pageContent: content,
            metadata: { timestamp: new Date().toISOString() },
          })),
        );
      }

      console.log(
        `[VectorStore] Successfully added all documents to namespace: ${namespace}`,
      );
    } catch (error) {
      console.error(
        `[VectorStore] Failed to add documents to namespace: ${namespace}`,
        error,
      );
      throw error;
    }
  }

  async getVectorStore(config: VectorStoreConfig): Promise<PineconeStore> {
    return await PineconeStore.fromExistingIndex(this.embeddings, {
      pineconeIndex: this.index,
      namespace: await this.getStoreNamespace(config),
    });
  }

  async namespaceExists(config: VectorStoreConfig): Promise<boolean> {
    try {
      console.log(
        `[VectorStore] Checking if namespace exists jl: ${config.type} ${config.workspaceId || config.channelId}`,
      );
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
