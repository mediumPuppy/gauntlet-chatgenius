import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import pool from "../config/database";

interface VectorStoreConfig {
  type: "organization" | "channel";
  organizationId?: string;
  channelId?: string;
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
          batch.map((content) => ({
            pageContent: content,
            metadata: { timestamp: new Date().toISOString() },
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
    return await PineconeStore.fromExistingIndex(this.embeddings, {
      pineconeIndex: this.index,
      namespace: await this.getStoreNamespace(config),
    });
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
