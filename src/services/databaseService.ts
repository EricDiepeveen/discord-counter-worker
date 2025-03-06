import { D1Database } from '@cloudflare/workers-types';
import { Logger } from '../utils/logger';
import type { Server, ServerData, GlobalStats } from '../types';

export class DatabaseService {
  private readonly db: D1Database;
  private readonly logger: Logger;

  constructor(db: D1Database, logger: Logger) {
    this.db = db;
    this.logger = logger;
  }

  async getAllServers(): Promise<Server[]> {
    try {
      const result = await this.db
        .prepare('SELECT guild_id, invite_code FROM discord_servers')
        .all<Server>();

      return result.results;
    } catch (error) {
      this.logger.error('Error fetching servers from database', error as Error);
      return [];
    }
  }

  async updateServerData(guildId: string, data: ServerData): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    try {
      await this.db
        .prepare(`
          UPDATE discord_servers
          SET 
            name = ?,
            icon = ?,
            presence_count = ?,
            member_count = ?,
            last_updated = ?,
            data_json = ?
          WHERE guild_id = ?
        `)
        .bind(
          data.name,
          data.icon,
          data.presence_count,
          data.member_count,
          now,
          JSON.stringify(data),
          guildId
        )
        .run();

      this.logger.debug('Updated server data', {
        guild_id: guildId,
        name: data.name,
        member_count: data.member_count
      });
    } catch (error) {
      this.logger.error('Error updating server data', error as Error, {
        guild_id: guildId
      });
      throw error;
    }
  }

  async addHistoryEntry(guildId: string, data: ServerData): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    try {
      await this.db
        .prepare(`
          INSERT INTO discord_server_history (
            guild_id,
            presence_count,
            member_count,
            timestamp
          ) VALUES (?, ?, ?, ?)
        `)
        .bind(
          guildId,
          data.presence_count,
          data.member_count,
          now
        )
        .run();

      this.logger.debug('Added history entry', {
        guild_id: guildId,
        timestamp: now
      });
    } catch (error) {
      this.logger.error('Error adding history entry', error as Error, {
        guild_id: guildId
      });
      throw error;
    }
  }

  async updateGlobalStats(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    try {
      // Calculate total members across all servers
      const statsResult = await this.db
        .prepare(`
          SELECT 
            SUM(member_count) as total_members,
            SUM(presence_count) as total_presence,
            COUNT(*) as server_count
          FROM discord_servers
        `)
        .all<GlobalStats>();

      const stats = statsResult.results[0];

      if (!stats) {
        throw new Error('Failed to calculate global stats');
      }

      // Add hourly summary entry
      await this.db
        .prepare(`
          INSERT INTO discord_server_hourly_summary (
            hour_timestamp,
            total_members,
            total_online,
            server_count,
            created_at
          ) VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          Math.floor(now / 3600) * 3600,
          stats.total_members,
          stats.total_presence,
          stats.server_count,
          now
        )
        .run();

      this.logger.info('Updated global statistics', {
        total_members: stats.total_members,
        total_presence: stats.total_presence,
        server_count: stats.server_count,
        timestamp: now
      });
    } catch (error) {
      this.logger.error('Error updating global statistics', error as Error);
      throw error;
    }
  }
} 