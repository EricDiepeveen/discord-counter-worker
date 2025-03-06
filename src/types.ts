export interface ServerData {
  name: string;
  icon: string | null;
  presence_count: number | null;
  member_count: number | null;
  last_updated: number;
  data_json: string;
}

export interface Server {
  guild_id: string;
  invite_code: string;
}

export interface ApifyResponse {
  name: string;
  icon: string | null;
  presence_count: number;
  member_count: number;
  error?: string;
}

export interface GlobalStats {
  total_members: number;
  total_presence: number;
  server_count: number;
  timestamp: number;
} 