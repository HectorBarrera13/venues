import { execSync } from 'node:child_process';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * Global setup of `npm run test:integration` (VEN-701/VEN-704).
 *
 * - When INTEGRATION_DATABASE_URL is set (CI, or `npm run docker:up`), the
 *   suite runs against that replica set — the same mongo:7.0 rs0 as compose.
 * - Otherwise it boots a throw-away single-node replica set in memory, so the
 *   suite also runs on machines without Docker.
 *
 * Either way the schema and raw indexes are pushed with `npm run db:push`,
 * exactly as an operator would do it.
 */
const MONGO_VERSION = '7.0.14';
const DATABASE = 'venue_db_integration';

export default async function globalSetup(): Promise<void> {
  let url = process.env.INTEGRATION_DATABASE_URL;

  if (!url) {
    const replSet = await MongoMemoryReplSet.create({
      binary: { version: MONGO_VERSION },
      replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' },
    });
    (globalThis as { __VENUES_MONGO__?: MongoMemoryReplSet }).__VENUES_MONGO__ = replSet;
    url = replSet.getUri(DATABASE);
  }

  // Inherited by the test process: src/database/prisma.ts reads it at import
  // time and dotenv never overrides a variable that is already set.
  process.env.DATABASE_URL = url;

  execSync('npm run db:push', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}
