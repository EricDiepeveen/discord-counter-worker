# Discord Counter Worker

A Cloudflare Worker that fetches and updates Discord server statistics on a scheduled basis.

## Features

- Scheduled hourly updates of Discord server statistics
- Batch processing with retry logic
- Proxy support via Apify
- Comprehensive error handling and logging
- Database integration with Cloudflare D1
- Historical data tracking
- Global statistics aggregation

## Prerequisites

- Node.js >= 18.0.0
- Cloudflare account with Workers and D1 enabled
- Apify account with an actor set up for Discord server scraping

## Setup

1. Clone the repository and install dependencies:

```bash
cd discord-worker
npm install
```

2. Configure your environment variables in the Cloudflare dashboard:
   - `APIFY_TOKEN`: Your Apify API token
   - `APIFY_ACTOR_ID`: The ID of your Apify actor for Discord scraping
   - `LOG_LEVEL`: Logging level (debug, info, warn, error)
   - `ENVIRONMENT`: Environment name (production, development)

3. Update the `wrangler.toml` file with your D1 database ID.

## Development

Start the development server:

```bash
npm run dev
```

Type checking:

```bash
npm run type-check
```

Run tests:

```bash
npm test
```

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## API Endpoints

- `GET /`: Health check endpoint
- `POST /trigger-update`: Manually trigger server updates

## Database Schema

The worker expects the following tables to exist in your D1 database:

### discord_servers
```sql
CREATE TABLE discord_servers (
  guild_id TEXT PRIMARY KEY,
  invite_code TEXT NOT NULL,
  name TEXT,
  icon TEXT,
  presence_count INTEGER,
  member_count INTEGER,
  last_updated INTEGER,
  data_json TEXT
);
```

### discord_server_history
```sql
CREATE TABLE discord_server_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  presence_count INTEGER,
  member_count INTEGER,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES discord_servers(guild_id)
);
```

### discord_server_hourly_summary
```sql
CREATE TABLE discord_server_hourly_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hour_timestamp INTEGER NOT NULL,
  total_members INTEGER NOT NULL,
  total_online INTEGER NOT NULL,
  server_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
```

## Architecture

The worker is structured into several key components:

- `worker.ts`: Main entry point and request handler
- `services/apifyDiscordService.ts`: Handles communication with Apify
- `services/databaseService.ts`: Manages database operations
- `utils/logger.ts`: Provides logging functionality

## Error Handling

The worker implements comprehensive error handling:
- Retries failed requests with exponential backoff
- Logs errors with context for debugging
- Continues processing on individual server failures
- Updates global statistics even if some servers fail

## Monitoring

Monitor the worker's performance using:
- Cloudflare's Workers dashboard
- Worker logs (configurable via LOG_LEVEL)
- D1 database metrics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License 