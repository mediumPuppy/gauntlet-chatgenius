import { Pool } from 'pg';
import { vectorStoreService } from '../services/vectorStore';
import { sleep } from '../utils/async';

interface SyncJob {
  type: 'workspace' | 'channel';
  id: string;
  lastSync?: Date;
}

export class VectorStoreSyncJob {
  private pool: Pool;
  private isRunning: boolean = false;
  private syncInterval: number = 259200000; // 3 days in milliseconds (3 * 24 * 60 * 60 * 1000)
  private batchSize: number;

  constructor(pool: Pool) {
    this.pool = pool;
    this.batchSize = parseInt(process.env.VECTOR_STORE_BATCH_SIZE || '100');
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    while (this.isRunning) {
      try {
        await this.runSync();
        await sleep(this.syncInterval);
      } catch (error) {
        console.error('Error in vector store sync job:', error);
        await sleep(5000); // Wait 5 seconds before retrying on error
      }
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  private async runSync(): Promise<void> {
    // Get all workspaces and channels that need syncing
    const jobs = await this.getJobsToSync();

    console.log(`Starting sync job, found ${jobs.length} jobs to process`);

    for (const job of jobs) {
      try {
        await this.syncVectorStore(job);
      } catch (error) {
        console.error(`Error syncing vector store for ${job.type} ${job.id}:`, error);
      }
    }
  }

  private async getJobsToSync(): Promise<SyncJob[]> {
    const result = await this.pool.query(`
      SELECT 
        'workspace' as type,
        o.id,
        vs.last_updated_at as last_sync
      FROM organizations o
      LEFT JOIN vector_stores vs ON 
        vs.workspace_id = o.id AND 
        vs.type = 'workspace'
      WHERE vs.last_updated_at IS NULL OR 
            vs.last_updated_at < NOW() - INTERVAL '1 day'
      UNION ALL
      SELECT 
        'channel' as type,
        c.id,
        vs.last_updated_at as last_sync
      FROM channels c
      LEFT JOIN vector_stores vs ON 
        vs.channel_id = c.id AND 
        vs.type = 'channel'
      WHERE vs.last_updated_at IS NULL OR 
            vs.last_updated_at < NOW() - INTERVAL '1 day'
    `);

    return result.rows;
  }

  private async syncVectorStore(job: SyncJob): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const config = { 
        type: job.type, 
        ...(job.type === 'workspace' ? { workspaceId: job.id } : { channelId: job.id })
      };

      // Check if namespace exists before creating
      const exists = await vectorStoreService.namespaceExists(config);
      if (exists) {
        console.log(`Namespace already exists for ${job.type} ${job.id}, skipping creation`);
        await client.query('COMMIT');
        return;
      }

      // Create new vector store entry
      await vectorStoreService.createStore(config);
      console.log(`Created new namespace for ${job.type} ${job.id}, proceeding with initial sync`);

      // Only get messages if we created a new namespace
      const messages = await client.query(
        `SELECT content FROM messages 
         WHERE ${job.type === 'workspace' ? 'channel_id IN (SELECT id FROM channels WHERE organization_id = $1)' : 'channel_id = $1'}
         AND created_at > $2
         ORDER BY created_at ASC`,
        [job.id, job.lastSync || new Date(0)]
      );

      if (messages.rows.length > 0) {
        console.log(`Syncing ${messages.rows.length} messages to new namespace ${job.type} ${job.id}`);
        await vectorStoreService.addDocuments(
          config,
          messages.rows.map(row => row.content)
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} 