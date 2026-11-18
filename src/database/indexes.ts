import type { PrismaClient } from '@prisma/client';

/**
 * Indexes that the Prisma MongoDB connector cannot express in schema.prisma.
 * `prisma db push` may drop indexes it does not know about, so these are
 * (re)created after every push by scripts/ensure-indexes.ts.
 */
export const RAW_VENUE_INDEXES = [
  {
    name: 'venues_location_2dsphere',
    key: { location: '2dsphere' },
  },
  {
    name: 'venues_osmRef_unique_partial',
    key: { osmRef: 1 },
    unique: true,
    // Only documents with a string osmRef take part, so any number of
    // venues without an OpenStreetMap reference can coexist.
    partialFilterExpression: { osmRef: { $type: 'string' } },
  },
] as const;

type RawCommandClient = Pick<PrismaClient, '$runCommandRaw'>;

/** Creates the raw indexes on `venues`. Idempotent: existing identical indexes are kept. */
export async function ensureVenueIndexes(client: RawCommandClient): Promise<void> {
  await client.$runCommandRaw({
    createIndexes: 'venues',
    indexes: RAW_VENUE_INDEXES.map((index) => ({ ...index })),
  });
}
