import type { Config } from 'drizzle-kit';
import { join } from 'path';
import { loadConfig } from './src/config/index';

// Load GutPunchConfig to get database file path
const config = loadConfig('config.yaml');
export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    // Ensure migrations run against the same DB file as the app
    url: join(process.cwd(), config.database.file),
  },
} satisfies Config;
