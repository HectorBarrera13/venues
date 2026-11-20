/**
 * VEN-701 — the venue store runs as a replica set, so Prisma `$transaction`
 * really commits and really rolls back. Also covers the VEN-203 acceptance
 * criteria that can only be proven on a live replica set.
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkTransactions } from '../../src/database/transactionCheck';
import { parseMapPayload } from '../../src/services/map/parseMapPayload';
import { MapVersionConflictError, mapVersionRepository } from '../../src/services/map/MapVersionRepository';
import { prisma, resetDatabase } from './setup/database';

const validMap = parseMapPayload(
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../fixtures/maps/valid-v1.json'), 'utf8')),
);

async function seedVenue(id = 'tx-venue'): Promise<string> {
  await prisma.venueOwner.create({ data: { id: 'tx-owner', name: 'Owner' } });
  await prisma.venue.create({
    data: {
      id,
      name: 'Transaction Hall',
      nameNormalized: 'transaction hall',
      address: 'Calle 60',
      city: 'Merida',
      country: 'MX',
      location: { type: 'Point', coordinates: [-89.62, 20.97] },
      ownerId: 'tx-owner',
    },
  });
  return id;
}

beforeEach(resetDatabase);
afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('MongoDB replica set (VEN-701)', () => {
  it('reports a replica set and honours commit and rollback', async () => {
    const result = await checkTransactions(prisma);
    expect(result.replicaSet).toEqual(expect.any(String));
    expect(result.committed).toBe(true);
    expect(result.rolledBack).toBe(true);
  });

  it('leaves no probe documents behind', async () => {
    await checkTransactions(prisma);
    await expect(prisma.venueOwner.count()).resolves.toBe(0);
  });
});

describe('transactional seat-map save on the replica set (VEN-203)', () => {
  it('stores v1 then v2 and moves the pointer each time', async () => {
    const venueId = await seedVenue();
    await expect(mapVersionRepository.saveNewVersion(venueId, validMap)).resolves.toMatchObject({ version: 1 });
    await expect(mapVersionRepository.saveNewVersion(venueId, validMap)).resolves.toMatchObject({ version: 2 });
    const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
    expect(venue.latestMapVersion).toBe(2);
  });

  it('rolls back on a unique-index collision: the pointer does not move and no orphan version is left', async () => {
    const venueId = await seedVenue();
    // A version 1 the pointer does not know about: the next save collides on @@unique([venueId, version]).
    await prisma.mapVersion.create({
      data: { venueId, version: 1, stage: {}, zones: [], seats: [] },
    });

    await expect(mapVersionRepository.saveNewVersion(venueId, validMap)).rejects.toBeInstanceOf(MapVersionConflictError);

    const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
    expect(venue.latestMapVersion).toBe(0);
    await expect(prisma.mapVersion.count({ where: { venueId } })).resolves.toBe(1);
  });
});
