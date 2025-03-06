import { Hono } from 'hono';
import { D1Database, ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';
import { Logger } from './utils/logger';
import { ApifyDiscordService } from './services/apifyDiscordService';
import { DatabaseService } from './services/databaseService';
import type { Server, ServerData } from './types';

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  APIFY_TOKEN: string;
  APIFY_ACTOR_ID: string;
}

const app = new Hono<{ Bindings: Env }>();

async function processServers(env: Env, logger: Logger): Promise<void> {
  const workerId = crypto.randomUUID();
  const workerLogger = logger.withRequestId(workerId);

  workerLogger.info('Starting Discord server update job', {
    workerId,
    environment: env.ENVIRONMENT || 'production'
  });

  try {
    const dbService = new DatabaseService(env.DB, workerLogger);
    const apifyService = new ApifyDiscordService(
      env.APIFY_TOKEN,
      env.APIFY_ACTOR_ID,
      workerLogger
    );

    // Fetch all servers from the database
    const servers = await dbService.getAllServers();
    
    workerLogger.info('Fetched servers from database', {
      count: servers.length,
      workerId
    });

    // Process servers in batches
    const serverDataMap = await apifyService.fetchBatchServerData(servers);

    // Update database with new data
    let successCount = 0;
    let errorCount = 0;

    for (const [guildId, data] of serverDataMap.entries()) {
      try {
        if (data) {
          const serverData: ServerData = {
            ...data,
            last_updated: Math.floor(Date.now() / 1000),
            data_json: JSON.stringify(data)
          };

          await dbService.updateServerData(guildId, serverData);
          await dbService.addHistoryEntry(guildId, serverData);
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        workerLogger.error('Error updating server in database', error as Error, {
          guild_id: guildId,
          workerId
        });
      }
    }

    // Update global statistics
    await dbService.updateGlobalStats();

    workerLogger.info('Discord server update job complete', {
      successCount,
      errorCount,
      totalCount: servers.length,
      workerId
    });
  } catch (error) {
    workerLogger.error('Discord server update job failed', error as Error, {
      workerId
    });
    throw error;
  }
}

// API routes
app.post('/trigger-update', async (c) => {
  const logger = new Logger('info');
  
  try {
    await processServers(c.env, logger);
    return c.text('Server update completed successfully');
  } catch (error) {
    logger.error('Error processing manual update', error as Error);
    return c.text('Error processing update', 500);
  }
});

// Health check endpoint
app.get('/', (c) => c.text('Discord Counter Worker is running!'));

// Export worker
export default {
  fetch: app.fetch,
  
  // Handle scheduled events
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const logger = new Logger('info');
    
    try {
      // For scheduled events, use waitUntil to allow for longer execution
      ctx.waitUntil(processServers(env, logger));
    } catch (error) {
      logger.error('Error in scheduled handler', error as Error);
      throw error;
    }
  }
}; 