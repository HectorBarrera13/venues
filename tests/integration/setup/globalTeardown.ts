import type { MongoMemoryReplSet } from 'mongodb-memory-server';

export default async function globalTeardown(): Promise<void> {
  const replSet = (globalThis as { __VENUES_MONGO__?: MongoMemoryReplSet }).__VENUES_MONGO__;
  if (replSet) await replSet.stop();
}
