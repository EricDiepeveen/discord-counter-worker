import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '../src/utils/logger';
import { ApifyDiscordService } from '../src/services/apifyDiscordService';
import { DatabaseService } from '../src/services/databaseService';
import type { Server, ApifyResponse } from '../src/types';

// Mock D1Database
const mockD1Database = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  all: vi.fn(),
  run: vi.fn()
};

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Discord Worker Services', () => {
  let logger: Logger;
  
  beforeEach(() => {
    logger = new Logger('info');
    vi.clearAllMocks();
  });

  describe('ApifyDiscordService', () => {
    const apifyService = new ApifyDiscordService('test-token', 'test-actor', logger);
    const testServer: Server = {
      guild_id: 'test-guild',
      invite_code: 'test-invite'
    };

    it('should fetch server data successfully', async () => {
      const mockResponse: ApifyResponse = {
        name: 'Test Server',
        icon: 'test-icon',
        presence_count: 100,
        member_count: 200
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apifyService.fetchServerData(testServer);
      expect(result).toEqual(mockResponse);
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await apifyService.fetchServerData(testServer);
      expect(result).toBeNull();
    });

    it('should retry on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: 'Test Server',
            icon: 'test-icon',
            presence_count: 100,
            member_count: 200
          })
        });

      const result = await apifyService.fetchServerData(testServer);
      expect(result).not.toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('DatabaseService', () => {
    const dbService = new DatabaseService(mockD1Database as any, logger);

    it('should fetch all servers', async () => {
      const mockServers = [
        { guild_id: 'guild1', invite_code: 'invite1' },
        { guild_id: 'guild2', invite_code: 'invite2' }
      ];

      mockD1Database.all.mockResolvedValueOnce({ results: mockServers });
      const result = await dbService.getAllServers();
      expect(result).toEqual(mockServers);
    });

    it('should update server data', async () => {
      const serverData = {
        name: 'Test Server',
        icon: 'test-icon',
        presence_count: 100,
        member_count: 200,
        last_updated: 1234567890,
        data_json: '{}'
      };

      await dbService.updateServerData('test-guild', serverData);
      expect(mockD1Database.prepare).toHaveBeenCalled();
      expect(mockD1Database.bind).toHaveBeenCalled();
      expect(mockD1Database.run).toHaveBeenCalled();
    });

    it('should add history entry', async () => {
      const serverData = {
        name: 'Test Server',
        icon: 'test-icon',
        presence_count: 100,
        member_count: 200,
        last_updated: 1234567890,
        data_json: '{}'
      };

      await dbService.addHistoryEntry('test-guild', serverData);
      expect(mockD1Database.prepare).toHaveBeenCalled();
      expect(mockD1Database.bind).toHaveBeenCalled();
      expect(mockD1Database.run).toHaveBeenCalled();
    });

    it('should update global stats', async () => {
      const mockStats = {
        total_members: 1000,
        total_presence: 500,
        server_count: 5
      };

      mockD1Database.all.mockResolvedValueOnce({ results: [mockStats] });
      await dbService.updateGlobalStats();
      expect(mockD1Database.prepare).toHaveBeenCalled();
      expect(mockD1Database.bind).toHaveBeenCalled();
      expect(mockD1Database.run).toHaveBeenCalled();
    });
  });
}); 