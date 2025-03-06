import { Logger } from '../utils/logger';
import type { Server, ApifyResponse } from '../types';

interface ApifyApiResponse {
  data: {
    guild: {
      name: string;
      icon: string | null;
    };
    presence_count: number;
    member_count: number;
  };
  error?: string;
}

export class ApifyDiscordService {
  private readonly apifyToken: string;
  private readonly actorId: string;
  private readonly logger: Logger;

  constructor(apifyToken: string, actorId: string, logger: Logger) {
    this.apifyToken = apifyToken;
    this.actorId = actorId;
    this.logger = logger;
  }

  async fetchServerData(server: Server, retryCount = 0): Promise<ApifyResponse | null> {
    const maxRetries = 3;
    const baseDelay = 2000;

    try {
      this.logger.debug('Fetching server data from Apify', {
        guild_id: server.guild_id,
        invite_code: server.invite_code,
        retry: retryCount
      });

      const response = await fetch(`https://api.apify.com/v2/acts/${this.actorId}/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apifyToken}`
        },
        body: JSON.stringify({
          guildId: server.guild_id,
          inviteCode: server.invite_code
        })
      });

      if (!response.ok) {
        throw new Error(`Apify API error: ${response.status} ${response.statusText}`);
      }

      const apiResponse = await response.json() as ApifyApiResponse;
      
      if (apiResponse.error) {
        throw new Error(`Apify actor error: ${apiResponse.error}`);
      }

      if (!apiResponse.data?.guild) {
        throw new Error('Invalid API response: missing guild data');
      }

      return {
        name: apiResponse.data.guild.name || 'Unknown Server',
        icon: apiResponse.data.guild.icon,
        presence_count: apiResponse.data.presence_count || 0,
        member_count: apiResponse.data.member_count || 0
      };

    } catch (error) {
      this.logger.error('Error fetching server data', error as Error, {
        guild_id: server.guild_id,
        invite_code: server.invite_code,
        retry: retryCount
      });

      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchServerData(server, retryCount + 1);
      }

      return null;
    }
  }

  async fetchBatchServerData(servers: Server[]): Promise<Map<string, ApifyResponse | null>> {
    const results = new Map<string, ApifyResponse | null>();
    const batchSize = 10;
    
    for (let i = 0; i < servers.length; i += batchSize) {
      const batch = servers.slice(i, Math.min(i + batchSize, servers.length));
      
      this.logger.info('Processing server batch', {
        batchIndex: i / batchSize,
        batchSize: batch.length,
        totalServers: servers.length
      });

      const batchPromises = batch.map(async server => {
        const data = await this.fetchServerData(server);
        if (data) {
          results.set(server.guild_id, data);
        }
      });

      await Promise.all(batchPromises);

      if (i + batchSize < servers.length) {
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay between batches
      }
    }

    return results;
  }
} 