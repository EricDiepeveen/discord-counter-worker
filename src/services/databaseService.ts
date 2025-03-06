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

      return result.results || [];
    } catch (error) {
      this.logger.error('Error fetching servers from database', error as Error);
      return [];
    }
  }

  async updateServerData(guildId: string, data: ServerData): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    try {
      // Ensure we have valid data before updating
      const validData = {
        name: data.name || 'Unknown Server',
        icon: data.icon || null,
        presence_count: data.presence_count || 0,
        member_count: data.member_count || 0,
        last_updated: now,
        data_json: JSON.stringify(data)
      };

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
          validData.name,
          validData.icon,
          validData.presence_count,
          validData.member_count,
          validData.last_updated,
          validData.data_json,
          guildId
        )
        .run();

      this.logger.debug('Updated server data', {
        guild_id: guildId,
        name: validData.name,
        member_count: validData.member_count
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
          data.presence_count || 0,
          data.member_count || 0,
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
            COALESCE(SUM(member_count), 0) as total_members,
            COALESCE(SUM(presence_count), 0) as total_presence,
            COUNT(*) as server_count
          FROM discord_servers
        `)
        .all<GlobalStats>();

      const stats = statsResult.results?.[0] || {
        total_members: 0,
        total_presence: 0,
        server_count: 0
      };

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